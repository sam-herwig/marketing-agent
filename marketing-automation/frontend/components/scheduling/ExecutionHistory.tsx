'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface CampaignExecution {
  id: number;
  status: string;
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  result_summary: any;
  error_message: string | null;
}

export default function ExecutionHistory() {
  const { data: session } = useSession();
  const [executions, setExecutions] = useState<CampaignExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchCampaigns();
    fetchExecutions();
  }, [session, selectedCampaign]);

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCampaigns(data.map((c: any) => ({ id: c.id.toString(), name: c.name })));
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchExecutions = async () => {
    try {
      let url = '/api/campaigns/executions';
      if (selectedCampaign !== 'all') {
        url = `/api/scheduling/campaigns/${selectedCampaign}/executions`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setExecutions(data);
      }
    } catch (error) {
      console.error('Error fetching executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'running':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress';
    
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatTrigger = (trigger: string) => {
    return trigger.charAt(0).toUpperCase() + trigger.slice(1).replace('_', ' ');
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Execution History</CardTitle>
            <CardDescription>View past campaign executions and their results</CardDescription>
          </div>
          <Select 
            value={selectedCampaign} 
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="w-[200px]"
          >
            <option value="all">All Campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {executions.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No execution history available</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Triggered By</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(execution.status)}
                      <Badge variant={getStatusBadgeVariant(execution.status)}>
                        {execution.status}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{formatTrigger(execution.triggered_by)}</TableCell>
                  <TableCell>
                    {new Date(execution.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {formatDuration(execution.started_at, execution.completed_at)}
                  </TableCell>
                  <TableCell>
                    {execution.result_summary ? (
                      <div className="text-sm">
                        {Object.entries(execution.result_summary).map(([key, value]) => (
                          <div key={key}>
                            {key}: {value as string}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {execution.error_message ? (
                      <span className="text-sm text-red-600">{execution.error_message}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
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