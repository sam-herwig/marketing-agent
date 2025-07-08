from fastapi import APIRouter, HTTPException, Depends, Response
from typing import List, Optional
from pydantic import BaseModel, Field
from app.services.text_overlay import text_overlay_service, TextConfig
from app.core.deps import get_current_user, get_db
from app.models.user import User
import base64
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class TextOverlayRequest(BaseModel):
    """Request model for text overlay"""
    text: str = Field(..., description="Text to overlay on image")
    position: tuple[int, int] = Field((50, 50), description="X, Y coordinates for text position")
    font_size: int = Field(48, description="Font size in pixels")
    font_color: str = Field("#FFFFFF", description="Font color in hex format")
    font_style: str = Field("bold", description="Font style: regular or bold")
    alignment: str = Field("left", description="Text alignment: left, center, or right")
    shadow: bool = Field(True, description="Add shadow to text")
    shadow_color: str = Field("#000000", description="Shadow color in hex format")
    shadow_offset: tuple[int, int] = Field((2, 2), description="Shadow offset in pixels")
    outline: bool = Field(False, description="Add outline to text")
    outline_color: str = Field("#000000", description="Outline color in hex format")
    outline_width: int = Field(2, description="Outline width in pixels")
    background_box: bool = Field(False, description="Add background box behind text")
    background_color: str = Field("#000000", description="Background color in hex format")
    background_opacity: int = Field(128, description="Background opacity (0-255)")

class AddTextOverlayRequest(BaseModel):
    """Request model for adding text overlay to image"""
    image_url: str = Field(..., description="URL of the base image")
    text_overlays: List[TextOverlayRequest] = Field(..., description="List of text overlays to add")

class MarketingTextRequest(BaseModel):
    """Request model for marketing text overlay"""
    image_url: str = Field(..., description="URL of the base image")
    headline: str = Field(..., description="Main headline text")
    subtext: Optional[str] = Field(None, description="Optional subtitle text")
    cta: Optional[str] = Field(None, description="Optional call-to-action text")

@router.post("/text-overlay")
async def add_text_overlay(
    request: AddTextOverlayRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Add text overlay to an image
    
    This endpoint takes an image URL and applies one or more text overlays
    with customizable styling options.
    """
    try:
        # Convert request models to TextConfig objects
        text_configs = []
        for overlay in request.text_overlays:
            config = TextConfig(
                text=overlay.text,
                position=overlay.position,
                font_size=overlay.font_size,
                font_color=overlay.font_color,
                font_style=overlay.font_style,
                alignment=overlay.alignment,
                shadow=overlay.shadow,
                shadow_color=overlay.shadow_color,
                shadow_offset=overlay.shadow_offset,
                outline=overlay.outline,
                outline_color=overlay.outline_color,
                outline_width=overlay.outline_width,
                background_box=overlay.background_box,
                background_color=overlay.background_color,
                background_opacity=overlay.background_opacity
            )
            text_configs.append(config)
        
        # Process image
        processed_image = text_overlay_service.add_text_overlay(
            request.image_url,
            text_configs
        )
        
        # Return image as base64 encoded string
        base64_image = base64.b64encode(processed_image).decode('utf-8')
        
        return {
            "success": True,
            "image_data": f"data:image/png;base64,{base64_image}",
            "message": "Text overlay added successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to add text overlay: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/text-overlay/marketing")
async def add_marketing_text(
    request: MarketingTextRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Add marketing-specific text overlay to an image
    
    This endpoint provides a simplified interface for common marketing
    text layouts with headline, subtext, and CTA.
    """
    try:
        # Process image with marketing layout
        processed_image = text_overlay_service.add_marketing_text(
            request.image_url,
            request.headline,
            request.subtext,
            request.cta
        )
        
        # Return image as base64 encoded string
        base64_image = base64.b64encode(processed_image).decode('utf-8')
        
        return {
            "success": True,
            "image_data": f"data:image/png;base64,{base64_image}",
            "message": "Marketing text overlay added successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to add marketing text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/text-overlay/styles")
async def get_text_styles(
    current_user: User = Depends(get_current_user)
):
    """
    Get available text style presets
    
    Returns predefined text styles for common use cases like
    headlines, body text, CTAs, etc.
    """
    return {
        "styles": text_overlay_service.create_text_styles()
    }

@router.post("/text-overlay/preview")
async def preview_text_overlay(
    request: AddTextOverlayRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Preview text overlay without saving
    
    This endpoint is useful for real-time preview in the frontend
    without creating permanent images.
    """
    try:
        # Convert request models to TextConfig objects
        text_configs = []
        for overlay in request.text_overlays:
            config = TextConfig(
                text=overlay.text,
                position=overlay.position,
                font_size=overlay.font_size,
                font_color=overlay.font_color,
                font_style=overlay.font_style,
                alignment=overlay.alignment,
                shadow=overlay.shadow,
                shadow_color=overlay.shadow_color,
                shadow_offset=overlay.shadow_offset,
                outline=overlay.outline,
                outline_color=overlay.outline_color,
                outline_width=overlay.outline_width,
                background_box=overlay.background_box,
                background_color=overlay.background_color,
                background_opacity=overlay.background_opacity
            )
            text_configs.append(config)
        
        # Process image
        processed_image = text_overlay_service.add_text_overlay(
            request.image_url,
            text_configs
        )
        
        # Return as raw image response
        return Response(
            content=processed_image,
            media_type="image/png",
            headers={
                "Cache-Control": "no-cache",
                "Content-Disposition": "inline; filename=preview.png"
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to preview text overlay: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))