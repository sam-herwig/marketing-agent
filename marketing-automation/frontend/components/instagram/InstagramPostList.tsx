'use client';

import { useState, useEffect } from 'react';
import { instagramAPI, InstagramPost } from '@/lib/instagram';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { 
  Calendar, 
  Heart, 
  MessageCircle, 
  Share2, 
  Eye, 
  BarChart3,
  MoreVertical,
  Trash2,
  Send
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { sanitizeUserInput, sanitizeImageUrl } from '@/lib/sanitize';

interface InstagramPostListProps {
  accountId?: number;
  campaignId?: number;
  limit?: number;
}

export function InstagramPostList({ accountId, campaignId, limit }: InstagramPostListProps) {
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  useEffect(() => {
    loadPosts();
  }, [accountId, campaignId]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const data = await instagramAPI.getPosts({
        account_id: accountId,
        campaign_id: campaignId,
      });
      setPosts(limit ? data.slice(0, limit) : data);
    } catch (err) {
      setError('Failed to load Instagram posts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (postId: number) => {
    try {
      setPublishingId(postId);
      await instagramAPI.publishPost(postId);
      await loadPosts();
    } catch (err) {
      setError('Failed to publish post');
      console.error(err);
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await instagramAPI.deletePost(postId);
      await loadPosts();
    } catch (err) {
      setError('Failed to delete post');
      console.error(err);
    }
  };

  const handleRefreshMetrics = async (postId: number) => {
    try {
      await instagramAPI.refreshPostMetrics(postId);
      await loadPosts();
    } catch (err) {
      setError('Failed to refresh metrics');
      console.error(err);
    }
  };

  const getStatusBadge = (status: InstagramPost['status']) => {
    const variants: Record<InstagramPost['status'], { variant: any; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      scheduled: { variant: 'default', label: 'Scheduled' },
      publishing: { variant: 'default', label: 'Publishing' },
      published: { variant: 'success', label: 'Published' },
      failed: { variant: 'destructive', label: 'Failed' },
    };

    const { variant, label } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No Instagram posts found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {getStatusBadge(post.status)}
                  {post.scheduled_publish_time && post.status === 'scheduled' && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(post.scheduled_publish_time), 'PPp')}
                    </div>
                  )}
                  {post.published_at && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(post.published_at), 'PPp')}
                    </div>
                  )}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {post.status === 'draft' && (
                    <DropdownMenuItem
                      onClick={() => publishingId !== post.id && handlePublish(post.id)}
                      className={publishingId === post.id ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Publish Now
                    </DropdownMenuItem>
                  )}
                  {post.status === 'published' && (
                    <DropdownMenuItem onClick={() => handleRefreshMetrics(post.id)}>
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Refresh Metrics
                    </DropdownMenuItem>
                  )}
                  {post.status !== 'published' && (
                    <DropdownMenuItem
                      onClick={() => handleDelete(post.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {post.media_urls[0] && (
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={sanitizeImageUrl(post.media_urls[0])}
                    alt="Instagram post"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-sm whitespace-pre-wrap">{sanitizeUserInput(post.caption)}</p>
                  {post.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.hashtags.map((tag, index) => (
                        <span key={index} className="text-sm text-blue-600">
                          {sanitizeUserInput(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                {post.status === 'published' && (
                  <div className="pt-3 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-red-500" />
                        <span>{post.likes_count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span>{post.comments_count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-green-500" />
                        <span>{post.reach_count.toLocaleString()} reach</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-purple-500" />
                        <span>{post.impressions_count.toLocaleString()} impressions</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {post.error_message && (
                  <Alert variant="destructive">
                    <AlertDescription>{sanitizeUserInput(post.error_message)}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}