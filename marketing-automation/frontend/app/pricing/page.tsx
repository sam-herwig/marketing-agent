'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface PricingTier {
  id: string;
  name: string;
  price: number;
  campaign_limit: number;
  features: string[];
}

export default function PricingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  useEffect(() => {
    fetchPricingTiers();
    if (session) {
      fetchCurrentSubscription();
    }
  }, [session]);

  const fetchPricingTiers = async () => {
    try {
      const response = await fetch('/api/stripe/pricing-tiers');
      if (response.ok) {
        const data = await response.json();
        setTiers(data);
      }
    } catch (error) {
      console.error('Error fetching pricing tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const response = await fetch('/api/stripe/subscriptions/current', {
        headers: {
          Authorization: `Bearer ${session?.accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setCurrentTier(data.tier);
        }
      }
    } catch (error) {
      console.error('Error fetching current subscription:', error);
    }
  };

  const handleSelectPlan = (tierId: string) => {
    if (!session) {
      router.push('/login');
      return;
    }
    router.push(`/dashboard/billing/subscribe?tier=${tierId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-gray-600">
          Select the perfect plan for your marketing automation needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {tiers.map((tier) => (
          <Card 
            key={tier.id} 
            className={`relative ${tier.id === 'pro' ? 'border-2 border-blue-500' : ''}`}
          >
            {tier.id === 'pro' && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">${tier.price}</span>
                <span className="text-gray-500">/month</span>
              </CardDescription>
              <div className="mt-4">
                {tier.campaign_limit === -1 ? (
                  <p className="text-sm text-gray-600">Unlimited campaigns</p>
                ) : (
                  <p className="text-sm text-gray-600">Up to {tier.campaign_limit} campaigns/month</p>
                )}
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                variant={currentTier === tier.id ? 'outline' : 'default'}
                onClick={() => handleSelectPlan(tier.id)}
                disabled={currentTier === tier.id}
              >
                {currentTier === tier.id ? 'Current Plan' : 'Select Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="mt-12 text-center">
        <h2 className="text-2xl font-semibold mb-4">Usage-Based Pricing</h2>
        <p className="text-gray-600 mb-6">
          Additional services are billed based on usage
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Image Generation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.10</p>
              <p className="text-sm text-gray-500">per image</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">SMS Messages</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.05</p>
              <p className="text-sm text-gray-500">per SMS</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Email Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">$0.001</p>
              <p className="text-sm text-gray-500">per email</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}