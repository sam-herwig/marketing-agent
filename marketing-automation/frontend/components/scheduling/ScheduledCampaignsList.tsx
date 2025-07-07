'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar, Clock, Play, Pause, Trash2 } from 'lucide-react';
import { sanitizeUserInput } from '@/lib/sanitize';

interface ScheduledCampaign {
  id: number;
  name: string;
  status: string;
  trigger_type: string;
  trigger_config: any;
  next_run_time: string | null;
  job_id: string | null;
}

export default function ScheduledCampaignsList() {
  const { data: session } = useSession();
  const [campaigns, setCampaigns] = useState<ScheduledCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchScheduledCampaigns();
  }, [session]);

  const fetchScheduledCampaigns = async () => {
    try {
      const response = await fetch('/api/scheduling/campaigns/scheduled', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error('Error fetching scheduled campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnschedule = async (campaignId: number) => {
    if (!confirm('Are you sure you want to unschedule this campaign?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scheduling/campaigns/${campaignId}/schedule`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        fetchScheduledCampaigns();
      }
    } catch (error) {
      console.error('Error unscheduling campaign:', error);
    }
  };

  const handleManualRun = async (campaignId: number) => {
    try {
      const response = await fetch(`/api/scheduling/campaigns/${campaignId}/execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        alert('Campaign execution started');
      }
    } catch (error) {
      console.error('Error executing campaign:', error);
    }
  };

  const formatTriggerType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
  };

  const getTriggerDescription = (config: any) => {
    switch (config.type) {
      case 'scheduled':
        return `Runs at ${new Date(config.run_at).toLocaleString()}`;
      case 'recurring':
        if (config.interval_type === 'cron') {
          return `Cron: ${config.cron_expression}`;
        }
        return `Every ${config.interval_value} ${config.interval_type}`;
      case 'event':
        return `On event: ${config.event_name}`;
      case 'condition':
        return `When conditions are met`;
      default:
        return 'Manual trigger';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Campaigns</CardTitle>
        <CardDescription>Manage your automated campaign schedules</CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No scheduled campaigns</p>
            <Button
              className="mt-4"
              onClick={() => window.location.href = '/dashboard/campaigns'}
            >
              Create Campaign
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{sanitizeUserInput(campaign.name)}</TableCell>
                  <TableCell>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatTriggerType(campaign.trigger_type)}</p>
                      <p className="text-sm text-gray-600">
                        {getTriggerDescription(campaign.trigger_config)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {campaign.next_run_time ? (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-gray-500" />
                        <span className="text-sm">
                          {new Date(campaign.next_run_time).toLocaleString()}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualRun(campaign.id)}
                        title="Run now"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnschedule(campaign.id)}
                        title="Unschedule"
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}