# Instagram Integration Guide

This guide explains how to set up and use the Instagram integration in the Marketing Automation platform.

## Overview

The Instagram integration allows you to:
- Connect Instagram Business Accounts via OAuth 2.0
- Create and publish posts directly to Instagram
- Schedule posts for future publication
- Track post analytics and engagement metrics
- Integrate Instagram posting with marketing campaigns

## Prerequisites

1. **Facebook App**: You need a Facebook App with Instagram Basic Display and Instagram Graph API permissions
2. **Instagram Business Account**: Your Instagram account must be converted to a Business Account
3. **Facebook Page**: The Instagram Business Account must be connected to a Facebook Page

## Setup

### 1. Configure Meta App Credentials

Add the following environment variables to your `.env` file:

```env
META_APP_ID=your_facebook_app_id
META_APP_SECRET=your_facebook_app_secret
META_REDIRECT_URI=http://localhost:8000/api/instagram/callback
```

### 2. Configure Facebook App

In your Facebook App settings:

1. Add Instagram Basic Display product
2. Add Instagram Graph API product
3. Configure OAuth Redirect URIs to match your `META_REDIRECT_URI`
4. Add the required permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`

### 3. Database Migration

The Instagram models are automatically created when the backend starts. If you need to manually create them:

```python
from app.models.database import engine, Base
Base.metadata.create_all(bind=engine)
```

## Usage

### Connecting an Instagram Account

1. Navigate to the Instagram section in the dashboard
2. Click "Connect Instagram Account"
3. You'll be redirected to Facebook to authorize the app
4. Select the Facebook Page connected to your Instagram Business Account
5. Grant the requested permissions
6. You'll be redirected back and see your connected account

### Creating Instagram Posts

#### Via Campaign Creation

1. Create a new campaign
2. In the Instagram Integration section:
   - Select your connected Instagram account
   - Write your caption (max 2200 characters)
   - Add hashtags
   - Check "Publish to Instagram when campaign is executed"

#### Via Instagram Dashboard

1. Go to the Instagram section
2. Click "New Post"
3. Fill in:
   - Select account
   - Image URL
   - Caption
   - Hashtags
   - Schedule time (optional)
4. Click "Publish Now" or "Schedule Post"

### Scheduled Posts

The platform includes an automatic scheduler that:
- Checks for scheduled posts every minute
- Publishes posts at their scheduled time
- Updates post status and metrics
- Handles token refresh automatically

### Analytics

View Instagram analytics by:
1. Going to the Instagram dashboard
2. Click on a connected account
3. View metrics including:
   - Follower growth
   - Engagement rates
   - Post performance
   - Reach and impressions

## API Endpoints

### Authentication
- `GET /api/instagram/oauth/url` - Get OAuth URL for account connection
- `GET /api/instagram/callback` - OAuth callback handler

### Account Management
- `GET /api/instagram/accounts` - List connected accounts
- `GET /api/instagram/accounts/{id}` - Get account details
- `DELETE /api/instagram/accounts/{id}` - Disconnect account

### Post Management
- `POST /api/instagram/posts` - Create a new post
- `GET /api/instagram/posts` - List posts
- `GET /api/instagram/posts/{id}` - Get post details
- `PATCH /api/instagram/posts/{id}` - Update post
- `POST /api/instagram/posts/{id}/publish` - Publish a post
- `DELETE /api/instagram/posts/{id}` - Delete post

### Analytics
- `GET /api/instagram/accounts/{id}/analytics` - Get account analytics
- `POST /api/instagram/posts/{id}/refresh-metrics` - Refresh post metrics

## Testing

Run the test script to create sample data:

```bash
python test_instagram_integration.py
```

This will:
- Reset the database
- Create a test user (test@example.com / testpass123)
- Create sample Instagram accounts, posts, and analytics
- Verify all database operations

## Troubleshooting

### Token Expired
The system automatically refreshes tokens before they expire. If a token is expired:
1. The account status will show as "expired"
2. Reconnect the account through the OAuth flow

### Publishing Failures
Common reasons for publishing failures:
- Invalid image URL (must be publicly accessible)
- Caption too long (max 2200 characters)
- Account not properly connected
- Missing permissions

### Scheduled Posts Not Publishing
Check that:
- The scheduler service is running
- The scheduled time has passed
- The account token is valid
- The image URL is accessible

## Security Considerations

1. **Token Storage**: Access tokens are stored encrypted in the database
2. **Token Refresh**: Tokens are automatically refreshed before expiration
3. **Permissions**: Users can only access their own Instagram accounts
4. **Rate Limits**: Respect Instagram's API rate limits

## Future Enhancements

Planned features:
- Carousel posts (multiple images)
- Video posts
- Story publishing
- Reels publishing
- Advanced analytics dashboard
- Bulk scheduling
- Content calendar view