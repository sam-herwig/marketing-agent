'use client';

import { useState, useEffect } from 'react';
import { instagramAPI, InstagramAccount, InstagramPostCreate } from '@/lib/instagram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, Hash, Image as ImageIcon, AlertCircle } from 'lucide-react';

interface InstagramPostFormProps {
  campaignId?: number;
  imageUrl?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function InstagramPostForm({ campaignId, imageUrl, onSuccess, onCancel }: InstagramPostFormProps) {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [mediaUrl, setMediaUrl] = useState(imageUrl || '');
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const data = await instagramAPI.getAccounts();
      const connectedAccounts = data.filter(acc => acc.status === 'connected');
      setAccounts(connectedAccounts);
      if (connectedAccounts.length > 0) {
        setSelectedAccountId(connectedAccounts[0].id.toString());
      }
    } catch (err) {
      setError('Failed to load Instagram accounts');
      console.error(err);
    }
  };

  const handleAddHashtag = () => {
    const tag = hashtagInput.trim();
    if (tag && !hashtags.includes(tag)) {
      const formattedTag = tag.startsWith('#') ? tag : `#${tag}`;
      setHashtags([...hashtags, formattedTag]);
      setHashtagInput('');
    }
  };

  const handleRemoveHashtag = (index: number) => {
    setHashtags(hashtags.filter((_, i) => i !== index));
  };

  const handleSubmit = async (publish: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedAccountId) {
        throw new Error('Please select an Instagram account');
      }

      if (!mediaUrl) {
        throw new Error('Please provide an image URL');
      }

      if (!caption.trim()) {
        throw new Error('Please provide a caption');
      }

      let scheduledTime: string | undefined;
      if (scheduleDate && scheduleTime && !publish) {
        const [hours, minutes] = scheduleTime.split(':');
        const scheduledDate = new Date(scheduleDate);
        scheduledDate.setHours(parseInt(hours), parseInt(minutes));
        scheduledTime = scheduledDate.toISOString();
      }

      const postData: InstagramPostCreate = {
        account_id: parseInt(selectedAccountId),
        campaign_id: campaignId,
        caption: caption.trim(),
        hashtags,
        media_urls: [mediaUrl],
        post_type: 'IMAGE',
        scheduled_publish_time: scheduledTime,
      };

      const post = await instagramAPI.createPost(postData);

      if (publish) {
        await instagramAPI.publishPost(post.id);
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create Instagram post');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--color-text-subtle)' }} />
        <p className="text-sm text-muted-foreground mb-4">
          No connected Instagram accounts found
        </p>
        <p className="text-sm text-muted-foreground">
          Please connect an Instagram Business Account first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="account">Instagram Account</Label>
        <Select 
          value={selectedAccountId} 
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="w-full"
        >
          <option value="">Select an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id.toString()}>
              @{account.instagram_username}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="media-url">Image URL</Label>
        <div className="flex gap-2">
          <Input
            id="media-url"
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            disabled={!!imageUrl}
          />
          {mediaUrl && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => window.open(mediaUrl, '_blank')}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="caption">Caption</Label>
        <Textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write your caption here..."
          rows={4}
          maxLength={2200}
        />
        <p className="text-sm text-muted-foreground mt-1">
          {caption.length}/2200 characters
        </p>
      </div>

      <div>
        <Label htmlFor="hashtags">Hashtags</Label>
        <div className="flex gap-2 mb-2">
          <Input
            id="hashtags"
            value={hashtagInput}
            onChange={(e) => setHashtagInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddHashtag())}
            placeholder="Add hashtag"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddHashtag}
          >
            <Hash className="h-4 w-4" />
          </Button>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                style={{ 
                  backgroundColor: 'rgba(255, 227, 46, 0.1)', 
                  color: 'var(--color-primary)'
                }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveHashtag(index)}
                  className="transition-opacity"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Schedule Post (Optional)</Label>
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal flex-1",
                  !scheduleDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {scheduleDate ? format(scheduleDate, "PPP") : "Pick a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                initialFocus
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
          <Input
            type="time"
            value={scheduleTime}
            onChange={(e) => setScheduleTime(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-4">
        <Button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          variant="outline"
        >
          {loading ? 'Creating...' : scheduleDate ? 'Schedule Post' : 'Save as Draft'}
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={loading}
        >
          {loading ? 'Publishing...' : 'Publish Now'}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}