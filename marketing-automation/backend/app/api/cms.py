from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
import os
import uuid
from datetime import datetime
import re

from app.core.deps import get_db, get_current_user
from app.models import User, ContentTemplate, ContentBlock, MediaAsset, TemplateBlock
from app.schemas.cms import (
    ContentTemplateCreate,
    ContentTemplateUpdate,
    ContentTemplate as ContentTemplateResponse,
    ContentTemplateWithBlocks,
    ContentBlockCreate,
    ContentBlockUpdate,
    ContentBlock as ContentBlockResponse,
    MediaAssetCreate,
    MediaAssetUpdate,
    MediaAsset as MediaAssetResponse,
    MediaUploadResponse,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateBlockAssociation
)

router = APIRouter()

# Utility function to render template with variables
def render_template_content(content: str, variables: dict) -> tuple[str, list]:
    """Replace template variables with actual values."""
    missing_vars = []
    rendered = content
    
    # Find all variables in the format {{variable_name}}
    variable_pattern = r'\{\{(\w+)\}\}'
    found_vars = re.findall(variable_pattern, content)
    
    for var in found_vars:
        if var in variables:
            rendered = rendered.replace(f"{{{{{var}}}}}", str(variables[var]))
        else:
            missing_vars.append(var)
    
    return rendered, missing_vars

