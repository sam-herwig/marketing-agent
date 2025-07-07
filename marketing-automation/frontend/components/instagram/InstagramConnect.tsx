'use client';

import { useState, useEffect } from 'react';
import { instagramAPI, InstagramAccount } from '@/lib/instagram';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Instagram, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

export function InstagramConnect() {
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await instagramAPI.getAccounts();
      setAccounts(data);
    } catch (err) {
      setError('Failed to load Instagram accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      const { oauth_url } = await instagramAPI.getOAuthUrl();
      window.location.href = oauth_url;
    } catch (err) {
      setError('Failed to initiate Instagram connection');
      console.error(err);
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: number) => {
    if (!confirm('Are you sure you want to disconnect this Instagram account?')) {
      return;
    }

    try {
      await instagramAPI.disconnectAccount(accountId);
      await loadAccounts();
    } catch (err) {
      setError('Failed to disconnect Instagram account');
      console.error(err);
    }
  };

  const getStatusIcon = (status: InstagramAccount['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'expired':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'error':
      case 'disconnected':
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusText = (status: InstagramAccount['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'expired':
        return 'Token Expired';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5" />
            Instagram Business Accounts
          </CardTitle>
          <CardDescription>
            Connect your Instagram Business Accounts to publish posts and track analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <Instagram className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                No Instagram accounts connected yet
              </p>
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Connect Instagram Account'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {account.profile_data?.profile_picture_url ? (
                      <img
                        src={account.profile_data.profile_picture_url}
                        alt={account.instagram_username}
                        className="h-10 w-10 rounded-full"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Instagram className="h-5 w-5 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">@{account.instagram_username}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getStatusIcon(account.status)}
                        <span>{getStatusText(account.status)}</span>
                        {account.profile_data?.followers_count && (
                          <span className="ml-2">
                            {account.profile_data.followers_count.toLocaleString()} followers
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(account.id)}
                  >
                    Disconnect
                  </Button>
                </div>
              ))}
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full"
                >
                  {connecting ? 'Connecting...' : 'Connect Another Account'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}