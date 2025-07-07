from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, Enum, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.models.database import Base

class ContentType(str, enum.Enum):
    EMAIL = "email"
    SOCIAL_MEDIA = "social_media"
    BLOG = "blog"
    LANDING_PAGE = "landing_page"
    SMS = "sms"
    GENERAL = "general"

class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    DOCUMENT = "document"
    AUDIO = "audio"
    OTHER = "other"

class ContentTemplate(Base):
    __tablename__ = "content_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    content_type = Column(Enum(ContentType), default=ContentType.GENERAL)
    
    # Template content with variable placeholders
    subject = Column(String)  # For emails
    content = Column(Text, nullable=False)  # HTML or text content
    preview_text = Column(Text)  # Preview or excerpt
    
    # Template variables (list of variable names and their descriptions)
    variables = Column(JSON, default=[])  # [{"name": "first_name", "description": "Customer first name", "default": ""}]
    
    # Template metadata
    tags = Column(JSON, default=[])
    category = Column(String)
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)  # Can be shared across users
    
    # User relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    campaigns = relationship("Campaign", back_populates="content_template")
    content_blocks = relationship("ContentBlock", secondary="template_blocks", back_populates="templates")

class ContentBlock(Base):
    __tablename__ = "content_blocks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Block content
    content = Column(Text, nullable=False)
    block_type = Column(String)  # header, footer, cta, paragraph, etc.
    
    # Block variables
    variables = Column(JSON, default=[])
    
    # Metadata
    tags = Column(JSON, default=[])
    category = Column(String)
    is_active = Column(Boolean, default=True)
    is_public = Column(Boolean, default=False)
    
    # User relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    templates = relationship("ContentTemplate", secondary="template_blocks", back_populates="content_blocks")

class MediaAsset(Base):
    __tablename__ = "media_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # File information
    file_url = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    file_size = Column(Integer)  # Size in bytes
    file_type = Column(String)  # MIME type
    media_type = Column(Enum(MediaType), default=MediaType.OTHER)
    
    # Image specific metadata
    width = Column(Integer)
    height = Column(Integer)
    
    # Video specific metadata
    duration = Column(Float)  # Duration in seconds
    
    # Organization
    folder = Column(String)
    tags = Column(JSON, default=[])
    
    # User relationship
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Usage tracking
    usage_count = Column(Integer, default=0)
    last_used_at = Column(DateTime(timezone=True))

# Association table for many-to-many relationship between templates and blocks
class TemplateBlock(Base):
    __tablename__ = "template_blocks"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("content_templates.id"), nullable=False)
    block_id = Column(Integer, ForeignKey("content_blocks.id"), nullable=False)
    position = Column(Integer, default=0)  # Order of blocks in template
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())