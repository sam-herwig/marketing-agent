from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import secrets
import json

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.instagram import InstagramAccount, InstagramPost, InstagramAnalytics
from app.schemas.instagram import (
    InstagramAccountCreate,
    InstagramAccountUpdate,
    InstagramAccountResponse,
    InstagramPostCreate,
    InstagramPostUpdate,
    InstagramPostResponse,
    InstagramAnalyticsResponse,
    InstagramOAuthResponse,
    InstagramPublishResponse
)
from app.services.instagram_service import instagram_service
from app.core.config import settings

router = APIRouter()

# OAuth endpoints
@router.get("/oauth/url", response_model=InstagramOAuthResponse)
async def get_oauth_url(
    current_user: User = Depends(get_current_user)
):
    """Get OAuth URL for Instagram Business Account connection"""
    # Generate a secure random state parameter
    state = secrets.token_urlsafe(32)
    
    # Store state in a temporary storage (in production, use Redis or similar)
    # For now, we'll include user_id in the state
    state_data = f"{current_user.id}:{state}"
    
    oauth_url = instagram_service.get_oauth_url(state_data)
    
    return InstagramOAuthResponse(
        oauth_url=oauth_url,
        state=state_data
    )

@router.get("/callback")
async def instagram_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db)
):
    """Handle OAuth callback from Instagram"""
    try:
        # Extract user_id from state
        user_id_str, _ = state.split(":", 1)
        user_id = int(user_id_str)
        
        # Exchange code for token
        token_data = await instagram_service.exchange_code_for_token(code)
        access_token = token_data["access_token"]
        
        # Get long-lived token
        long_lived_token_data = await instagram_service.get_long_lived_token(access_token)
        long_lived_token = long_lived_token_data["access_token"]
        
        # Get user's pages
        pages = await instagram_service.get_user_pages(long_lived_token)
        
        if not pages:
            raise HTTPException(status_code=400, detail="No Facebook Pages found")
        
        # For each page, check if it has an Instagram Business Account
        accounts_created = []
        for page in pages:
            if "instagram_business_account" in page:
                ig_account_data = await instagram_service.get_instagram_business_account(
                    page["id"], 
                    long_lived_token
                )
                
                if ig_account_data:
                    account = await instagram_service.create_instagram_account(
                        db=db,
                        user_id=user_id,
                        access_token=long_lived_token,
                        instagram_account_data=ig_account_data,
                        page_id=page["id"]
                    )
                    accounts_created.append(account)
        
        if not accounts_created:
            raise HTTPException(
                status_code=400, 
                detail="No Instagram Business Accounts found. Please ensure your Facebook Page is connected to an Instagram Business Account."
            )
        
        # Redirect to frontend success page
        return {"message": "Instagram accounts connected successfully", "accounts": len(accounts_created)}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Account management endpoints
@router.get("/accounts", response_model=List[InstagramAccountResponse])
async def get_instagram_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all Instagram accounts for the current user"""
    accounts = db.query(InstagramAccount).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    return accounts

@router.get("/accounts/{account_id}", response_model=InstagramAccountResponse)
async def get_instagram_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific Instagram account"""
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == account_id,
        InstagramAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    
    return account

