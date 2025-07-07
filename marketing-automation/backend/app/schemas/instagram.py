from pydantic import BaseModel, HttpUrl
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.models.instagram import InstagramAccountStatus, InstagramPostStatus

# Instagram Account Schemas
class InstagramAccountBase(BaseModel):
    instagram_username: str
    status: InstagramAccountStatus = InstagramAccountStatus.CONNECTED

class InstagramAccountCreate(BaseModel):
    code: str  # OAuth authorization code

class InstagramAccountUpdate(BaseModel):
    status: Optional[InstagramAccountStatus] = None

class InstagramAccountResponse(InstagramAccountBase):
    id: int
    user_id: int
    instagram_user_id: str
    instagram_business_account_id: Optional[str] = None
    page_id: Optional[str] = None
    last_synced_at: Optional[datetime] = None
    profile_data: Dict[str, Any] = {}
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Instagram Post Schemas
class InstagramPostBase(BaseModel):
    caption: str
    hashtags: List[str] = []
    scheduled_publish_time: Optional[datetime] = None

class InstagramPostCreate(InstagramPostBase):
    account_id: int
    campaign_id: Optional[int] = None
    media_urls: List[HttpUrl]
    post_type: str = "IMAGE"

class InstagramPostUpdate(BaseModel):
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_publish_time: Optional[datetime] = None
    status: Optional[InstagramPostStatus] = None

class InstagramPostResponse(InstagramPostBase):
    id: int
    account_id: int
    campaign_id: Optional[int] = None
    instagram_post_id: Optional[str] = None
    post_type: str
    media_urls: List[str] = []
    thumbnail_url: Optional[str] = None
    status: InstagramPostStatus
    error_message: Optional[str] = None
    published_at: Optional[datetime] = None
    likes_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    reach_count: int = 0
    impressions_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Instagram Analytics Schemas
class InstagramAnalyticsResponse(BaseModel):
    id: int
    account_id: int
    date: datetime
    period_type: str
    followers_count: int = 0
    following_count: int = 0
    media_count: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    engagement_rate: int = 0
    total_reach: int = 0
    total_impressions: int = 0
    profile_views: int = 0
    website_clicks: int = 0
    demographics: Dict[str, Any] = {}
    created_at: datetime
    
    class Config:
        from_attributes = True

# OAuth Response
class InstagramOAuthResponse(BaseModel):
    oauth_url: str
    state: str

# Publish Response
class InstagramPublishResponse(BaseModel):
    post_id: int
    instagram_post_id: str
    status: str
    message: str