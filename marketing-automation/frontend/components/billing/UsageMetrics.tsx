'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Image, MessageSquare, Mail } from 'lucide-react';

interface UsageData {
  service: string;
  used: number;
  limit?: number;
  cost: number;
}

export default function UsageMetrics() {
  const { data: session } = useSession();
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<{ start: string; end: string } | null>(null);

  useEffect(() => {
    fetchUsageData();
  }, [session]);

  const fetchUsageData = async () => {
    // This would fetch actual usage data from your API
    // For now, using mock data
    setUsageData([
      { service: 'Image Generation', used: 45, limit: 100, cost: 4.50 },
      { service: 'SMS Messages', used: 120, cost: 6.00 },
      { service: 'Email Campaigns', used: 5000, cost: 5.00 },
    ]);
    
    setCurrentPeriod({
      start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString(),
      end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString(),
    });
    
    setLoading(false);
  };

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'Image Generation':
        return <Image className="h-5 w-5" />;
      case 'SMS Messages':
        return <MessageSquare className="h-5 w-5" />;
      case 'Email Campaigns':
        return <Mail className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const calculateProgress = (used: number, limit?: number) => {
    if (!limit) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style={{ borderColor: 'var(--color-text-body)' }}></div>
        </CardContent>
      </Card>
    );
  }

  const totalCost = usageData.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Current Usage</CardTitle>
          <CardDescription>
            {currentPeriod && `Billing period: ${currentPeriod.start} - ${currentPeriod.end}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {usageData.map((item) => (
            <div key={item.service} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getServiceIcon(item.service)}
                  <span className="font-medium">{item.service}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(item.cost)}</p>
                  {item.limit ? (
                    <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>
                      {item.used} / {item.limit}
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>{item.used} used</p>
                  )}
                </div>
              </div>
              {item.limit && (
                <Progress value={calculateProgress(item.used, item.limit)} className="h-2" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Additional charges this period</p>
            </div>
            <Badge variant="secondary">Current Period</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Pricing</CardTitle>
          <CardDescription>Pay only for what you use</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center space-x-2">
                <Image className="h-4 w-4" style={{ color: 'var(--color-text-subtle)' }} />
                <span className="text-sm">Image Generation</span>
              </div>
              <span className="text-sm font-medium">$0.10 per image</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" style={{ color: 'var(--color-text-subtle)' }} />
                <span className="text-sm">SMS Messages</span>
              </div>
              <span className="text-sm font-medium">$0.05 per SMS</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" style={{ color: 'var(--color-text-subtle)' }} />
                <span className="text-sm">Email Campaigns</span>
              </div>
              <span className="text-sm font-medium">$0.001 per email</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}