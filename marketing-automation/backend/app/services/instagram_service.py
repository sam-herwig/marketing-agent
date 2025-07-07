import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.instagram import InstagramAccount, InstagramPost, InstagramAnalytics, InstagramAccountStatus, InstagramPostStatus
from app.models.user import User
import logging

logger = logging.getLogger(__name__)

class InstagramService:
    def __init__(self):
        self.base_url = f"{settings.META_GRAPH_API_URL}/{settings.META_API_VERSION}"
        self.app_id = settings.META_APP_ID
        self.app_secret = settings.META_APP_SECRET
        self.redirect_uri = settings.META_REDIRECT_URI
        
    def get_oauth_url(self, state: str) -> str:
        """Generate OAuth URL for Instagram Business Account authentication"""
        params = {
            "client_id": self.app_id,
            "redirect_uri": self.redirect_uri,
            "scope": settings.INSTAGRAM_SCOPES,
            "response_type": "code",
            "state": state
        }
        return f"https://www.facebook.com/dialog/oauth?" + "&".join([f"{k}={v}" for k, v in params.items()])
    
    async def exchange_code_for_token(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token"""
        async with httpx.AsyncClient() as client:
            params = {
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "redirect_uri": self.redirect_uri,
                "code": code
            }
            response = await client.get(
                f"{self.base_url}/oauth/access_token",
                params=params
            )
            response.raise_for_status()
            return response.json()
    
    async def get_long_lived_token(self, short_lived_token: str) -> Dict[str, Any]:
        """Exchange short-lived token for long-lived token (60 days)"""
        async with httpx.AsyncClient() as client:
            params = {
                "grant_type": "fb_exchange_token",
                "client_id": self.app_id,
                "client_secret": self.app_secret,
                "fb_exchange_token": short_lived_token
            }
            response = await client.get(
                f"{self.base_url}/oauth/access_token",
                params=params
            )
            response.raise_for_status()
            return response.json()
    
    async def get_user_pages(self, access_token: str) -> List[Dict[str, Any]]:
        """Get list of Facebook Pages that user manages"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/me/accounts",
                params={
                    "access_token": access_token,
                    "fields": "id,name,instagram_business_account"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
    
    async def get_instagram_business_account(self, page_id: str, access_token: str) -> Optional[Dict[str, Any]]:
        """Get Instagram Business Account connected to a Facebook Page"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{page_id}",
                params={
                    "access_token": access_token,
                    "fields": "instagram_business_account{id,username,profile_picture_url,followers_count,media_count}"
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("instagram_business_account")
    
    async def create_instagram_account(
        self, 
        db: Session, 
        user_id: int, 
        access_token: str,
        instagram_account_data: Dict[str, Any],
        page_id: str
    ) -> InstagramAccount:
        """Create or update Instagram account in database"""
        account = db.query(InstagramAccount).filter_by(
            instagram_user_id=instagram_account_data["id"]
        ).first()
        
        if not account:
            account = InstagramAccount(
                user_id=user_id,
                instagram_user_id=instagram_account_data["id"],
                instagram_username=instagram_account_data["username"],
                instagram_business_account_id=instagram_account_data["id"],
                page_id=page_id,
                access_token=access_token,
                token_expires_at=datetime.utcnow() + timedelta(days=60),
                status=InstagramAccountStatus.CONNECTED,
                profile_data=instagram_account_data
            )
            db.add(account)
        else:
            account.access_token = access_token
            account.token_expires_at = datetime.utcnow() + timedelta(days=60)
            account.status = InstagramAccountStatus.CONNECTED
            account.profile_data = instagram_account_data
            account.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(account)
        return account
    
    async def publish_image(
        self,
        account: InstagramAccount,
        image_url: str,
        caption: str,
        hashtags: List[str] = None
    ) -> Dict[str, Any]:
        """Publish an image to Instagram"""
        if hashtags:
            caption = f"{caption}\n\n{' '.join(hashtags)}"
        
        async with httpx.AsyncClient() as client:
            # Step 1: Create media container
            container_params = {
                "image_url": image_url,
                "caption": caption,
                "access_token": account.access_token
            }
            
            container_response = await client.post(
                f"{self.base_url}/{account.instagram_business_account_id}/media",
                params=container_params
            )
            container_response.raise_for_status()
            container_data = container_response.json()
            container_id = container_data["id"]
            
            # Step 2: Publish the container
            publish_params = {
                "creation_id": container_id,
                "access_token": account.access_token
            }
            
            publish_response = await client.post(
                f"{self.base_url}/{account.instagram_business_account_id}/media_publish",
                params=publish_params
            )
            publish_response.raise_for_status()
            return publish_response.json()
    
    async def schedule_post(
        self,
        db: Session,
        account: InstagramAccount,
        image_url: str,
        caption: str,
        scheduled_time: datetime,
        campaign_id: Optional[int] = None,
        hashtags: List[str] = None
    ) -> InstagramPost:
        """Schedule a post for future publishing"""
        post = InstagramPost(
            account_id=account.id,
            campaign_id=campaign_id,
            post_type="IMAGE",
            caption=caption,
            hashtags=hashtags or [],
            media_urls=[image_url],
            scheduled_publish_time=scheduled_time,
            status=InstagramPostStatus.SCHEDULED
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        return post
    
    async def get_post_insights(
        self,
        account: InstagramAccount,
        post_id: str
    ) -> Dict[str, Any]:
        """Get insights for a specific post"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{post_id}/insights",
                params={
                    "metric": "engagement,impressions,reach,saved",
                    "access_token": account.access_token
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def get_account_insights(
        self,
        account: InstagramAccount,
        period: str = "day",
        since: Optional[datetime] = None,
        until: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get account insights"""
        params = {
            "metric": "impressions,reach,profile_views,website_clicks",
            "period": period,
            "access_token": account.access_token
        }
        
        if since:
            params["since"] = int(since.timestamp())
        if until:
            params["until"] = int(until.timestamp())
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/{account.instagram_business_account_id}/insights",
                params=params
            )
            response.raise_for_status()
            return response.json()
    
    async def refresh_token_if_needed(
        self,
        db: Session,
        account: InstagramAccount
    ) -> bool:
        """Check and refresh token if it's about to expire"""
        if account.token_expires_at and account.token_expires_at < datetime.utcnow() + timedelta(days=7):
            try:
                # Refresh the token
                new_token_data = await self.get_long_lived_token(account.access_token)
                account.access_token = new_token_data["access_token"]
                account.token_expires_at = datetime.utcnow() + timedelta(seconds=new_token_data.get("expires_in", 5184000))
                db.commit()
                return True
            except Exception as e:
                logger.error(f"Failed to refresh token for account {account.id}: {str(e)}")
                account.status = InstagramAccountStatus.EXPIRED
                db.commit()
                return False
        return True
    
    async def update_post_metrics(
        self,
        db: Session,
        post: InstagramPost,
        account: InstagramAccount
    ):
        """Update post metrics from Instagram API"""
        if not post.instagram_post_id:
            return
        
        try:
            insights = await self.get_post_insights(account, post.instagram_post_id)
            metrics = {}
            
            for item in insights.get("data", []):
                if item["name"] == "engagement":
                    metrics["engagement"] = item["values"][0]["value"]
                elif item["name"] == "impressions":
                    post.impressions_count = item["values"][0]["value"]
                elif item["name"] == "reach":
                    post.reach_count = item["values"][0]["value"]
            
            # Get likes and comments separately
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/{post.instagram_post_id}",
                    params={
                        "fields": "like_count,comments_count",
                        "access_token": account.access_token
                    }
                )
                response.raise_for_status()
                data = response.json()
                post.likes_count = data.get("like_count", 0)
                post.comments_count = data.get("comments_count", 0)
            
            db.commit()
        except Exception as e:
            logger.error(f"Failed to update metrics for post {post.id}: {str(e)}")

# Singleton instance
instagram_service = InstagramService()