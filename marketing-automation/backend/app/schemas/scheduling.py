from pydantic import BaseModel
from typing import Dict, Any, List, Optional
from datetime import datetime
from app.models.campaign import CampaignStatus, TriggerType


class ScheduleCampaignRequest(BaseModel):
    trigger_config: Dict[str, Any]
    activate: bool = True
    force: bool = False  # Force scheduling even with conflicts


class TriggerConfigResponse(BaseModel):
    config: Dict[str, Any]


class ScheduledCampaignResponse(BaseModel):
    id: int
    name: str
    status: CampaignStatus
    trigger_type: TriggerType
    trigger_config: Dict[str, Any]
    next_run_time: Optional[str]
    job_id: Optional[str]


class TriggerValidationResponse(BaseModel):
    valid: bool
    errors: List[str]


class ConflictCheckResponse(BaseModel):
    has_conflicts: bool
    conflicts: List[str]


class ExecutionHistoryResponse(BaseModel):
    id: int
    status: str
    triggered_by: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    result_summary: Optional[Dict[str, Any]]
    error_message: Optional[str]