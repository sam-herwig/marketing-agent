import logging
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from collections import defaultdict
from pythonjsonlogger import jsonlogger
from sqlalchemy.orm import Session
from sqlalchemy import func
import sentry_sdk
from prometheus_client import Counter, Histogram, Gauge, generate_latest
from circuitbreaker import circuit
from app.core.config import settings
import redis
import asyncio


# Configure JSON logging
def setup_logging():
    """Configure JSON logging for the application"""
    logHandler = logging.StreamHandler()
    formatter = jsonlogger.JsonFormatter()
    logHandler.setFormatter(formatter)
    
    logger = logging.getLogger()
    logger.setLevel(getattr(logging, settings.LOG_LEVEL))
    logger.addHandler(logHandler)
    
    # Initialize Sentry if DSN is provided
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
        )


# Prometheus metrics
request_count = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
request_duration = Histogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'endpoint'])
active_campaigns = Gauge('active_campaigns_total', 'Total active campaigns')
error_count = Counter('errors_total', 'Total errors', ['category', 'service'])
external_api_calls = Counter('external_api_calls_total', 'External API calls', ['service', 'endpoint', 'status'])
external_api_duration = Histogram('external_api_duration_seconds', 'External API call duration', ['service', 'endpoint'])


class ErrorTracker:
    """Service for tracking and categorizing errors"""
    
    def __init__(self):
        self.redis_client = redis.from_url(settings.REDIS_URL)
        self.error_ttl = 3600  # 1 hour TTL for error counts
        
    async def track_error(
        self,
        category: str,
        service: str,
        error_message: str,
        context: Optional[Dict[str, Any]] = None
    ):
        """Track an error occurrence"""
        timestamp = datetime.utcnow()
        
        # Log the error
        logger = logging.getLogger(__name__)
        logger.error(
            "Error occurred",
            extra={
                "category": category,
                "service": service,
                "error_message": error_message,
                "context": context,
                "timestamp": timestamp.isoformat()
            }
        )
        
        # Update Prometheus metric
        error_count.labels(category=category, service=service).inc()
        
        # Store in Redis for rate limiting and alerting
        error_key = f"error:{category}:{service}:{timestamp.minute}"
        self.redis_client.incr(error_key)
        self.redis_client.expire(error_key, self.error_ttl)
        
        # Check if we need to send alerts
        await self._check_alert_threshold(category, service)
        
        # Send to Sentry if configured
        if settings.SENTRY_DSN:
            with sentry_sdk.push_scope() as scope:
                scope.set_tag("category", category)
                scope.set_tag("service", service)
                scope.set_context("error_context", context or {})
                sentry_sdk.capture_message(error_message, level="error")
    
    async def _check_alert_threshold(self, category: str, service: str):
        """Check if error rate exceeds threshold and send alert"""
        current_minute = datetime.utcnow().minute
        error_count = 0
        
        # Count errors in the last minute
        for i in range(1):
            minute = (current_minute - i) % 60
            error_key = f"error:{category}:{service}:{minute}"
            count = self.redis_client.get(error_key)
            if count:
                error_count += int(count)
        
        # Send alert if threshold exceeded
        if error_count >= settings.CRITICAL_ERROR_THRESHOLD:
            await self._send_alert(
                f"Critical error threshold exceeded for {category}/{service}",
                f"Error count: {error_count} in the last minute"
            )
    
    async def _send_alert(self, subject: str, message: str):
        """Send alert via configured channels"""
        logger = logging.getLogger(__name__)
        logger.critical(f"ALERT: {subject} - {message}")
        
        # Send webhook alert if configured
        if settings.ALERT_WEBHOOK_URL:
            import httpx
            async with httpx.AsyncClient() as client:
                try:
                    await client.post(
                        settings.ALERT_WEBHOOK_URL,
                        json={"subject": subject, "message": message}
                    )
                except Exception as e:
                    logger.error(f"Failed to send webhook alert: {str(e)}")
    
    async def get_error_stats(
        self,
        time_range: timedelta = timedelta(hours=1)
    ) -> Dict[str, Any]:
        """Get error statistics for monitoring dashboard"""
        stats = defaultdict(lambda: defaultdict(int))
        
        # Get all error keys from Redis
        pattern = "error:*"
        keys = self.redis_client.keys(pattern)
        
        for key in keys:
            parts = key.decode().split(":")
            if len(parts) >= 4:
                category = parts[1]
                service = parts[2]
                count = self.redis_client.get(key)
                if count:
                    stats[category][service] += int(count)
        
        return dict(stats)