@router.patch("/accounts/{account_id}", response_model=InstagramAccountResponse)
async def update_instagram_account(
    account_id: int,
    account_update: InstagramAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update Instagram account status"""
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == account_id,
        InstagramAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    
    if account_update.status is not None:
        account.status = account_update.status
    
    db.commit()
    db.refresh(account)
    return account

@router.delete("/accounts/{account_id}")
async def delete_instagram_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disconnect an Instagram account"""
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == account_id,
        InstagramAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    
    db.delete(account)
    db.commit()
    return {"message": "Instagram account disconnected successfully"}

# Post management endpoints
@router.post("/posts", response_model=InstagramPostResponse)
async def create_instagram_post(
    post: InstagramPostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new Instagram post (draft or scheduled)"""
    # Verify account ownership
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == post.account_id,
        InstagramAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    
    # Refresh token if needed
    await instagram_service.refresh_token_if_needed(db, account)
    
    # Create post
    db_post = InstagramPost(
        account_id=post.account_id,
        campaign_id=post.campaign_id,
        post_type=post.post_type,
        caption=post.caption,
        hashtags=post.hashtags,
        media_urls=[str(url) for url in post.media_urls],
        scheduled_publish_time=post.scheduled_publish_time,
        status=InstagramPostStatus.SCHEDULED if post.scheduled_publish_time else InstagramPostStatus.DRAFT
    )
    
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    return db_post

@router.get("/posts", response_model=List[InstagramPostResponse])
async def get_instagram_posts(
    account_id: Optional[int] = None,
    campaign_id: Optional[int] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get Instagram posts with optional filters"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    query = db.query(InstagramPost).filter(
        InstagramPost.account_id.in_(user_account_ids)
    )
    
    if account_id:
        query = query.filter(InstagramPost.account_id == account_id)
    if campaign_id:
        query = query.filter(InstagramPost.campaign_id == campaign_id)
    if status:
        query = query.filter(InstagramPost.status == status)
    
    posts = query.order_by(InstagramPost.created_at.desc()).all()
    return posts

@router.get("/posts/{post_id}", response_model=InstagramPostResponse)
async def get_instagram_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific Instagram post"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    post = db.query(InstagramPost).filter(
        InstagramPost.id == post_id,
        InstagramPost.account_id.in_(user_account_ids)
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Instagram post not found")
    
    return post

@router.patch("/posts/{post_id}", response_model=InstagramPostResponse)
async def update_instagram_post(
    post_id: int,
    post_update: InstagramPostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an Instagram post"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    post = db.query(InstagramPost).filter(
        InstagramPost.id == post_id,
        InstagramPost.account_id.in_(user_account_ids)
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Instagram post not found")
    
    if post.status == InstagramPostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Cannot update published posts")
    
    # Update fields
    if post_update.caption is not None:
        post.caption = post_update.caption
    if post_update.hashtags is not None:
        post.hashtags = post_update.hashtags
    if post_update.scheduled_publish_time is not None:
        post.scheduled_publish_time = post_update.scheduled_publish_time
        post.status = InstagramPostStatus.SCHEDULED
    if post_update.status is not None:
        post.status = post_update.status
    
    db.commit()
    db.refresh(post)
    return post

@router.post("/posts/{post_id}/publish", response_model=InstagramPublishResponse)
async def publish_instagram_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Publish an Instagram post immediately"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    post = db.query(InstagramPost).filter(
        InstagramPost.id == post_id,
        InstagramPost.account_id.in_(user_account_ids)
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Instagram post not found")
    
    if post.status == InstagramPostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Post already published")
    
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == post.account_id
    ).first()
    
    # Refresh token if needed
    await instagram_service.refresh_token_if_needed(db, account)
    
    try:
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
            post.instagram_post_id = result["id"]
            post.status = InstagramPostStatus.PUBLISHED
            post.published_at = datetime.utcnow()
            db.commit()
            
            return InstagramPublishResponse(
                post_id=post.id,
                instagram_post_id=result["id"],
                status="success",
                message="Post published successfully"
            )
        else:
            raise HTTPException(status_code=400, detail="No media URL found for post")
            
    except Exception as e:
        post.status = InstagramPostStatus.FAILED
        post.error_message = str(e)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Failed to publish post: {str(e)}")

@router.delete("/posts/{post_id}")
async def delete_instagram_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete an Instagram post (only if not published)"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    post = db.query(InstagramPost).filter(
        InstagramPost.id == post_id,
        InstagramPost.account_id.in_(user_account_ids)
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Instagram post not found")
    
    if post.status == InstagramPostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Cannot delete published posts")
    
    db.delete(post)
    db.commit()
    return {"message": "Instagram post deleted successfully"}

# Analytics endpoints
@router.get("/accounts/{account_id}/analytics", response_model=List[InstagramAnalyticsResponse])
async def get_account_analytics(
    account_id: int,
    period: str = Query("day", regex="^(day|week|month)$"),
    since: Optional[datetime] = None,
    until: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get analytics for an Instagram account"""
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == account_id,
        InstagramAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="Instagram account not found")
    
    # Refresh token if needed
    await instagram_service.refresh_token_if_needed(db, account)
    
    try:
        # Get insights from Instagram API
        insights_data = await instagram_service.get_account_insights(
            account=account,
            period=period,
            since=since,
            until=until
        )
        
        # Store analytics in database
        analytics = InstagramAnalytics(
            account_id=account_id,
            date=datetime.utcnow(),
            period_type=period,
            raw_data=insights_data
        )
        
        # Parse insights data
        for item in insights_data.get("data", []):
            if item["name"] == "impressions":
                analytics.total_impressions = sum(v["value"] for v in item["values"])
            elif item["name"] == "reach":
                analytics.total_reach = sum(v["value"] for v in item["values"])
            elif item["name"] == "profile_views":
                analytics.profile_views = sum(v["value"] for v in item["values"])
            elif item["name"] == "website_clicks":
                analytics.website_clicks = sum(v["value"] for v in item["values"])
        
        db.add(analytics)
        db.commit()
        
        # Return recent analytics
        query = db.query(InstagramAnalytics).filter(
            InstagramAnalytics.account_id == account_id
        )
        
        if since:
            query = query.filter(InstagramAnalytics.date >= since)
        if until:
            query = query.filter(InstagramAnalytics.date <= until)
        
        analytics_list = query.order_by(InstagramAnalytics.date.desc()).limit(30).all()
        return analytics_list
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch analytics: {str(e)}")

@router.post("/posts/{post_id}/refresh-metrics")
async def refresh_post_metrics(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh metrics for a specific post"""
    # Get user's accounts
    user_account_ids = db.query(InstagramAccount.id).filter(
        InstagramAccount.user_id == current_user.id
    ).all()
    user_account_ids = [acc[0] for acc in user_account_ids]
    
    post = db.query(InstagramPost).filter(
        InstagramPost.id == post_id,
        InstagramPost.account_id.in_(user_account_ids)
    ).first()
    
    if not post:
        raise HTTPException(status_code=404, detail="Instagram post not found")
    
    if post.status != InstagramPostStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Can only refresh metrics for published posts")
    
    account = db.query(InstagramAccount).filter(
        InstagramAccount.id == post.account_id
    ).first()
    
    # Refresh token if needed
    await instagram_service.refresh_token_if_needed(db, account)
    
    try:
        await instagram_service.update_post_metrics(db, post, account)
        db.refresh(post)
        return {"message": "Post metrics updated successfully", "post": post}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update metrics: {str(e)}")