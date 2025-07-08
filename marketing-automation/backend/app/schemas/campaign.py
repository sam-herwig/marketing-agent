from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.campaign import CampaignStatus, TriggerType

class TriggerConfig(BaseModel):
    cron: Optional[str] = None  # For scheduled triggers
    webhook_url: Optional[str] = None  # For webhook triggers
    event_name: Optional[str] = None  # For event triggers
    conditions: Optional[Dict[str, Any]] = None

class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_type: TriggerType = TriggerType.MANUAL
    trigger_config: Optional[TriggerConfig] = None
    workflow_id: Optional[str] = None
    workflow_config: Optional[Dict[str, Any]] = {}
    image_url: Optional[str] = None
    content: Optional[Dict[str, Any]] = {}
    tags: List[str] = []
    scheduled_at: Optional[datetime] = None
    # CMS integration
    content_template_id: Optional[int] = None
    template_variables: Optional[Dict[str, Any]] = {}
    # Instagram integration
    instagram_account_id: Optional[int] = None
    instagram_caption: Optional[str] = None
    instagram_hashtags: List[str] = []
    instagram_publish: bool = False

class CampaignCreate(CampaignBase):
    pass

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[CampaignStatus] = None
    trigger_type: Optional[TriggerType] = None
    trigger_config: Optional[TriggerConfig] = None
    workflow_id: Optional[str] = None
    workflow_config: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    scheduled_at: Optional[datetime] = None
    # CMS integration
    content_template_id: Optional[int] = None
    template_variables: Optional[Dict[str, Any]] = None
    # Instagram integration
    instagram_account_id: Optional[int] = None
    instagram_caption: Optional[str] = None
    instagram_hashtags: Optional[List[str]] = None
    instagram_publish: Optional[bool] = None

class CampaignResponse(CampaignBase):
    id: int
    user_id: int
    status: CampaignStatus
    is_template: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    instagram_account: Optional[Dict[str, Any]] = None
    
    @validator('instagram_account', pre=True)
    def serialize_instagram_account(cls, v):
        if v is None:
            return None
        # If it's already a dict, return it
        if isinstance(v, dict):
            return v
        # If it's an InstagramAccount object, serialize it
        return {
            "id": v.id,
            "instagram_user_id": v.instagram_user_id,
            "instagram_username": v.instagram_username,
            "instagram_business_account_id": v.instagram_business_account_id,
            "page_id": v.page_id,
            "status": v.status.value if hasattr(v.status, 'value') else v.status,
            "last_synced_at": v.last_synced_at.isoformat() if v.last_synced_at else None
        }
    
    class Config:
        from_attributes = True

class CampaignExecutionBase(BaseModel):
    status: str = "pending"
    workflow_execution_id: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metrics: Dict[str, Any] = {}

class CampaignExecutionResponse(CampaignExecutionBase):
    id: int
    campaign_id: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True