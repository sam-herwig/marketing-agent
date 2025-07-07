from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Dict
from datetime import datetime
from app.models.database import get_db
from app.models.campaign import Campaign, CampaignExecution
from fastapi import Depends

router = APIRouter()

@router.post("/campaigns/{campaign_id}/log")
async def log_campaign_status(
    campaign_id: int,
    status: str,
    message: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Log status updates from n8n workflows - No auth required for internal use"""
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

@router.post("/campaigns/{campaign_id}/complete")
async def complete_campaign_execution(
    campaign_id: int,
    status: str,
    result: Optional[Dict] = None,
    db: Session = Depends(get_db)
):
    """Mark campaign execution as complete - No auth required for internal use"""
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