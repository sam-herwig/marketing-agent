from typing import Callable, Optional
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import redis
from datetime import datetime, timedelta
import json
import logging

logger = logging.getLogger(__name__)

# Create a custom key function that uses both IP and endpoint
def get_rate_limit_key(request: Request) -> str:
    """Generate a unique key for rate limiting based on IP and path"""
    remote_addr = get_remote_address(request)
    path = request.url.path
    return f"{remote_addr}:{path}"

# Create a custom key function for auth endpoints that includes username
def get_auth_rate_limit_key(request: Request) -> str:
    """Generate a unique key for auth rate limiting based on IP and username"""
    remote_addr = get_remote_address(request)
    # For auth endpoints, we'll include the username in the key when available
    return f"auth:{remote_addr}"

# Initialize the limiter with Redis storage for distributed rate limiting
limiter = Limiter(
    key_func=get_rate_limit_key,
    storage_uri="redis://redis:6379",
    strategy="fixed-window"
)

# Custom error handler for rate limit exceeded
async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """Custom handler for rate limit exceeded errors"""
    response = JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}",
            "error": "rate_limit_exceeded"
        }
    )
    # Add retry-after header
    retry_after = getattr(exc, 'retry_after', 60)
    response.headers["Retry-After"] = str(retry_after)
    response.headers["X-RateLimit-Limit"] = str(getattr(exc, 'limit', 'N/A'))
    response.headers["X-RateLimit-Remaining"] = "0"
    response.headers["X-RateLimit-Reset"] = str(int(datetime.now().timestamp()) + retry_after)
    
    return response

# Rate limiting configurations
class RateLimits:
    """Rate limit configurations for different endpoints"""
    # Authentication endpoints
    LOGIN = "5 per 15 minutes"
    REGISTER = "3 per hour"
    
    # API endpoints
    API_DEFAULT = "100 per 15 minutes"
    API_HEAVY = "20 per 15 minutes"  # For resource-intensive endpoints
    
    # Webhook endpoints
    WEBHOOK = "50 per minute"
    
    # File upload endpoints
    UPLOAD = "10 per hour"

class RateLimitMiddleware:
    """Custom middleware for applying rate limits with Redis backend"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client or redis.Redis(
            host='redis', 
            port=6379, 
            decode_responses=True
        )
        
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting before processing request"""
        path = request.url.path
        
        # Skip rate limiting for health checks and docs
        if path in ["/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Get client IP
        client_ip = get_remote_address(request)
        
        # Check if IP is blacklisted
        if await self.is_blacklisted(client_ip):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: IP address is blacklisted"
            )
        
        # Log the request
        logger.info(f"Request from {client_ip} to {path}")
        
        # Process the request
        response = await call_next(request)
        
        # Add rate limit headers to response
        await self.add_rate_limit_headers(request, response)
        
        return response
    
    async def is_blacklisted(self, ip: str) -> bool:
        """Check if an IP is blacklisted"""
        try:
            return self.redis_client.sismember("blacklisted_ips", ip)
        except Exception as e:
            logger.error(f"Error checking blacklist: {e}")
            return False
    
    async def add_rate_limit_headers(self, request: Request, response: Response) -> None:
        """Add rate limit information to response headers"""
        try:
            key = get_rate_limit_key(request)
            # Get current usage from Redis
            usage = self.redis_client.get(f"usage:{key}")
            if usage:
                usage_data = json.loads(usage)
                response.headers["X-RateLimit-Limit"] = str(usage_data.get("limit", "N/A"))
                response.headers["X-RateLimit-Remaining"] = str(usage_data.get("remaining", "N/A"))
                response.headers["X-RateLimit-Reset"] = str(usage_data.get("reset", "N/A"))
        except Exception as e:
            logger.error(f"Error adding rate limit headers: {e}")

def create_rate_limiter() -> Limiter:
    """Create and configure the rate limiter"""
    return limiter

# Utility function to temporarily block an IP
async def block_ip(ip: str, duration_minutes: int = 60, redis_client: Optional[redis.Redis] = None):
    """Temporarily block an IP address"""
    if not redis_client:
        redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
    
    try:
        # Add to blacklist with expiration
        redis_client.sadd("blacklisted_ips", ip)
        redis_client.expire("blacklisted_ips", duration_minutes * 60)
        logger.warning(f"Blocked IP {ip} for {duration_minutes} minutes")
    except Exception as e:
        logger.error(f"Error blocking IP: {e}")

# Utility function to unblock an IP
async def unblock_ip(ip: str, redis_client: Optional[redis.Redis] = None):
    """Remove an IP from the blacklist"""
    if not redis_client:
        redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)
    
    try:
        redis_client.srem("blacklisted_ips", ip)
        logger.info(f"Unblocked IP {ip}")
    except Exception as e:
        logger.error(f"Error unblocking IP: {e}")