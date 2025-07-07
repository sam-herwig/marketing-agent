from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Dict, Any
from app.core.deps import get_current_user, get_db
from app.core.security import is_superuser
from app.models.user import User
from app.services.monitoring_service import MonitoringService, ErrorTracker
from prometheus_client import CONTENT_TYPE_LATEST

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Get system health status"""
    monitoring_service = MonitoringService(db)
    return await monitoring_service.get_system_health()


@router.get("/metrics/prometheus")
async def prometheus_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Prometheus metrics (requires superuser)"""
    if not is_superuser(current_user):
        return {"error": "Unauthorized"}
    
    monitoring_service = MonitoringService(db)
    metrics = monitoring_service.get_prometheus_metrics()
    
    return Response(content=metrics, media_type=CONTENT_TYPE_LATEST)


@router.get("/metrics/api")
async def api_metrics(
    hours: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get API performance metrics"""
    if not is_superuser(current_user):
        return {"error": "Unauthorized"}
    
    monitoring_service = MonitoringService(db)
    time_range = timedelta(hours=hours)
    return await monitoring_service.get_api_metrics(time_range)


@router.get("/metrics/campaigns")
async def campaign_metrics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get campaign execution metrics"""
    monitoring_service = MonitoringService(db)
    return await monitoring_service.get_campaign_metrics()


@router.get("/errors/stats")
async def error_statistics(
    hours: int = 1,
    current_user: User = Depends(get_current_user)
):
    """Get error statistics by category"""
    if not is_superuser(current_user):
        return {"error": "Unauthorized"}
    
    error_tracker = ErrorTracker()
    time_range = timedelta(hours=hours)
    return await error_tracker.get_error_stats(time_range)


@router.get("/dashboard")
async def monitoring_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive monitoring dashboard data"""
    if not is_superuser(current_user):
        return {"error": "Unauthorized"}
    
    monitoring_service = MonitoringService(db)
    error_tracker = ErrorTracker()
    
    # Gather all metrics
    health = await monitoring_service.get_system_health()
    api_metrics = await monitoring_service.get_api_metrics(timedelta(hours=1))
    campaign_metrics = await monitoring_service.get_campaign_metrics()
    error_stats = await error_tracker.get_error_stats(timedelta(hours=1))
    
    return {
        "health": health,
        "api_metrics": api_metrics,
        "campaign_metrics": campaign_metrics,
        "error_stats": error_stats
    }