from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
from pydantic import BaseModel
from app.models.database import get_db
from app.models.campaign import Campaign, CampaignStatus, CampaignExecution
from app.schemas.campaign import (
    CampaignResponse,
    CampaignCreate,
    CampaignUpdate,
    CampaignExecutionResponse
)
from app.core.deps import get_current_user
from app.models.user import User
from app.services.n8n_service import n8n_service
from app.services.image_generation import image_service
from app.services.instagram_service import instagram_service
from app.models.instagram import InstagramAccount, InstagramPost, InstagramPostStatus
from app.middleware.rate_limit import limiter, RateLimits

class ImageGenerationRequest(BaseModel):
    prompt: Optional[str] = None
    background_prompt: Optional[str] = None
    text_prompt: Optional[str] = None
    provider: str = "openai"
    use_split_prompts: bool = False

router = APIRouter()

@router.get("/", response_model=List[CampaignResponse])
@limiter.limit(RateLimits.API_DEFAULT)
async def get_campaigns(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: Optional[CampaignStatus] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Campaign).filter(Campaign.user_id == current_user.id)
    
    if status:
        query = query.filter(Campaign.status == status)
    
    campaigns = query.offset(skip).limit(limit).all()
    return campaigns

@router.post("/", response_model=CampaignResponse)
@limiter.limit(RateLimits.API_DEFAULT)
async def create_campaign(
    request: Request,
    campaign: CampaignCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_campaign = Campaign(
        **campaign.model_dump(),
        user_id=current_user.id
    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    return db_campaign

@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return campaign

@router.patch("/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    campaign_update: CampaignUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_data = campaign_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
    
    campaign.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(campaign)
    return campaign

@router.delete("/{campaign_id}")
async def delete_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign deleted successfully"}

@router.post("/{campaign_id}/execute")
async def execute_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.status != CampaignStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Campaign must be active to execute")
    
    # Create execution record
    execution = CampaignExecution(campaign_id=campaign_id)
    db.add(execution)
    db.commit()
    
    try:
        # Handle Instagram posting if configured
        if campaign.instagram_account_id and campaign.instagram_publish:
            # Get the Instagram account
            instagram_account = db.query(InstagramAccount).filter(
                InstagramAccount.id == campaign.instagram_account_id,
                InstagramAccount.user_id == current_user.id
            ).first()
            
            if instagram_account:
                # Refresh token if needed
                await instagram_service.refresh_token_if_needed(db, instagram_account)
                
                # Create Instagram post
                if campaign.image_url and campaign.instagram_caption:
                    # If scheduled, create scheduled post
                    if campaign.scheduled_at and campaign.scheduled_at > datetime.utcnow():
                        instagram_post = await instagram_service.schedule_post(
                            db=db,
                            account=instagram_account,
                            image_url=campaign.image_url,
                            caption=campaign.instagram_caption,
                            scheduled_time=campaign.scheduled_at,
                            campaign_id=campaign.id,
                            hashtags=campaign.instagram_hashtags or []
                        )
                        execution.result = {"instagram_post_id": instagram_post.id, "status": "scheduled"}
                    else:
                        # Publish immediately
                        result = await instagram_service.publish_image(
                            account=instagram_account,
                            image_url=campaign.image_url,
                            caption=campaign.instagram_caption,
                            hashtags=campaign.instagram_hashtags or []
                        )
                        
                        # Create post record
                        instagram_post = InstagramPost(
                            account_id=instagram_account.id,
                            campaign_id=campaign.id,
                            instagram_post_id=result.get("id"),
                            post_type="IMAGE",
                            caption=campaign.instagram_caption,
                            hashtags=campaign.instagram_hashtags or [],
                            media_urls=[campaign.image_url],
                            status=InstagramPostStatus.PUBLISHED,
                            published_at=datetime.utcnow()
                        )
                        db.add(instagram_post)
                        db.commit()
                        
                        execution.result = {"instagram_post_id": result.get("id"), "status": "published"}
        
        # Trigger n8n workflow if configured
        if campaign.workflow_id:
            workflow_data = {
                "campaign": {
                    "id": campaign.id,
                    "name": campaign.name,
                    "workflow_config": campaign.workflow_config or {}
                },
                "execution_id": execution.id,
                "webhook_id": campaign.workflow_id
            }
            
            result = await n8n_service.execute_workflow(campaign.workflow_id, workflow_data)
            
            if result:
                execution.workflow_execution_id = str(result.get("executionId", ""))
                execution.status = "running"
            else:
                execution.status = "failed"
                execution.error = "Failed to trigger workflow"
        else:
            execution.status = "completed"
            execution.completed_at = datetime.utcnow()
        
        db.commit()
        
    except Exception as e:
        execution.status = "failed"
        execution.error = str(e)
        execution.completed_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Campaign execution failed: {str(e)}")
    
    return {"message": "Campaign execution started", "execution_id": execution.id}

@router.get("/{campaign_id}/executions", response_model=List[CampaignExecutionResponse])
async def get_campaign_executions(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    executions = db.query(CampaignExecution).filter(
        CampaignExecution.campaign_id == campaign_id
    ).order_by(CampaignExecution.started_at.desc()).all()
    
    return executions

@router.get("/workflows")
async def get_available_workflows(
    current_user: User = Depends(get_current_user)
):
    """Get available n8n workflows"""
    workflows = await n8n_service.get_workflows()
    
    # Filter to show only active workflows
    active_workflows = [w for w in workflows if w.get("active", False)]
    
    # Add our predefined workflow templates
    templates = [
        {
            "id": "instagram-campaign",
            "name": "Instagram Marketing Post",
            "description": "Post content to Instagram with image and caption",
            "type": "template"
        },
        {
            "id": "stripe-discount",
            "name": "Stripe Discount Code",
            "description": "Generate and create discount codes in Stripe",
            "type": "template"
        },
        {
            "id": "email-campaign",
            "name": "Email Campaign",
            "description": "Send marketing emails to subscribers",
            "type": "template"
        }
    ]
    
    return {
        "workflows": active_workflows,
        "templates": templates
    }

@router.post("/{campaign_id}/log")
async def log_campaign_status(
    campaign_id: int,
    status: str,
    message: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Log status updates from n8n workflows"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Update latest execution
    execution = db.query(CampaignExecution).filter(
        CampaignExecution.campaign_id == campaign_id
    ).order_by(CampaignExecution.started_at.desc()).first()
    
    if execution:
        execution.status = status
        if message:
            execution.result = {"message": message}
        db.commit()
    
    return {"status": "logged"}

@router.post("/{campaign_id}/complete")
async def complete_campaign_execution(
    campaign_id: int,
    status: str,
    result: Optional[Dict] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark campaign execution as complete"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Update latest execution
    execution = db.query(CampaignExecution).filter(
        CampaignExecution.campaign_id == campaign_id
    ).order_by(CampaignExecution.started_at.desc()).first()
    
    if execution:
        execution.status = status
        execution.completed_at = datetime.utcnow()
        if result:
            execution.result = result
        
        # Update campaign last execution time
        campaign.executed_at = datetime.utcnow()
        
        db.commit()
    
    return {"status": "completed"}

@router.post("/{campaign_id}/generate-image")
async def generate_campaign_image(
    campaign_id: int,
    request: ImageGenerationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate an AI image for the campaign"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Generate image based on split prompts or single prompt
    if request.use_split_prompts and request.background_prompt and request.text_prompt:
        # Ensure text prompt ends with the required styling
        if not request.text_prompt.endswith("Bold white sans-serif font, centered"):
            request.text_prompt += ". Bold white sans-serif font, centered"
        
        image_url = await image_service.generate_image_with_split_prompts(
            request.background_prompt,
            request.text_prompt,
            request.provider
        )
        prompt_used = f"Background: {request.background_prompt} | Text: {request.text_prompt}"
    elif request.prompt:
        # Use single prompt (backward compatible)
        image_url = await image_service.generate_image(request.prompt, request.provider)
        prompt_used = request.prompt
    else:
        raise HTTPException(status_code=400, detail="Either prompt or both background_prompt and text_prompt must be provided")
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to generate image")
    
    # Save image URL to campaign
    campaign.image_url = image_url
    campaign.content = campaign.content or {}
    campaign.content["image_prompt"] = prompt_used
    campaign.content["image_provider"] = request.provider
    campaign.content["use_split_prompts"] = request.use_split_prompts
    if request.use_split_prompts:
        campaign.content["background_prompt"] = request.background_prompt
        campaign.content["text_prompt"] = request.text_prompt
    
    db.commit()
    
    return {
        "image_url": image_url,
        "prompt": prompt_used,
        "provider": request.provider,
        "use_split_prompts": request.use_split_prompts,
        "background_prompt": request.background_prompt if request.use_split_prompts else None,
        "text_prompt": request.text_prompt if request.use_split_prompts else None
    }

@router.post("/generate-image")
async def generate_image(
    request: ImageGenerationRequest,
    current_user: User = Depends(get_current_user)
):
    """Generate an AI image without associating it with a campaign"""
    # Generate image based on split prompts or single prompt
    if request.use_split_prompts and request.background_prompt and request.text_prompt:
        # Ensure text prompt ends with the required styling
        if not request.text_prompt.endswith("Bold white sans-serif font, centered"):
            request.text_prompt += ". Bold white sans-serif font, centered"
        
        image_url = await image_service.generate_image_with_split_prompts(
            request.background_prompt,
            request.text_prompt,
            request.provider
        )
        prompt_used = f"Background: {request.background_prompt} | Text: {request.text_prompt}"
    elif request.prompt:
        # Use single prompt (backward compatible)
        image_url = await image_service.generate_image(request.prompt, request.provider)
        prompt_used = request.prompt
    else:
        raise HTTPException(status_code=400, detail="Either prompt or both background_prompt and text_prompt must be provided")
    
    if not image_url:
        raise HTTPException(status_code=500, detail="Failed to generate image")
    
    return {
        "image_url": image_url,
        "prompt": prompt_used,
        "provider": request.provider,
        "use_split_prompts": request.use_split_prompts,
        "background_prompt": request.background_prompt if request.use_split_prompts else None,
        "text_prompt": request.text_prompt if request.use_split_prompts else None
    }