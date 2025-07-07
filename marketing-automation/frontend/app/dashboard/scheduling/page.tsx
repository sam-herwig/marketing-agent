'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock, Play, Pause } from 'lucide-react';
import ScheduledCampaignsList from '@/components/scheduling/ScheduledCampaignsList';
import TriggerBuilder from '@/components/scheduling/TriggerBuilder';
import ExecutionHistory from '@/components/scheduling/ExecutionHistory';

export default function SchedulingDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('scheduled');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Campaign Scheduling</h1>
        <p className="text-gray-600 mt-2">Manage when and how your campaigns are executed</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Scheduled Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-gray-500">Active schedules</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Next Execution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-lg font-bold">2h 15m</p>
                <p className="text-xs text-gray-500">Instagram Post</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Running Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Play className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-xs text-gray-500">Active executions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <span className="text-green-600 font-bold text-sm">95%</span>
              </div>
              <div>
                <p className="text-lg font-bold">285/300</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scheduled">Scheduled Campaigns</TabsTrigger>
          <TabsTrigger value="triggers">Trigger Configuration</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4">
          <ScheduledCampaignsList />
        </TabsContent>

        <TabsContent value="triggers" className="space-y-4">
          <TriggerBuilder />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <ExecutionHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}