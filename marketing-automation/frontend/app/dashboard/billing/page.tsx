'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Download, AlertCircle } from 'lucide-react';
import PaymentMethodsList from '@/components/billing/PaymentMethodsList';
import BillingHistory from '@/components/billing/BillingHistory';
import UsageMetrics from '@/components/billing/UsageMetrics';

interface Subscription {
  id: number;
  tier: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export default function BillingDashboard() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchSubscription();
    }
  }, [session]);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscriptions/current', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription || !confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      const response = await fetch(`/api/stripe/subscriptions/${subscription.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });

      if (response.ok) {
        fetchSubscription();
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
    }
  };

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-gray-600 mt-2">Manage your subscription and payment methods</p>
      </div>

      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Your active subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {getTierDisplayName(subscription.tier)} Plan
                  </p>
                  <p className="text-sm text-gray-600">
                    Next billing date: {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(subscription.status)}>
                  {subscription.status}
                </Badge>
              </div>

              {subscription.cancel_at_period_end && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your subscription will be canceled at the end of the current billing period.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex space-x-4">
                <Button variant="outline" onClick={() => window.location.href = '/pricing'}>
                  Change Plan
                </Button>
                {!subscription.cancel_at_period_end && (
                  <Button variant="destructive" onClick={handleCancelSubscription}>
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">You don't have an active subscription</p>
              <Button onClick={() => window.location.href = '/pricing'}>
                View Plans
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Tabs */}
      <Tabs defaultValue="payment-methods" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="billing-history">Billing History</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="payment-methods" className="space-y-4">
          <PaymentMethodsList />
        </TabsContent>

        <TabsContent value="billing-history" className="space-y-4">
          <BillingHistory />
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <UsageMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}