'use client';

import { useState } from 'react';
import { InstagramConnect } from '@/components/instagram/InstagramConnect';
import { InstagramPostForm } from '@/components/instagram/InstagramPostForm';
import { InstagramPostList } from '@/components/instagram/InstagramPostList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function InstagramDashboard() {
  const [showPostForm, setShowPostForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePostSuccess = () => {
    setShowPostForm(false);
    setRefreshKey(prev => prev + 1); // Trigger post list refresh
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Instagram Integration</h1>
        <p className="text-muted-foreground mt-2">
          Manage your Instagram Business accounts, create posts, and track analytics
        </p>
      </div>

      <InstagramConnect />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Create Post</CardTitle>
                <CardDescription>
                  Create and schedule Instagram posts
                </CardDescription>
              </div>
              {!showPostForm && (
                <Button onClick={() => setShowPostForm(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Post
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {showPostForm ? (
              <InstagramPostForm
                onSuccess={handlePostSuccess}
                onCancel={() => setShowPostForm(false)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Click "New Post" to create an Instagram post
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Posts</CardTitle>
            <CardDescription>
              Your latest Instagram posts and their performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InstagramPostList key={refreshKey} limit={5} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}