# Content Template endpoints
@router.get("/templates", response_model=List[ContentTemplateResponse])
async def get_templates(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category: Optional[str] = None,
    tags: Optional[List[str]] = None,
    include_public: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all content templates for the current user."""
    query = db.query(ContentTemplate)
    
    # Filter by user or public templates
    if include_public:
        query = query.filter(
            or_(
                ContentTemplate.user_id == current_user.id,
                ContentTemplate.is_public == True
            )
        )
    else:
        query = query.filter(ContentTemplate.user_id == current_user.id)
    
    # Search filter
    if search:
        query = query.filter(
            or_(
                ContentTemplate.name.ilike(f"%{search}%"),
                ContentTemplate.description.ilike(f"%{search}%")
            )
        )
    
    # Category filter
    if category:
        query = query.filter(ContentTemplate.category == category)
    
    # Tags filter - templates that have any of the specified tags
    if tags:
        for tag in tags:
            query = query.filter(ContentTemplate.tags.contains([tag]))
    
    # Active only
    query = query.filter(ContentTemplate.is_active == True)
    
    templates = query.offset(skip).limit(limit).all()
    return templates

@router.post("/templates", response_model=ContentTemplateResponse)
async def create_template(
    template: ContentTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new content template."""
    db_template = ContentTemplate(
        **template.dict(),
        user_id=current_user.id
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/templates/{template_id}", response_model=ContentTemplateWithBlocks)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific template with its content blocks."""
    template = db.query(ContentTemplate).options(
        joinedload(ContentTemplate.content_blocks)
    ).filter(
        ContentTemplate.id == template_id,
        or_(
            ContentTemplate.user_id == current_user.id,
            ContentTemplate.is_public == True
        )
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template

@router.put("/templates/{template_id}", response_model=ContentTemplateResponse)
async def update_template(
    template_id: int,
    template_update: ContentTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a content template."""
    template = db.query(ContentTemplate).filter(
        ContentTemplate.id == template_id,
        ContentTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)
    
    template.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(template)
    return template

@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a content template."""
    template = db.query(ContentTemplate).filter(
        ContentTemplate.id == template_id,
        ContentTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return {"message": "Template deleted successfully"}

# Content Block endpoints
@router.get("/blocks", response_model=List[ContentBlockResponse])
async def get_blocks(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    block_type: Optional[str] = None,
    category: Optional[str] = None,
    include_public: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all content blocks for the current user."""
    query = db.query(ContentBlock)
    
    # Filter by user or public blocks
    if include_public:
        query = query.filter(
            or_(
                ContentBlock.user_id == current_user.id,
                ContentBlock.is_public == True
            )
        )
    else:
        query = query.filter(ContentBlock.user_id == current_user.id)
    
    # Search filter
    if search:
        query = query.filter(
            or_(
                ContentBlock.name.ilike(f"%{search}%"),
                ContentBlock.description.ilike(f"%{search}%")
            )
        )
    
    # Block type filter
    if block_type:
        query = query.filter(ContentBlock.block_type == block_type)
    
    # Category filter
    if category:
        query = query.filter(ContentBlock.category == category)
    
    # Active only
    query = query.filter(ContentBlock.is_active == True)
    
    blocks = query.offset(skip).limit(limit).all()
    return blocks

@router.post("/blocks", response_model=ContentBlockResponse)
async def create_block(
    block: ContentBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new content block."""
    db_block = ContentBlock(
        **block.dict(),
        user_id=current_user.id
    )
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return db_block

@router.put("/blocks/{block_id}", response_model=ContentBlockResponse)
async def update_block(
    block_id: int,
    block_update: ContentBlockUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a content block."""
    block = db.query(ContentBlock).filter(
        ContentBlock.id == block_id,
        ContentBlock.user_id == current_user.id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    update_data = block_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)
    
    block.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(block)
    return block

@router.delete("/blocks/{block_id}")
async def delete_block(
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a content block."""
    block = db.query(ContentBlock).filter(
        ContentBlock.id == block_id,
        ContentBlock.user_id == current_user.id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    db.delete(block)
    db.commit()
    return {"message": "Block deleted successfully"}

# Template-Block associations
@router.post("/templates/{template_id}/blocks")
async def add_block_to_template(
    template_id: int,
    association: TemplateBlockAssociation,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a content block to a template."""
    # Verify template ownership
    template = db.query(ContentTemplate).filter(
        ContentTemplate.id == template_id,
        ContentTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Verify block exists and is accessible
    block = db.query(ContentBlock).filter(
        ContentBlock.id == association.block_id,
        or_(
            ContentBlock.user_id == current_user.id,
            ContentBlock.is_public == True
        )
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    
    # Create association
    db_association = TemplateBlock(
        template_id=template_id,
        block_id=association.block_id,
        position=association.position
    )
    db.add(db_association)
    db.commit()
    
    return {"message": "Block added to template successfully"}

@router.delete("/templates/{template_id}/blocks/{block_id}")
async def remove_block_from_template(
    template_id: int,
    block_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a content block from a template."""
    # Verify template ownership
    template = db.query(ContentTemplate).filter(
        ContentTemplate.id == template_id,
        ContentTemplate.user_id == current_user.id
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Find and remove association
    association = db.query(TemplateBlock).filter(
        TemplateBlock.template_id == template_id,
        TemplateBlock.block_id == block_id
    ).first()
    
    if not association:
        raise HTTPException(status_code=404, detail="Block not found in template")
    
    db.delete(association)
    db.commit()
    
    return {"message": "Block removed from template successfully"}

# Media Asset endpoints
@router.get("/media", response_model=List[MediaAssetResponse])
async def get_media_assets(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    media_type: Optional[str] = None,
    folder: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all media assets for the current user."""
    query = db.query(MediaAsset).filter(MediaAsset.user_id == current_user.id)
    
    # Search filter
    if search:
        query = query.filter(
            or_(
                MediaAsset.name.ilike(f"%{search}%"),
                MediaAsset.description.ilike(f"%{search}%")
            )
        )
    
    # Media type filter
    if media_type:
        query = query.filter(MediaAsset.media_type == media_type)
    
    # Folder filter
    if folder:
        query = query.filter(MediaAsset.folder == folder)
    
    assets = query.order_by(MediaAsset.created_at.desc()).offset(skip).limit(limit).all()
    return assets

@router.post("/media/upload", response_model=MediaUploadResponse)
async def upload_media(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    folder: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated tags
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a media asset."""
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # In a real implementation, you would upload to S3 or similar
    # For now, we'll simulate with a local path
    file_url = f"/media/{current_user.id}/{unique_filename}"
    
    # Determine media type from MIME type
    media_type = "other"
    if file.content_type.startswith("image/"):
        media_type = "image"
    elif file.content_type.startswith("video/"):
        media_type = "video"
    elif file.content_type.startswith("audio/"):
        media_type = "audio"
    elif file.content_type in ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
        media_type = "document"
    
    # Parse tags
    tag_list = []
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",") if tag.strip()]
    
    # Create media asset record
    db_asset = MediaAsset(
        name=name or file.filename,
        description=description,
        file_url=file_url,
        file_name=file.filename,
        file_size=file.size,
        file_type=file.content_type,
        media_type=media_type,
        folder=folder,
        tags=tag_list,
        user_id=current_user.id
    )
    
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    
    return MediaUploadResponse(
        id=db_asset.id,
        file_url=db_asset.file_url,
        file_name=db_asset.file_name,
        file_size=db_asset.file_size,
        media_type=db_asset.media_type
    )

@router.put("/media/{asset_id}", response_model=MediaAssetResponse)
async def update_media_asset(
    asset_id: int,
    asset_update: MediaAssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a media asset's metadata."""
    asset = db.query(MediaAsset).filter(
        MediaAsset.id == asset_id,
        MediaAsset.user_id == current_user.id
    ).first()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")
    
    update_data = asset_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(asset, field, value)
    
    asset.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(asset)
    return asset

@router.delete("/media/{asset_id}")
async def delete_media_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a media asset."""
    asset = db.query(MediaAsset).filter(
        MediaAsset.id == asset_id,
        MediaAsset.user_id == current_user.id
    ).first()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Media asset not found")
    
    # In a real implementation, you would also delete the file from storage
    db.delete(asset)
    db.commit()
    
    return {"message": "Media asset deleted successfully"}

# Template preview endpoint
@router.post("/templates/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    preview_request: TemplatePreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Preview a template with variable substitution."""
    content = preview_request.content
    
    # If template_id is provided, fetch the template content
    if preview_request.template_id:
        template = db.query(ContentTemplate).filter(
            ContentTemplate.id == preview_request.template_id,
            or_(
                ContentTemplate.user_id == current_user.id,
                ContentTemplate.is_public == True
            )
        ).first()
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        content = template.content
    
    if not content:
        raise HTTPException(status_code=400, detail="No content provided for preview")
    
    # Render the template
    rendered_content, missing_vars = render_template_content(content, preview_request.variables)
    
    return TemplatePreviewResponse(
        rendered_content=rendered_content,
        missing_variables=missing_vars
    )