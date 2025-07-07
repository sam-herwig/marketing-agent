from app.schemas.campaign import (
    CampaignCreate,
    CampaignUpdate,
    CampaignResponse,
    CampaignExecutionResponse
)
from app.schemas.instagram import (
    InstagramAccountCreate,
    InstagramAccountUpdate,
    InstagramAccountResponse,
    InstagramPostCreate,
    InstagramPostUpdate,
    InstagramPostResponse,
    InstagramAnalyticsResponse,
    InstagramOAuthResponse,
    InstagramPublishResponse
)

__all__ = [
    # Campaign schemas
    "CampaignCreate",
    "CampaignUpdate",
    "CampaignResponse",
    "CampaignExecutionResponse",
    # Instagram schemas
    "InstagramAccountCreate",
    "InstagramAccountUpdate",
    "InstagramAccountResponse",
    "InstagramPostCreate",
    "InstagramPostUpdate",
    "InstagramPostResponse",
    "InstagramAnalyticsResponse",
    "InstagramOAuthResponse",
    "InstagramPublishResponse",
]