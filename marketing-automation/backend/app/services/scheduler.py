import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.database import SessionLocal
from app.models.instagram import InstagramPost, InstagramPostStatus, InstagramAccount
from app.services.instagram_service import instagram_service
import logging

logger = logging.getLogger(__name__)

class InstagramScheduler:
    def __init__(self):
        self.running = False
        self.check_interval = 60  # Check every minute
        
    async def start(self):
        """Start the scheduler"""
        self.running = True
        logger.info("Instagram scheduler started")
        
        while self.running:
            try:
                await self.process_scheduled_posts()
            except Exception as e:
                logger.error(f"Error in scheduler: {str(e)}")
            
            await asyncio.sleep(self.check_interval)
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        logger.info("Instagram scheduler stopped")
    
    async def process_scheduled_posts(self):
        """Process all scheduled posts that are due"""
        db = SessionLocal()
        try:
            # Find posts that are scheduled and due
            now = datetime.utcnow()
            scheduled_posts = db.query(InstagramPost).filter(
                InstagramPost.status == InstagramPostStatus.SCHEDULED,
                InstagramPost.scheduled_publish_time <= now
            ).all()
            
            logger.info(f"Found {len(scheduled_posts)} posts to publish")
            
            for post in scheduled_posts:
                await self.publish_scheduled_post(db, post)
                
        except Exception as e:
            logger.error(f"Error processing scheduled posts: {str(e)}")
        finally:
            db.close()
    
    async def publish_scheduled_post(self, db: Session, post: InstagramPost):
        """Publish a single scheduled post"""
        try:
            # Get the Instagram account
            account = db.query(InstagramAccount).filter(
                InstagramAccount.id == post.account_id
            ).first()
            
            if not account:
                post.status = InstagramPostStatus.FAILED
                post.error_message = "Instagram account not found"
                db.commit()
                return
            
            # Check account status
            if account.status != "connected":
                post.status = InstagramPostStatus.FAILED
                post.error_message = f"Instagram account is {account.status}"
                db.commit()
                return
            
            # Refresh token if needed
            if not await instagram_service.refresh_token_if_needed(db, account):
                post.status = InstagramPostStatus.FAILED
                post.error_message = "Failed to refresh access token"
                db.commit()
                return
            
            # Update status to publishing
            post.status = InstagramPostStatus.PUBLISHING
            db.commit()
            
            # Publish the post
            if post.media_urls and len(post.media_urls) > 0:
                result = await instagram_service.publish_image(
                    account=account,
                    image_url=post.media_urls[0],
                    caption=post.caption,
                    hashtags=post.hashtags
                )
                
                # Update post with Instagram ID
                post.instagram_post_id = result.get("id")
                post.status = InstagramPostStatus.PUBLISHED
                post.published_at = datetime.utcnow()
                post.error_message = None
                db.commit()
                
                logger.info(f"Successfully published Instagram post {post.id}")
            else:
                post.status = InstagramPostStatus.FAILED
                post.error_message = "No media URL found"
                db.commit()
                
        except Exception as e:
            logger.error(f"Error publishing post {post.id}: {str(e)}")
            post.status = InstagramPostStatus.FAILED
            post.error_message = str(e)
            db.commit()

# Create singleton instance
instagram_scheduler = InstagramScheduler()

async def start_scheduler():
    """Start the Instagram scheduler in the background"""
    asyncio.create_task(instagram_scheduler.start())