class MonitoringService:
    """Main monitoring service for system health and metrics"""
    
    def __init__(self, db: Session):
        self.db = db
        self.redis_client = redis.from_url(settings.REDIS_URL)
        self.error_tracker = ErrorTracker()
    
    async def get_system_health(self) -> Dict[str, Any]:
        """Get overall system health status"""
        health = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {}
        }
        
        # Check database connectivity
        try:
            self.db.execute("SELECT 1")
            health["services"]["database"] = {"status": "healthy"}
        except Exception as e:
            health["services"]["database"] = {"status": "unhealthy", "error": str(e)}
            health["status"] = "degraded"
        
        # Check Redis connectivity
        try:
            self.redis_client.ping()
            health["services"]["redis"] = {"status": "healthy"}
        except Exception as e:
            health["services"]["redis"] = {"status": "unhealthy", "error": str(e)}
            health["status"] = "degraded"
        
        # Check external APIs status
        health["services"]["stripe"] = await self._check_stripe_health()
        health["services"]["instagram"] = await self._check_instagram_health()
        
        return health
    
    async def _check_stripe_health(self) -> Dict[str, str]:
        """Check Stripe API health"""
        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            # Make a simple API call to check connectivity
            stripe.Balance.retrieve()
            return {"status": "healthy"}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
    
    async def _check_instagram_health(self) -> Dict[str, str]:
        """Check Instagram API health"""
        # Implementation would check Instagram API status
        return {"status": "healthy"}
    
    async def get_api_metrics(self, time_range: timedelta = timedelta(hours=1)) -> Dict[str, Any]:
        """Get API performance metrics"""
        metrics = {
            "response_times": {},
            "request_counts": {},
            "error_rates": {}
        }
        
        # Get metrics from Redis (stored by middleware)
        pattern = "api_metric:*"
        keys = self.redis_client.keys(pattern)
        
        for key in keys:
            data = self.redis_client.get(key)
            if data:
                metric_data = json.loads(data)
                endpoint = metric_data.get("endpoint")
                
                if endpoint not in metrics["response_times"]:
                    metrics["response_times"][endpoint] = []
                    metrics["request_counts"][endpoint] = 0
                    metrics["error_rates"][endpoint] = 0
                
                metrics["response_times"][endpoint].append(metric_data.get("duration", 0))
                metrics["request_counts"][endpoint] += 1
                if metric_data.get("status", 200) >= 400:
                    metrics["error_rates"][endpoint] += 1
        
        # Calculate averages
        for endpoint in metrics["response_times"]:
            times = metrics["response_times"][endpoint]
            metrics["response_times"][endpoint] = {
                "avg": sum(times) / len(times) if times else 0,
                "min": min(times) if times else 0,
                "max": max(times) if times else 0
            }
            
            total = metrics["request_counts"][endpoint]
            errors = metrics["error_rates"][endpoint]
            metrics["error_rates"][endpoint] = (errors / total * 100) if total > 0 else 0
        
        return metrics
    
    async def get_campaign_metrics(self) -> Dict[str, Any]:
        """Get campaign execution metrics"""
        from app.models.campaign import Campaign, CampaignExecution, CampaignStatus
        
        # Get campaign statistics
        total_campaigns = self.db.query(func.count(Campaign.id)).scalar()
        active_campaigns = self.db.query(func.count(Campaign.id)).filter(
            Campaign.status == CampaignStatus.ACTIVE
        ).scalar()
        
        # Update Prometheus gauge
        active_campaigns_gauge = active_campaigns or 0
        active_campaigns.set(active_campaigns_gauge)
        
        # Get execution statistics
        executions = self.db.query(
            CampaignExecution.status,
            func.count(CampaignExecution.id)
        ).group_by(CampaignExecution.status).all()
        
        execution_stats = {str(status): count for status, count in executions}
        
        # Calculate success rate
        total_executions = sum(execution_stats.values())
        successful = execution_stats.get("completed", 0)
        success_rate = (successful / total_executions * 100) if total_executions > 0 else 0
        
        return {
            "total_campaigns": total_campaigns,
            "active_campaigns": active_campaigns_gauge,
            "execution_stats": execution_stats,
            "success_rate": success_rate
        }
    
    def get_prometheus_metrics(self) -> bytes:
        """Get Prometheus metrics in text format"""
        return generate_latest()


