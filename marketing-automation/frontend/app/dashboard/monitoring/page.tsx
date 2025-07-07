'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import SystemHealthCard from '@/components/monitoring/SystemHealthCard';
import ApiMetricsChart from '@/components/monitoring/ApiMetricsChart';
import CampaignMetrics from '@/components/monitoring/CampaignMetrics';
import ErrorStats from '@/components/monitoring/ErrorStats';

interface DashboardData {
  health: {
    status: string;
    services: Record<string, any>;
  };
  api_metrics: any;
  campaign_metrics: any;
  error_stats: any;
}

export default function MonitoringDashboard() {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    if (session?.accessToken) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [session, refreshInterval]);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const response = await fetch('/api/monitoring/dashboard', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      
      if (response.status === 403) {
        setError('You do not have permission to view this dashboard');
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!dashboardData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Monitoring</h1>
          <p className="text-gray-600 mt-2">Real-time system health and performance metrics</p>
        </div>
        <Badge variant={dashboardData.health.status === 'healthy' ? 'default' : 'destructive'}>
          <Activity className="h-4 w-4 mr-1" />
          {dashboardData.health.status.toUpperCase()}
        </Badge>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(dashboardData.health.services).map(([service, data]) => (
          <SystemHealthCard key={service} service={service} data={data} />
        ))}
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="api-metrics" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="api-metrics">API Metrics</TabsTrigger>
          <TabsTrigger value="campaign-metrics">Campaign Metrics</TabsTrigger>
          <TabsTrigger value="error-stats">Error Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="api-metrics" className="space-y-4">
          <ApiMetricsChart data={dashboardData.api_metrics} />
        </TabsContent>

        <TabsContent value="campaign-metrics" className="space-y-4">
          <CampaignMetrics data={dashboardData.campaign_metrics} />
        </TabsContent>

        <TabsContent value="error-stats" className="space-y-4">
          <ErrorStats data={dashboardData.error_stats} />
        </TabsContent>
      </Tabs>

      {/* Refresh Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Refresh Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <label htmlFor="refresh-interval" className="text-sm font-medium">
              Refresh Interval:
            </label>
            <select
              id="refresh-interval"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-3 py-1"
            >
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="300000">5 minutes</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}