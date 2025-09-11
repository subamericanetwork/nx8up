import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Link, 
  Unlink, 
  Youtube, 
  Instagram, 
  Music, 
  Twitter,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface SocialMediaAccount {
  id: string;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name: string;
  profile_image_url?: string;
  is_active: boolean;
  connected_at: string;
  last_synced_at?: string;
  access_token?: string;
}

const platformConfig = {
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    description: 'Connect your YouTube channel to track subscribers, views, and video performance'
  },
  instagram: {
    name: 'Instagram', 
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    description: 'Connect your Instagram account to track followers, engagement, and post performance'
  },
  tiktok: {
    name: 'TikTok',
    icon: Music,
    color: 'text-black',
    bgColor: 'bg-gray-50', 
    description: 'Connect your TikTok account to track followers, views, and video engagement'
  },
  twitter: {
    name: 'Twitter/X',
    icon: Twitter,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: 'Connect your Twitter account to track followers, tweets, and engagement'
  }
};

export default function SocialMediaConnections() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialMediaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadConnectedAccounts();
  }, [user]);

  const loadConnectedAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('creator_id', user!.id)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading social media accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load connected accounts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnecting(platform);
    
    try {
      // Call our OAuth edge function to start the flow
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: { 
          action: 'connect',
          platform,
          redirect_url: `${window.location.origin}/creator-dashboard`
        }
      });

      if (error) throw error;

      if (data?.auth_url) {
        // Redirect to the OAuth provider
        window.location.href = data.auth_url;
      } else {
        throw new Error('No authentication URL received');
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${platformConfig[platform as keyof typeof platformConfig]?.name}. Please try again.`,
        variant: 'destructive'
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string, platform: string) => {
    try {
      const { error } = await supabase
        .from('social_media_accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) throw error;

      setAccounts(accounts.map(account => 
        account.id === accountId 
          ? { ...account, is_active: false }
          : account
      ));

      toast({
        title: 'Account Disconnected',
        description: `${platformConfig[platform as keyof typeof platformConfig]?.name} account has been disconnected`
      });
    } catch (error) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect account',
        variant: 'destructive'
      });
    }
  };

  const getAccountStatus = (account: SocialMediaAccount) => {
    if (!account.is_active) {
      return { status: 'disconnected', color: 'bg-gray-100 text-gray-800', icon: Unlink };
    }
    
    if (account.last_synced_at) {
      const lastSync = new Date(account.last_synced_at);
      const hoursAgo = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) {
        return { status: 'synced', color: 'bg-green-100 text-green-800', icon: CheckCircle };
      } else {
        return { status: 'stale', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      }
    }
    
    return { status: 'pending', color: 'bg-blue-100 text-blue-800', icon: AlertCircle };
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Social Media Connections</h2>
        <p className="text-muted-foreground">
          Connect your social media accounts to automatically sync your stats and enable seamless collaboration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(platformConfig).map(([platform, config]) => {
          const connectedAccount = accounts.find(acc => acc.platform === platform && acc.is_active);
          const Icon = config.icon;
          const status = connectedAccount ? getAccountStatus(connectedAccount) : null;
          const StatusIcon = status?.icon;

          return (
            <Card key={platform} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-6 w-6 ${config.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      {connectedAccount && (
                        <CardDescription>@{connectedAccount.username}</CardDescription>
                      )}
                    </div>
                  </div>
                  
                  {status && (
                    <Badge className={status.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>
                
                {connectedAccount ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Connected:</span>
                      <span>{new Date(connectedAccount.connected_at).toLocaleDateString()}</span>
                    </div>
                    
                    {connectedAccount.last_synced_at && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Last synced:</span>
                        <span>{new Date(connectedAccount.last_synced_at).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadConnectedAccounts()}
                        className="flex-1"
                      >
                        Sync Now
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDisconnect(connectedAccount.id, platform)}
                        className="flex-1"
                      >
                        <Unlink className="h-4 w-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => handleConnect(platform)}
                    disabled={connecting === platform}
                    className="w-full"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    {connecting === platform ? 'Connecting...' : `Connect ${config.name}`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {accounts.filter(acc => acc.is_active).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts Summary</CardTitle>
            <CardDescription>Overview of your connected social media accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {accounts.filter(acc => acc.is_active).map((account) => {
                const config = platformConfig[account.platform as keyof typeof platformConfig];
                const Icon = config?.icon || Link;
                
                return (
                  <div key={account.id} className="text-center">
                    <div className={`inline-flex p-3 rounded-full ${config?.bgColor || 'bg-gray-50'} mb-2`}>
                      <Icon className={`h-6 w-6 ${config?.color || 'text-gray-600'}`} />
                    </div>
                    <p className="font-medium">{config?.name || account.platform}</p>
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}