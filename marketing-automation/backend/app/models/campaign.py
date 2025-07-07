from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.models.database import Base

class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class TriggerType(str, enum.Enum):
    MANUAL = "manual"
    SCHEDULED = "scheduled"
    RECURRING = "recurring"
    WEBHOOK = "webhook"
    EVENT = "event"
    CONDITION = "condition"

class Campaign(Base):
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(CampaignStatus), default=CampaignStatus.DRAFT)
    
    # User relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="campaigns")
    
    # Scheduling
    scheduled_at = Column(DateTime(timezone=True))
    executed_at = Column(DateTime(timezone=True))
    
    # Trigger configuration
    trigger_type = Column(Enum(TriggerType), default=TriggerType.MANUAL)
    trigger_config = Column(JSON, default={})
    
    # Workflow configuration
    workflow_id = Column(String)  # n8n workflow ID
    workflow_config = Column(JSON, default={})
    
    # Enhanced configuration
    config = Column(JSON, default={})  # General campaign configuration
    
    # Campaign content
    image_url = Column(Text)
    content = Column(JSON, default={})  # Additional content like captions, etc.
    
    # CMS integration
    content_template_id = Column(Integer, ForeignKey("content_templates.id"))
    template_variables = Column(JSON, default={})  # Variable values for template
    
    # Instagram integration
    instagram_account_id = Column(Integer, ForeignKey("instagram_accounts.id"))
    instagram_caption = Column(Text)
    instagram_hashtags = Column(JSON, default=[])
    instagram_publish = Column(Boolean, default=False)
    
    # Metadata
    tags = Column(JSON, default=[])
    is_template = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    executions = relationship("CampaignExecution", back_populates="campaign")
    instagram_posts = relationship("InstagramPost", back_populates="campaign")
    instagram_account = relationship("InstagramAccount")
    content_template = relationship("ContentTemplate", back_populates="campaigns")

class CampaignExecution(Base):
    __tablename__ = "campaign_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    campaign = relationship("Campaign", back_populates="executions")
    
    status = Column(String, default="pending")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Execution details
    workflow_execution_id = Column(String)  # n8n execution ID
    triggered_by = Column(String)  # manual, scheduled, event, etc.
    result = Column(JSON)
    result_summary = Column(JSON)  # Summary of execution results
    error = Column(Text)
    error_message = Column(Text)
    
    # Metrics
    metrics = Column(JSON, default={})
    execution_metadata = Column(JSON, default={})  # Additional metadata