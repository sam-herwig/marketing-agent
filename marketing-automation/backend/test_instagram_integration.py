#!/usr/bin/env python3
"""
Test script for Instagram integration
This script tests the Instagram integration functionality
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from app.models.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.campaign import Campaign, CampaignStatus
from app.models.instagram import InstagramAccount, InstagramPost, InstagramAnalytics
from app.core.security import get_password_hash
from sqlalchemy import text

def reset_database():
    """Reset the database for testing"""
    print("Resetting database...")
    # Drop all tables
    Base.metadata.drop_all(bind=engine)
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print("Database reset complete!")

def create_test_user(db):
    """Create a test user"""
    print("Creating test user...")
    test_user = User(
        email="test@example.com",
        username="testuser",
        hashed_password=get_password_hash("testpass123"),
        is_active=True
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)
    print(f"Test user created: {test_user.username}")
    return test_user

def create_test_instagram_account(db, user_id):
    """Create a test Instagram account"""
    print("Creating test Instagram account...")
    test_account = InstagramAccount(
        user_id=user_id,
        instagram_user_id="test_ig_user_123",
        instagram_username="test_instagram_account",
        instagram_business_account_id="test_business_123",
        page_id="test_page_123",
        access_token="test_access_token",
        token_expires_at=datetime.utcnow() + timedelta(days=60),
        status="connected",
        profile_data={
            "followers_count": 1000,
            "media_count": 50,
            "profile_picture_url": "https://example.com/profile.jpg"
        }
    )
    db.add(test_account)
    db.commit()
    db.refresh(test_account)
    print(f"Test Instagram account created: @{test_account.instagram_username}")
    return test_account

def create_test_campaign(db, user_id, instagram_account_id):
    """Create a test campaign with Instagram integration"""
    print("Creating test campaign...")
    test_campaign = Campaign(
        user_id=user_id,
        name="Test Instagram Campaign",
        description="A test campaign for Instagram integration",
        status=CampaignStatus.ACTIVE,
        trigger_type="manual",
        image_url="https://example.com/test-image.jpg",
        instagram_account_id=instagram_account_id,
        instagram_caption="Check out our amazing product! #marketing #test",
        instagram_hashtags=["#marketing", "#test", "#automation"],
        instagram_publish=True,
        tags=["test", "instagram"]
    )
    db.add(test_campaign)
    db.commit()
    db.refresh(test_campaign)
    print(f"Test campaign created: {test_campaign.name}")
    return test_campaign

def create_test_posts(db, account_id, campaign_id):
    """Create test Instagram posts"""
    print("Creating test Instagram posts...")
    
    # Published post
    published_post = InstagramPost(
        account_id=account_id,
        campaign_id=campaign_id,
        instagram_post_id="test_post_123",
        post_type="IMAGE",
        caption="This is a published test post",
        hashtags=["#test", "#published"],
        media_urls=["https://example.com/image1.jpg"],
        status="published",
        published_at=datetime.utcnow() - timedelta(hours=2),
        likes_count=100,
        comments_count=10,
        reach_count=500,
        impressions_count=1000
    )
    
    # Scheduled post
    scheduled_post = InstagramPost(
        account_id=account_id,
        campaign_id=campaign_id,
        post_type="IMAGE",
        caption="This is a scheduled test post",
        hashtags=["#test", "#scheduled"],
        media_urls=["https://example.com/image2.jpg"],
        status="scheduled",
        scheduled_publish_time=datetime.utcnow() + timedelta(hours=1)
    )
    
    # Draft post
    draft_post = InstagramPost(
        account_id=account_id,
        post_type="IMAGE",
        caption="This is a draft test post",
        hashtags=["#test", "#draft"],
        media_urls=["https://example.com/image3.jpg"],
        status="draft"
    )
    
    db.add_all([published_post, scheduled_post, draft_post])
    db.commit()
    print("Test Instagram posts created!")
    return [published_post, scheduled_post, draft_post]

def create_test_analytics(db, account_id):
    """Create test analytics data"""
    print("Creating test analytics...")
    
    for i in range(7):
        date = datetime.utcnow() - timedelta(days=i)
        analytics = InstagramAnalytics(
            account_id=account_id,
            date=date,
            period_type="daily",
            followers_count=1000 + (i * 10),
            following_count=500,
            media_count=50 + i,
            total_likes=200 + (i * 20),
            total_comments=50 + (i * 5),
            engagement_rate=5 + (i * 0.1),
            total_reach=1000 + (i * 100),
            total_impressions=2000 + (i * 200),
            profile_views=100 + (i * 10),
            website_clicks=20 + (i * 2)
        )
        db.add(analytics)
    
    db.commit()
    print("Test analytics created!")

def test_database_queries(db):
    """Test various database queries"""
    print("\nTesting database queries...")
    
    # Test user query
    user = db.query(User).filter_by(email="test@example.com").first()
    print(f"✓ Found user: {user.username}")
    
    # Test Instagram account query
    account = db.query(InstagramAccount).filter_by(user_id=user.id).first()
    print(f"✓ Found Instagram account: @{account.instagram_username}")
    
    # Test campaign query
    campaign = db.query(Campaign).filter_by(user_id=user.id).first()
    print(f"✓ Found campaign: {campaign.name}")
    
    # Test posts query
    posts = db.query(InstagramPost).filter_by(account_id=account.id).all()
    print(f"✓ Found {len(posts)} Instagram posts")
    
    # Test analytics query
    analytics = db.query(InstagramAnalytics).filter_by(account_id=account.id).all()
    print(f"✓ Found {len(analytics)} analytics records")

def main():
    """Main test function"""
    print("Instagram Integration Test Script")
    print("=" * 50)
    
    # Reset database
    reset_database()
    
    # Create database session
    db = SessionLocal()
    
    try:
        # Create test data
        user = create_test_user(db)
        account = create_test_instagram_account(db, user.id)
        campaign = create_test_campaign(db, user.id, account.id)
        posts = create_test_posts(db, account.id, campaign.id)
        create_test_analytics(db, account.id)
        
        # Test queries
        test_database_queries(db)
        
        print("\n✅ All tests completed successfully!")
        print("\nTest Data Summary:")
        print(f"- User: {user.email}")
        print(f"- Instagram Account: @{account.instagram_username}")
        print(f"- Campaign: {campaign.name}")
        print(f"- Posts: {len(posts)} created")
        print("\nYou can now:")
        print("1. Start the backend server: cd backend && uvicorn app.main:app --reload")
        print("2. Start the frontend: cd frontend && npm run dev")
        print("3. Login with: test@example.com / testpass123")
        print("4. Navigate to the Instagram section to see the integration")
        
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()