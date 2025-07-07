from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl
from app.models.cms import ContentType, MediaType

# Variable Schema
class TemplateVariable(BaseModel):
    name: str
    description: Optional[str] = None
    default: Optional[str] = ""
    required: bool = False

# Content Template Schemas
class ContentTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    content_type: ContentType = ContentType.GENERAL
    subject: Optional[str] = None
    content: str
    preview_text: Optional[str] = None
    variables: List[TemplateVariable] = []
    tags: List[str] = []
    category: Optional[str] = None
    is_active: bool = True
    is_public: bool = False

class ContentTemplateCreate(ContentTemplateBase):
    pass

class ContentTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content_type: Optional[ContentType] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    preview_text: Optional[str] = None
    variables: Optional[List[TemplateVariable]] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None

class ContentTemplate(ContentTemplateBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Content Block Schemas
class ContentBlockBase(BaseModel):
    name: str
    description: Optional[str] = None
    content: str
    block_type: Optional[str] = None
    variables: List[TemplateVariable] = []
    tags: List[str] = []
    category: Optional[str] = None
    is_active: bool = True
    is_public: bool = False

class ContentBlockCreate(ContentBlockBase):
    pass

class ContentBlockUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    block_type: Optional[str] = None
    variables: Optional[List[TemplateVariable]] = None
    tags: Optional[List[str]] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None

class ContentBlock(ContentBlockBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Media Asset Schemas
class MediaAssetBase(BaseModel):
    name: str
    description: Optional[str] = None
    file_url: str
    file_name: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    media_type: MediaType = MediaType.OTHER
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    folder: Optional[str] = None
    tags: List[str] = []

class MediaAssetCreate(MediaAssetBase):
    pass

class MediaAssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[List[str]] = None

class MediaAsset(MediaAssetBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# Template Block Association
class TemplateBlockAssociation(BaseModel):
    template_id: int
    block_id: int
    position: int = 0

# Template with Blocks
class ContentTemplateWithBlocks(ContentTemplate):
    content_blocks: List[ContentBlock] = []

# Template Preview Request
class TemplatePreviewRequest(BaseModel):
    template_id: Optional[int] = None
    content: Optional[str] = None
    variables: Dict[str, Any] = {}

# Template Preview Response
class TemplatePreviewResponse(BaseModel):
    rendered_content: str
    missing_variables: List[str] = []

# Media Upload Response
class MediaUploadResponse(BaseModel):
    id: int
    file_url: str
    file_name: str
    file_size: int
    media_type: MediaType

# Campaign Template Update
class CampaignTemplateUpdate(BaseModel):
    content_template_id: Optional[int] = None
    template_variables: Dict[str, Any] = {}