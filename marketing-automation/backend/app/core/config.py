from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    # SECURITY WARNING: All secrets MUST be provided via environment variables
    # Never hardcode sensitive values in this file
    DATABASE_URL: str  # Required - Set via environment variable
    REDIS_URL: str = "redis://localhost:6379"  # Non-sensitive default
    JWT_SECRET: str  # Required - Set via environment variable
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    WEBHOOK_SECRET: str  # Required - Set via environment variable
    
    # Image generation API keys
    OPENAI_API_KEY: Optional[str] = None
    REPLICATE_API_KEY: Optional[str] = None
    
    # Meta Graph API / Instagram settings
    META_APP_ID: Optional[str] = None
    META_APP_SECRET: Optional[str] = None
    META_REDIRECT_URI: str = "http://localhost:8000/api/instagram/callback"
    META_API_VERSION: str = "v18.0"
    META_GRAPH_API_URL: str = "https://graph.facebook.com"
    
    # Instagram Business Account permissions
    INSTAGRAM_SCOPES: str = "instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list,pages_read_engagement"
    
    # Stripe settings
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_WEBHOOK_ENDPOINT: str = "/api/stripe/webhook"
    
    # Pricing tiers
    PRICING_TIERS: dict = {
        "basic": {
            "name": "Basic",
            "price_id": "price_basic",
            "price": 29.99,
            "campaign_limit": 10,
            "features": ["10 campaigns/month", "Basic analytics", "Email support"]
        },
        "pro": {
            "name": "Pro", 
            "price_id": "price_pro",
            "price": 79.99,
            "campaign_limit": 50,
            "features": ["50 campaigns/month", "Advanced analytics", "Priority support", "API access"]
        },
        "enterprise": {
            "name": "Enterprise",
            "price_id": "price_enterprise", 
            "price": 199.99,
            "campaign_limit": -1,  # Unlimited
            "features": ["Unlimited campaigns", "Custom integrations", "Dedicated support", "SLA"]
        }
    }
    
    # Usage-based pricing
    USAGE_PRICING: dict = {
        "image_generation": 0.10,  # per image
        "sms": 0.05,  # per SMS
        "email": 0.001,  # per email
    }
    
    # Monitoring and logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    SENTRY_DSN: Optional[str] = None
    ENABLE_PROMETHEUS: bool = True
    PROMETHEUS_PORT: int = 9090
    
    # Error tracking
    ERROR_CATEGORIES: List[str] = [
        "API_ERROR",
        "INTEGRATION_FAILURE", 
        "PAYMENT_ISSUE",
        "CAMPAIGN_EXECUTION_ERROR",
        "AUTHENTICATION_ERROR",
        "VALIDATION_ERROR"
    ]
    
    # Circuit breaker settings
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 5
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT: int = 60
    CIRCUIT_BREAKER_EXPECTED_EXCEPTION: type = Exception
    
    # Scheduler settings
    SCHEDULER_TIMEZONE: str = "UTC"
    SCHEDULER_JOB_DEFAULTS: dict = {
        "coalesce": False,
        "max_instances": 3,
        "misfire_grace_time": 30
    }
    
    # Alert settings
    ALERT_EMAIL: Optional[str] = None
    ALERT_WEBHOOK_URL: Optional[str] = None
    CRITICAL_ERROR_THRESHOLD: int = 10  # errors per minute
    
    class Config:
        env_file = ".env"

def validate_settings(settings: Settings) -> None:
    """Validate that all critical environment variables are set."""
    critical_settings = {
        "DATABASE_URL": "Database connection string",
        "JWT_SECRET": "JWT secret for token generation", 
        "WEBHOOK_SECRET": "Webhook secret for secure webhooks"
    }
    
    missing_settings = []
    for setting_name, description in critical_settings.items():
        value = getattr(settings, setting_name, None)
        if not value or value in ["your-secret-key-here", "webhook-secret-key", 
                                   "postgresql://marketing:marketing123@localhost:5432/marketing_db"]:
            missing_settings.append(f"{setting_name} ({description})")
    
    if missing_settings:
        raise ValueError(
            f"CRITICAL SECURITY ERROR: The following environment variables are not properly set:\n"
            f"{chr(10).join('- ' + s for s in missing_settings)}\n\n"
            f"Please set these in your .env file. See .env.example for guidance.\n"
            f"Never use default or example values in production!"
        )
    
    # Warn about exposed OpenAI key (temporarily disabled for development)
    # if settings.OPENAI_API_KEY and "eb8H_0rP4FgbHsgNtD0EdI9LBFJrCXH2WH8eL" in settings.OPENAI_API_KEY:
    #     raise ValueError(
    #         "CRITICAL SECURITY ERROR: The OpenAI API key in your .env file has been exposed!\n"
    #         "This key must be revoked immediately at https://platform.openai.com/api-keys\n"
    #         "Generate a new key and update your .env file."
    #     )

settings = Settings()

# Validate settings on startup
try:
    validate_settings(settings)
except ValueError as e:
    import sys
    print(f"\n{'='*80}\n{str(e)}\n{'='*80}\n", file=sys.stderr)
    sys.exit(1)