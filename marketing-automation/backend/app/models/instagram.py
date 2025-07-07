from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.models.database import Base

class InstagramAccountStatus(str, enum.Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    EXPIRED = "expired"

class InstagramPostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHING = "publishing"
    PUBLISHED = "published"
    FAILED = "failed"

class InstagramAccount(Base):
    __tablename__ = "instagram_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="instagram_accounts")
    
    # Instagram account details
    instagram_user_id = Column(String, unique=True, nullable=False)
    instagram_username = Column(String, nullable=False)
    instagram_business_account_id = Column(String)
    page_id = Column(String)  # Facebook Page ID associated with Instagram Business Account
    
    # OAuth credentials
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text)
    token_expires_at = Column(DateTime(timezone=True))
    
    # Account status
    status = Column(Enum(InstagramAccountStatus), default=InstagramAccountStatus.CONNECTED)
    last_synced_at = Column(DateTime(timezone=True))
    
    # Profile data cache
    profile_data = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    posts = relationship("InstagramPost", back_populates="account")
    analytics = relationship("InstagramAnalytics", back_populates="account")

class InstagramPost(Base):
    __tablename__ = "instagram_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("instagram_accounts.id"), nullable=False)
    account = relationship("InstagramAccount", back_populates="posts")
    
    # Optional campaign association
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    campaign = relationship("Campaign", back_populates="instagram_posts")
    
    # Post details
    instagram_post_id = Column(String, unique=True)
    post_type = Column(String, default="IMAGE")  # IMAGE, VIDEO, CAROUSEL
    caption = Column(Text)
    hashtags = Column(JSON, default=[])
    
    # Media details
    media_urls = Column(JSON, default=[])  # List of media URLs
    media_type = Column(String)  # image/jpeg, video/mp4, etc.
    thumbnail_url = Column(Text)
    
    # Scheduling
    scheduled_publish_time = Column(DateTime(timezone=True))
    published_at = Column(DateTime(timezone=True))
    
    # Status
    status = Column(Enum(InstagramPostStatus), default=InstagramPostStatus.DRAFT)
    error_message = Column(Text)
    
    # Engagement metrics (updated periodically)
    likes_count = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count = Column(Integer, default=0)
    reach_count = Column(Integer, default=0)
    impressions_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class InstagramAnalytics(Base):
    __tablename__ = "instagram_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("instagram_accounts.id"), nullable=False)
    account = relationship("InstagramAccount", back_populates="analytics")
    
    # Time period
    date = Column(DateTime(timezone=True), nullable=False)
    period_type = Column(String, default="daily")  # daily, weekly, monthly
    
    # Account metrics
    followers_count = Column(Integer, default=0)
    following_count = Column(Integer, default=0)
    media_count = Column(Integer, default=0)
    
    # Engagement metrics
    total_likes = Column(Integer, default=0)
    total_comments = Column(Integer, default=0)
    total_shares = Column(Integer, default=0)
    engagement_rate = Column(Integer, default=0)
    
    # Reach and impressions
    total_reach = Column(Integer, default=0)
    total_impressions = Column(Integer, default=0)
    
    # Profile activity
    profile_views = Column(Integer, default=0)
    website_clicks = Column(Integer, default=0)
    
    # Demographics data
    demographics = Column(JSON, default={})
    
    # Raw API response
    raw_data = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())