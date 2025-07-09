from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
from app.core.config import settings
from app.api import auth, users, campaigns, webhooks, n8n, instagram, stripe, monitoring, scheduling, cms, images, discounts
from app.models.database import engine, Base
from app.models.user import User
from app.models.campaign import Campaign, CampaignExecution
from app.models.instagram import InstagramAccount, InstagramPost, InstagramAnalytics
from app.models.payment import Customer, Subscription, PaymentMethod, Invoice
from app.services.scheduler import start_scheduler
from app.services.campaign_scheduler import campaign_scheduler
from app.services.monitoring_service import setup_logging, LoggingMiddleware
from app.middleware.rate_limit import (
    limiter, custom_rate_limit_exceeded_handler, RateLimits
)
from slowapi.errors import RateLimitExceeded

# Setup logging
setup_logging()

# Create all database tables
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await start_scheduler()
    campaign_scheduler.start()
    yield
    # Shutdown
    campaign_scheduler.stop()
    # The scheduler will stop when the app shuts down

app = FastAPI(title="Marketing Automation API", lifespan=lifespan)

# Add rate limit exceeded handler
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)

# Add logging middleware
app.add_middleware(LoggingMiddleware)

# Configure rate limiter
app.state.limiter = limiter

# Configure CORS with specific origins
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5678",
    "http://n8n:5678",
    # Add production origins here when deployed
    # "https://yourdomain.com",
    # "https://app.yourdomain.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "Retry-After"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["campaigns"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])
app.include_router(n8n.router, prefix="/api/n8n", tags=["n8n"])
app.include_router(instagram.router, prefix="/api/instagram", tags=["instagram"])
app.include_router(stripe.router, prefix="/api", tags=["payments"])
app.include_router(monitoring.router, prefix="/api", tags=["monitoring"])
app.include_router(scheduling.router, prefix="/api", tags=["scheduling"])
app.include_router(cms.router, prefix="/api/cms", tags=["cms"])
app.include_router(images.router, prefix="/api/images", tags=["images"])
app.include_router(discounts.router, prefix="/api", tags=["discounts"])

@app.get("/")
def read_root():
    return {"message": "Marketing Automation API", "version": "1.0.0"}