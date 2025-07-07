from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.models.campaign import Campaign, CampaignExecution, CampaignStatus, TriggerType
from app.services.campaign_scheduler import campaign_scheduler, TriggerConfigurationService
from app.schemas.scheduling import (
    ScheduleCampaignRequest, TriggerConfigResponse,
    ScheduledCampaignResponse, TriggerValidationResponse,
    ConflictCheckResponse, ExecutionHistoryResponse
)
import logging

router = APIRouter(prefix="/scheduling", tags=["scheduling"])
logger = logging.getLogger(__name__)


@router.post("/campaigns/{campaign_id}/schedule")
async def schedule_campaign(
    campaign_id: int,
    request: ScheduleCampaignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a campaign with specified trigger configuration"""
    # Get campaign and verify ownership
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Validate trigger configuration
    validation_errors = TriggerConfigurationService.validate_trigger_config(request.trigger_config)
    if validation_errors:
        raise HTTPException(status_code=400, detail={"errors": validation_errors})
    
    # Check for conflicts
    conflicts = campaign_scheduler.check_scheduling_conflicts(campaign_id, request.trigger_config)
    if conflicts and not request.force:
        raise HTTPException(status_code=409, detail={"conflicts": conflicts})
    
    # Update campaign with trigger configuration
    campaign.trigger_type = TriggerType(request.trigger_config["type"])
    campaign.trigger_config = request.trigger_config
    campaign.status = CampaignStatus.ACTIVE if request.activate else campaign.status
    
    # Store full configuration
    if not campaign.config:
        campaign.config = {}
    campaign.config["trigger"] = request.trigger_config
    
    db.commit()
    db.refresh(campaign)
    
    # Schedule the campaign
    job_id = await campaign_scheduler.schedule_campaign(campaign, request.trigger_config)
    
    return {
        "message": "Campaign scheduled successfully",
        "campaign_id": campaign_id,
        "job_id": job_id,
        "trigger_type": request.trigger_config["type"]
    }


@router.delete("/campaigns/{campaign_id}/schedule")
async def unschedule_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a campaign from schedule"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Unschedule the campaign
    campaign_scheduler.unschedule_campaign(campaign_id)
    
    # Update campaign status
    if campaign.status == CampaignStatus.ACTIVE and \
       campaign.trigger_type != TriggerType.MANUAL:
        campaign.status = CampaignStatus.PAUSED
        db.commit()
    
    return {"message": "Campaign unscheduled successfully"}


@router.get("/campaigns/scheduled", response_model=List[ScheduledCampaignResponse])
async def get_scheduled_campaigns(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all scheduled campaigns for the current user"""
    # Get user's campaigns
    user_campaigns = db.query(Campaign).filter(
        Campaign.user_id == current_user.id,
        Campaign.status.in_([CampaignStatus.ACTIVE, CampaignStatus.SCHEDULED])
    ).all()
    
    # Get scheduled jobs
    scheduled_jobs = campaign_scheduler.get_scheduled_campaigns()
    job_map = {job["campaign_id"]: job for job in scheduled_jobs}
    
    scheduled_campaigns = []
    for campaign in user_campaigns:
        if campaign.id in job_map:
            job_info = job_map[campaign.id]
            scheduled_campaigns.append({
                "id": campaign.id,
                "name": campaign.name,
                "status": campaign.status,
                "trigger_type": campaign.trigger_type,
                "trigger_config": campaign.trigger_config,
                "next_run_time": job_info["next_run_time"],
                "job_id": job_info["job_id"]
            })
    
    return scheduled_campaigns


@router.post("/triggers/validate", response_model=TriggerValidationResponse)
async def validate_trigger_config(
    trigger_config: Dict[str, Any],
    current_user: User = Depends(get_current_user)
):
    """Validate a trigger configuration"""
    errors = TriggerConfigurationService.validate_trigger_config(trigger_config)
    
    return {
        "valid": len(errors) == 0,
        "errors": errors
    }


@router.post("/triggers/manual", response_model=TriggerConfigResponse)
async def create_manual_trigger(
    current_user: User = Depends(get_current_user)
):
    """Create a manual trigger configuration"""
    config = TriggerConfigurationService.create_manual_trigger()
    return {"config": config}


@router.post("/triggers/scheduled", response_model=TriggerConfigResponse)
async def create_scheduled_trigger(
    run_at: datetime,
    current_user: User = Depends(get_current_user)
):
    """Create a one-time scheduled trigger"""
    if run_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="Scheduled time must be in the future")
    
    config = TriggerConfigurationService.create_scheduled_trigger(run_at)
    return {"config": config}