class CircuitBreakerService:
    """Service for implementing circuit breaker pattern for external APIs"""
    
    @staticmethod
    def get_circuit_breaker(
        failure_threshold: Optional[int] = None,
        recovery_timeout: Optional[int] = None,
        expected_exception: Optional[type] = None
    ):
        """Get a configured circuit breaker decorator"""
        return circuit(
            failure_threshold=failure_threshold or settings.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
            recovery_timeout=recovery_timeout or settings.CIRCUIT_BREAKER_RECOVERY_TIMEOUT,
            expected_exception=expected_exception or settings.CIRCUIT_BREAKER_EXPECTED_EXCEPTION
        )


# Middleware for request/response logging
class LoggingMiddleware:
    """Middleware for logging all requests and responses"""
    
    def __init__(self, app):
        self.app = app
        self.redis_client = redis.from_url(settings.REDIS_URL)
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        start_time = time.time()
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                duration = time.time() - start_time
                
                # Log request
                logger = logging.getLogger("api.request")
                logger.info(
                    "API Request",
                    extra={
                        "method": scope["method"],
                        "path": scope["path"],
                        "duration": duration,
                        "status": message.get("status", 0)
                    }
                )
                
                # Update Prometheus metrics
                request_count.labels(
                    method=scope["method"],
                    endpoint=scope["path"],
                    status=message.get("status", 0)
                ).inc()
                
                request_duration.labels(
                    method=scope["method"],
                    endpoint=scope["path"]
                ).observe(duration)
                
                # Store in Redis for analytics
                metric_data = {
                    "endpoint": scope["path"],
                    "method": scope["method"],
                    "duration": duration,
                    "status": message.get("status", 0),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                metric_key = f"api_metric:{scope['path']}:{int(time.time())}"
                self.redis_client.setex(
                    metric_key,
                    3600,  # 1 hour TTL
                    json.dumps(metric_data)
                )
            
            await send(message)
        
        await self.app(scope, receive, send_wrapper)


# Error recovery mechanisms
class ErrorRecoveryService:
    """Service for implementing error recovery mechanisms"""
    
    def __init__(self, db: Session):
        self.db = db
        self.redis_client = redis.from_url(settings.REDIS_URL)
        self.max_retries = 3
        self.retry_delay = 60  # seconds
    
    async def retry_failed_campaign_execution(self, execution_id: int):
        """Retry a failed campaign execution"""
        from app.models.campaign import CampaignExecution
        
        execution = self.db.query(CampaignExecution).filter(
            CampaignExecution.id == execution_id
        ).first()
        
        if not execution:
            return
        
        retry_key = f"retry:campaign_execution:{execution_id}"
        retry_count = self.redis_client.get(retry_key)
        retry_count = int(retry_count) if retry_count else 0
        
        if retry_count >= self.max_retries:
            logger = logging.getLogger(__name__)
            logger.error(f"Max retries exceeded for campaign execution {execution_id}")
            return
        
        # Schedule retry
        self.redis_client.setex(retry_key, 86400, retry_count + 1)  # 24 hour TTL
        await asyncio.sleep(self.retry_delay * (retry_count + 1))  # Exponential backoff
        
        # Retry execution
        # Implementation would trigger campaign execution service
        
    async def handle_rate_limit(self, service: str, retry_after: int):
        """Handle API rate limit errors"""
        rate_limit_key = f"rate_limit:{service}"
        self.redis_client.setex(rate_limit_key, retry_after, "1")
        
        logger = logging.getLogger(__name__)
        logger.warning(f"Rate limit hit for {service}, retry after {retry_after} seconds")
        
        # Could implement request queuing here
    
    async def handle_payment_failure(self, customer_id: int, invoice_id: str):
        """Handle payment failure recovery"""
        # Implementation would:
        # 1. Retry payment with fallback payment method
        # 2. Send notification to user
        # 3. Potentially downgrade subscription
        pass