from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.models.database import SessionLocal, engine
from app.models.campaign import Campaign, CampaignExecution, CampaignStatus, TriggerType
from app.models.user import User
from app.core.config import settings
from app.services.monitoring_service import ErrorTracker
import pytz
import logging
import json

logger = logging.getLogger(__name__)


class CampaignScheduler:
    """Advanced campaign scheduling system with APScheduler"""
    
    def __init__(self):
        # Configure job stores
        jobstores = {
            'default': SQLAlchemyJobStore(engine=engine)
        }
        
        # Configure scheduler
        self.scheduler = AsyncIOScheduler(
            jobstores=jobstores,
            timezone=pytz.timezone(settings.SCHEDULER_TIMEZONE),
            job_defaults=settings.SCHEDULER_JOB_DEFAULTS
        )
        
        # Add event listeners
        self.scheduler.add_listener(self._job_executed, EVENT_JOB_EXECUTED)
        self.scheduler.add_listener(self._job_error, EVENT_JOB_ERROR)
        
        self.error_tracker = ErrorTracker()
    
    def start(self):
        """Start the scheduler"""
        self.scheduler.start()
        logger.info("Campaign scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("Campaign scheduler stopped")
    
    async def schedule_campaign(
        self,
        campaign: Campaign,
        trigger_config: Dict[str, Any]
    ) -> str:
        """Schedule a campaign based on trigger configuration"""
        job_id = f"campaign_{campaign.id}"
        
        # Remove existing job if any
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
        
        # Create trigger based on type
        trigger_type = TriggerType(trigger_config.get("type"))
        
        if trigger_type == TriggerType.MANUAL:
            # Manual triggers don't need scheduling
            return None
        
        elif trigger_type == TriggerType.SCHEDULED:
            # One-time scheduled execution
            run_at = datetime.fromisoformat(trigger_config.get("run_at"))
            trigger = DateTrigger(run_date=run_at)
        
        elif trigger_type == TriggerType.RECURRING:
            # Recurring execution
            interval_type = trigger_config.get("interval_type")
            interval_value = trigger_config.get("interval_value", 1)
            
            if interval_type == "minutes":
                trigger = IntervalTrigger(minutes=interval_value)
            elif interval_type == "hours":
                trigger = IntervalTrigger(hours=interval_value)
            elif interval_type == "days":
                trigger = IntervalTrigger(days=interval_value)
            elif interval_type == "weeks":
                trigger = IntervalTrigger(weeks=interval_value)
            elif interval_type == "cron":
                # Advanced cron expression
                cron_expr = trigger_config.get("cron_expression")
                trigger = CronTrigger.from_crontab(cron_expr)
            else:
                raise ValueError(f"Invalid interval type: {interval_type}")
        
        elif trigger_type == TriggerType.EVENT:
            # Event-based triggers are handled separately
            return None
        
        elif trigger_type == TriggerType.CONDITION:
            # Condition-based triggers need periodic checking
            trigger = IntervalTrigger(minutes=5)  # Check every 5 minutes
        
        else:
            raise ValueError(f"Invalid trigger type: {trigger_type}")
        
        # Add job to scheduler
        self.scheduler.add_job(
            self._execute_campaign,
            trigger=trigger,
            id=job_id,
            args=[campaign.id, trigger_config],
            replace_existing=True,
            max_instances=1,
            coalesce=True
        )
        
        logger.info(f"Scheduled campaign {campaign.id} with trigger type {trigger_type}")
        return job_id
    
    def unschedule_campaign(self, campaign_id: int):
        """Remove a campaign from schedule"""
        job_id = f"campaign_{campaign_id}"
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
            logger.info(f"Unscheduled campaign {campaign_id}")
    
    def get_scheduled_campaigns(self) -> List[Dict[str, Any]]:
        """Get all scheduled campaigns"""
        jobs = self.scheduler.get_jobs()
        scheduled_campaigns = []
        
        for job in jobs:
            if job.id.startswith("campaign_"):
                campaign_id = int(job.id.split("_")[1])
                scheduled_campaigns.append({
                    "campaign_id": campaign_id,
                    "job_id": job.id,
                    "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
                    "trigger": str(job.trigger)
                })
        
        return scheduled_campaigns
    
    def check_scheduling_conflicts(
        self,
        campaign_id: int,
        trigger_config: Dict[str, Any]
    ) -> List[str]:
        """Check for potential scheduling conflicts"""
        conflicts = []
        
        # Get campaign from database
        db = SessionLocal()
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if not campaign:
                return ["Campaign not found"]
            
            # Check user's campaign limits based on subscription
            user = db.query(User).filter(User.id == campaign.user_id).first()
            if user and user.customer and user.customer.subscriptions:
                active_subscription = next(
                    (s for s in user.customer.subscriptions if s.status == "active"),
                    None
                )
                if active_subscription:
                    tier_config = settings.PRICING_TIERS.get(active_subscription.tier.value)
                    campaign_limit = tier_config.get("campaign_limit", 0)
                    
                    # Count active campaigns
                    active_campaigns = db.query(Campaign).filter(
                        Campaign.user_id == user.id,
                        Campaign.status == CampaignStatus.ACTIVE
                    ).count()
                    
                    if campaign_limit != -1 and active_campaigns >= campaign_limit:
                        conflicts.append(f"Campaign limit reached ({campaign_limit})")
            
            # Check for overlapping schedules
            if trigger_config.get("type") in [TriggerType.SCHEDULED.value, TriggerType.RECURRING.value]:
                # Get other scheduled campaigns for the same user
                other_campaigns = db.query(Campaign).filter(
                    Campaign.user_id == campaign.user_id,
                    Campaign.id != campaign_id,
                    Campaign.status == CampaignStatus.ACTIVE
                ).all()
                
                for other in other_campaigns:
                    if other.config and other.config.get("trigger"):
                        other_trigger = other.config["trigger"]
                        if self._check_schedule_overlap(trigger_config, other_trigger):
                            conflicts.append(f"Schedule overlaps with campaign '{other.name}'")
            
        finally:
            db.close()
        
        return conflicts
    
    def _check_schedule_overlap(
        self,
        trigger1: Dict[str, Any],
        trigger2: Dict[str, Any]
    ) -> bool:
        """Check if two trigger configurations overlap"""
        # Simple overlap detection - can be enhanced
        if trigger1.get("type") == TriggerType.RECURRING.value and \
           trigger2.get("type") == TriggerType.RECURRING.value:
            # Check if intervals might cause conflicts
            interval1 = trigger1.get("interval_type")
            interval2 = trigger2.get("interval_type")
            
            if interval1 == interval2 and \
               trigger1.get("interval_value") == trigger2.get("interval_value"):
                return True
        
        return False
    
    async def _execute_campaign(self, campaign_id: int, trigger_config: Dict[str, Any]):
        """Execute a scheduled campaign"""
        db = SessionLocal()
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if not campaign:
                logger.error(f"Campaign {campaign_id} not found")
                return
            
            # Check if campaign is still active
            if campaign.status != CampaignStatus.ACTIVE:
                logger.info(f"Campaign {campaign_id} is not active, skipping execution")
                return
            
            # For condition-based triggers, check conditions first
            if trigger_config.get("type") == TriggerType.CONDITION.value:
                if not await self._evaluate_conditions(campaign, trigger_config.get("conditions", [])):
                    logger.info(f"Conditions not met for campaign {campaign_id}, skipping execution")
                    return
            
            # Create execution record
            execution = CampaignExecution(
                campaign_id=campaign_id,
                triggered_by=trigger_config.get("type"),
                status="pending",
                metadata={
                    "trigger_config": trigger_config,
                    "scheduled_execution": True
                }
            )
            db.add(execution)
            db.commit()
            db.refresh(execution)
            
            # Execute campaign (would trigger actual campaign logic)
            await self._run_campaign_execution(db, campaign, execution)
            
        except Exception as e:
            logger.error(f"Error executing campaign {campaign_id}: {str(e)}")
            await self.error_tracker.track_error(
                category="CAMPAIGN_EXECUTION_ERROR",
                service="campaign_scheduler",
                error_message=str(e),
                context={"campaign_id": campaign_id, "trigger_config": trigger_config}
            )
        finally:
            db.close()
    
    async def _evaluate_conditions(
        self,
        campaign: Campaign,
        conditions: List[Dict[str, Any]]
    ) -> bool:
        """Evaluate conditions for conditional triggers"""
        for condition in conditions:
            condition_type = condition.get("type")
            
            if condition_type == "metric_threshold":
                # Check if a metric meets threshold
                metric_name = condition.get("metric")
                threshold = condition.get("threshold")
                operator = condition.get("operator", "gte")
                
                # Get metric value (implementation depends on your metrics system)
                metric_value = await self._get_metric_value(campaign, metric_name)
                
                if operator == "gte" and metric_value < threshold:
                    return False
                elif operator == "lte" and metric_value > threshold:
                    return False
                elif operator == "eq" and metric_value != threshold:
                    return False
            
            elif condition_type == "time_window":
                # Check if current time is within specified window
                start_time = condition.get("start_time")
                end_time = condition.get("end_time")
                current_hour = datetime.now().hour
                
                if not (start_time <= current_hour < end_time):
                    return False
            
            elif condition_type == "external_event":
                # Check for external event (e.g., webhook received)
                event_key = f"event:{campaign.id}:{condition.get('event_name')}"
                # Check Redis or database for event flag
                # Implementation depends on your event system
                pass
        
        return True
    
    async def _get_metric_value(self, campaign: Campaign, metric_name: str) -> float:
        """Get metric value for conditional evaluation"""
        # Implementation would fetch actual metrics
        # This is a placeholder
        return 0.0
    
    async def _run_campaign_execution(
        self,
        db: Session,
        campaign: Campaign,
        execution: CampaignExecution
    ):
        """Run the actual campaign execution"""
        try:
            execution.status = "running"
            execution.started_at = datetime.utcnow()
            db.commit()
            
            # Here you would implement the actual campaign execution logic
            # For now, we'll just mark it as completed
            # In reality, this would:
            # 1. Parse campaign configuration
            # 2. Execute campaign steps (posts, emails, etc.)
            # 3. Track progress and results
            # 4. Handle errors and retries
            
            # Simulate execution
            import asyncio
            await asyncio.sleep(1)
            
            execution.status = "completed"
            execution.completed_at = datetime.utcnow()
            execution.result_summary = {
                "posts_created": 1,
                "emails_sent": 0,
                "sms_sent": 0
            }
            db.commit()
            
            logger.info(f"Campaign execution {execution.id} completed successfully")
            
        except Exception as e:
            execution.status = "failed"
            execution.error_message = str(e)
            execution.completed_at = datetime.utcnow()
            db.commit()
            
            logger.error(f"Campaign execution {execution.id} failed: {str(e)}")
            raise
    
    def _job_executed(self, event):
        """Handle job execution event"""
        logger.info(f"Job {event.job_id} executed successfully")
    
    def _job_error(self, event):
        """Handle job error event"""
        logger.error(f"Job {event.job_id} failed: {event.exception}")


# Create singleton instance
campaign_scheduler = CampaignScheduler()


class TriggerConfigurationService:
    """Service for managing trigger configurations"""
    
    @staticmethod
    def create_manual_trigger() -> Dict[str, Any]:
        """Create a manual trigger configuration"""
        return {
            "type": TriggerType.MANUAL.value,
            "created_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_scheduled_trigger(run_at: datetime) -> Dict[str, Any]:
        """Create a one-time scheduled trigger"""
        return {
            "type": TriggerType.SCHEDULED.value,
            "run_at": run_at.isoformat(),
            "created_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_recurring_trigger(
        interval_type: str,
        interval_value: int,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Create a recurring trigger configuration"""
        config = {
            "type": TriggerType.RECURRING.value,
            "interval_type": interval_type,
            "interval_value": interval_value,
            "created_at": datetime.utcnow().isoformat()
        }
        
        if start_date:
            config["start_date"] = start_date.isoformat()
        if end_date:
            config["end_date"] = end_date.isoformat()
        
        return config
    
    @staticmethod
    def create_cron_trigger(cron_expression: str) -> Dict[str, Any]:
        """Create a cron-based recurring trigger"""
        return {
            "type": TriggerType.RECURRING.value,
            "interval_type": "cron",
            "cron_expression": cron_expression,
            "created_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_event_trigger(
        event_name: str,
        webhook_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create an event-based trigger"""
        return {
            "type": TriggerType.EVENT.value,
            "event_name": event_name,
            "webhook_url": webhook_url,
            "created_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def create_conditional_trigger(conditions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create a condition-based trigger"""
        return {
            "type": TriggerType.CONDITION.value,
            "conditions": conditions,
            "evaluation_interval": 5,  # minutes
            "created_at": datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def validate_trigger_config(trigger_config: Dict[str, Any]) -> List[str]:
        """Validate a trigger configuration"""
        errors = []
        
        trigger_type = trigger_config.get("type")
        if not trigger_type:
            errors.append("Trigger type is required")
            return errors
        
        try:
            trigger_type = TriggerType(trigger_type)
        except ValueError:
            errors.append(f"Invalid trigger type: {trigger_type}")
            return errors
        
        # Validate based on type
        if trigger_type == TriggerType.SCHEDULED:
            if not trigger_config.get("run_at"):
                errors.append("run_at is required for scheduled triggers")
            else:
                try:
                    datetime.fromisoformat(trigger_config["run_at"])
                except:
                    errors.append("Invalid run_at format")
        
        elif trigger_type == TriggerType.RECURRING:
            interval_type = trigger_config.get("interval_type")
            if not interval_type:
                errors.append("interval_type is required for recurring triggers")
            elif interval_type not in ["minutes", "hours", "days", "weeks", "cron"]:
                errors.append(f"Invalid interval_type: {interval_type}")
            
            if interval_type == "cron":
                if not trigger_config.get("cron_expression"):
                    errors.append("cron_expression is required for cron triggers")
            else:
                if not trigger_config.get("interval_value"):
                    errors.append("interval_value is required for recurring triggers")
        
        elif trigger_type == TriggerType.EVENT:
            if not trigger_config.get("event_name"):
                errors.append("event_name is required for event triggers")
        
        elif trigger_type == TriggerType.CONDITION:
            conditions = trigger_config.get("conditions", [])
            if not conditions:
                errors.append("At least one condition is required for conditional triggers")
            
            for i, condition in enumerate(conditions):
                if not condition.get("type"):
                    errors.append(f"Condition {i}: type is required")
        
        return errors