@router.post("/triggers/recurring", response_model=TriggerConfigResponse)
async def create_recurring_trigger(
    interval_type: str,
    interval_value: int,
    start_date: datetime = None,
    end_date: datetime = None,
    current_user: User = Depends(get_current_user)
):
    """Create a recurring trigger configuration"""
    if interval_type not in ["minutes", "hours", "days", "weeks"]:
        raise HTTPException(status_code=400, detail="Invalid interval type")
    
    if interval_value <= 0:
        raise HTTPException(status_code=400, detail="Interval value must be positive")
    
    config = TriggerConfigurationService.create_recurring_trigger(
        interval_type, interval_value, start_date, end_date
    )
    return {"config": config}


@router.post("/triggers/cron", response_model=TriggerConfigResponse)
async def create_cron_trigger(
    cron_expression: str,
    current_user: User = Depends(get_current_user)
):
    """Create a cron-based recurring trigger"""
    try:
        # Validate cron expression
        from apscheduler.triggers.cron import CronTrigger
        CronTrigger.from_crontab(cron_expression)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid cron expression: {str(e)}")
    
    config = TriggerConfigurationService.create_cron_trigger(cron_expression)
    return {"config": config}


@router.post("/triggers/event", response_model=TriggerConfigResponse)
async def create_event_trigger(
    event_name: str,
    webhook_url: str = None,
    current_user: User = Depends(get_current_user)
):
    """Create an event-based trigger"""
    config = TriggerConfigurationService.create_event_trigger(event_name, webhook_url)
    return {"config": config}


@router.post("/triggers/conditional", response_model=TriggerConfigResponse)
async def create_conditional_trigger(
    conditions: List[Dict[str, Any]],
    current_user: User = Depends(get_current_user)
):
    """Create a condition-based trigger"""
    if not conditions:
        raise HTTPException(status_code=400, detail="At least one condition is required")
    
    config = TriggerConfigurationService.create_conditional_trigger(conditions)
    return {"config": config}


@router.post("/campaigns/{campaign_id}/conflicts", response_model=ConflictCheckResponse)
async def check_scheduling_conflicts(
    campaign_id: int,
    trigger_config: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check for scheduling conflicts"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    conflicts = campaign_scheduler.check_scheduling_conflicts(campaign_id, trigger_config)
    
    return {
        "has_conflicts": len(conflicts) > 0,
        "conflicts": conflicts
    }


@router.get("/campaigns/{campaign_id}/executions", response_model=List[ExecutionHistoryResponse])
async def get_campaign_executions(
    campaign_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get execution history for a campaign"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    executions = db.query(CampaignExecution).filter(
        CampaignExecution.campaign_id == campaign_id
    ).order_by(CampaignExecution.started_at.desc()).limit(limit).all()
    
    return [
        {
            "id": execution.id,
            "status": execution.status,
            "triggered_by": execution.triggered_by,
            "started_at": execution.started_at,
            "completed_at": execution.completed_at,
            "result_summary": execution.result_summary,
            "error_message": execution.error_message
        }
        for execution in executions
    ]


@router.post("/campaigns/{campaign_id}/execute")
async def execute_campaign_manually(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually execute a campaign"""
    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id,
        Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Create execution record
    execution = CampaignExecution(
        campaign_id=campaign_id,
        triggered_by="manual",
        status="pending",
        metadata={"triggered_by_user": current_user.id}
    )
    db.add(execution)
    db.commit()
    db.refresh(execution)
    
    # Trigger execution asynchronously
    trigger_config = {"type": TriggerType.MANUAL.value}
    await campaign_scheduler._execute_campaign(campaign_id, trigger_config)
    
    return {
        "message": "Campaign execution started",
        "execution_id": execution.id
    }