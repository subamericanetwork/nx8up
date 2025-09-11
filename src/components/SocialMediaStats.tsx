import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Instagram, 
  Youtube, 
  Twitter,
  TrendingUp,
  Users,
  Heart,
  Eye,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Unlink
} from 'lucide-react';

interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  profile_image_url: string;
  is_active: boolean;
  last_synced_at: string;
  social_media_stats: Array<{
    followers_count: number;
    following_count: number;
    posts_count: number;
    likes_count: number;
    views_count: number;
    engagement_rate: number;
    recorded_at: string;
  }>;
}

const platformIcons = {
  youtube: Youtube,
  instagram: Instagram,
  twitter: Twitter,
  tiktok: () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-.88-.05A6.33 6.33 0 0 0 5.16 20.5a6.34 6.34 0 0 0 10.86-4.43V7.83a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.26z"/>
    </svg>
  )
};

const platformColors = {
  youtube: 'text-red-500',
  instagram: 'text-pink-500',
  twitter: 'text-blue-500',
  tiktok: 'text-gray-800'
};

export default function SocialMediaStats() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadSocialAccounts();
      
      // Handle OAuth callback if present in URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const platform = urlParams.get('platform');
      const state = urlParams.get('state');
      
      console.log('Checking URL params:', { code: !!code, platform, state });
      
      if (code && platform) {
        console.log('OAuth callback detected, processing...');
        handleOAuthCallback(code, platform, state);
      }
    }
  }, [user]);

  const handleOAuthCallback = async (code: string, platform: string, state: string | null) => {
    console.log('Processing OAuth callback:', { platform, code: !!code, state });
    
    try {
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: {
          action: 'callback',
          platform: platform,
          code: code,
          state: state,
          redirect_url: window.location.origin + '/creator-dashboard'
        }
      });

      console.log('OAuth callback response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('OAuth callback error:', data.error);
        throw new Error(data.error);
      }

      if (data?.success) {
        console.log('OAuth callback successful:', data);
        
        toast({
          title: 'Success!',
          description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} account connected successfully!`,
        });
        
        // Clear URL parameters and reload accounts
        window.history.replaceState({}, document.title, window.location.pathname);
        await loadSocialAccounts();
      } else {
        console.error('Unexpected response format:', data);
        throw new Error('Unexpected response from OAuth callback');
      }
    } catch (error: any) {
      console.error('OAuth callback error:', error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${platform} account: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      });
      
      // Clear URL parameters even on error
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const loadSocialAccounts = async () => {
    try {
      // Get accounts using the secure function
      const { data: accountsData, error: accountsError } = await supabase
        .rpc('social_media_accounts_safe');

      if (accountsError) throw accountsError;

      // Get stats for each account
      const accountsWithStats = await Promise.all(
        (accountsData || []).map(async (account: any) => {
          const { data: statsData } = await supabase
            .from('social_media_stats')
            .select(`
              followers_count,
              following_count,
              posts_count,
              likes_count,
              views_count,
              engagement_rate,
              recorded_at
            `)
            .eq('account_id', account.id)
            .order('recorded_at', { ascending: false })
            .limit(1);

          return {
            ...account,
            social_media_stats: statsData || []
          };
        })
      );

      setAccounts(accountsWithStats || []);
    } catch (error) {
      console.error('Error loading social accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load social media accounts',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAccount = async (platform: string) => {
    try {
      // Call OAuth function to get auth URL
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: {
          action: 'connect',
          platform: platform,
          redirect_url: window.location.origin + '/creator-dashboard'
        }
      });

      if (error) throw error;

      if (data?.auth_url) {
        // Redirect to OAuth provider
        window.location.href = data.auth_url;
      } else {
        throw new Error('No auth URL received');
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      toast({
        title: 'Error',
        description: `Failed to connect ${platform}. Please try again.`,
        variant: 'destructive'
      });
    }
  };

  const handleSyncStats = async (accountId: string, platform: string) => {
    setSyncing(accountId);
    try {
      console.log(`Syncing stats for ${platform} account:`, accountId);
      
      // Call edge function to sync stats
      const { data, error } = await supabase.functions.invoke('sync-social-stats', {
        body: { accountId }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      console.log('Stats sync response:', data);
      
      // Reload accounts to show updated stats
      await loadSocialAccounts();
      
      toast({
        title: 'Success',
        description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} stats updated! ${data?.stats ? `Found ${data.stats.followers_count} followers` : ''}`,
      });
    } catch (error: any) {
      console.error('Error syncing stats:', error);
      
      let errorMessage = `Failed to sync ${platform} stats`;
      if (error.message?.includes('YouTube API')) {
        errorMessage = 'YouTube API access issue. Try reconnecting your account.';
      } else if (error.message?.includes('access token')) {
        errorMessage = 'Authentication expired. Please reconnect your account.';
      }
      
      toast({
        title: 'Sync Failed',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setSyncing(null);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Social Media Statistics</CardTitle>
          <CardDescription>Loading your connected accounts...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Accounts Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((account) => {
          const Icon = platformIcons[account.platform as keyof typeof platformIcons];
          const latestStats = account.social_media_stats?.[0];
          
          return (
             <Card key={account.id} className="hover:shadow-md transition-shadow border-l-4 border-l-green-500 bg-green-50/50 dark:bg-green-950/50">
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <div className="flex items-center space-x-2">
                   <Icon className={`h-5 w-5 ${platformColors[account.platform as keyof typeof platformColors]}`} />
                   <CardTitle className="text-sm font-medium capitalize">
                     {account.platform}
                   </CardTitle>
                   <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                 </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSyncStats(account.id, account.platform)}
                      disabled={syncing === account.id}
                      title={`Refresh ${account.platform} stats`}
                    >
                      <RefreshCw className={`h-3 w-3 ${syncing === account.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
               </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">@{account.username}</span>
                    <Badge variant="outline" className="text-xs">
                      {latestStats ? formatNumber(latestStats.followers_count) : '0'} followers
                    </Badge>
                  </div>
                  
                  {latestStats && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center space-x-1">
                        <Heart className="h-3 w-3 text-red-500" />
                        <span>{formatNumber(latestStats.likes_count)}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Eye className="h-3 w-3 text-blue-500" />
                        <span>{formatNumber(Number(latestStats.views_count))}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span>{latestStats.engagement_rate?.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-muted-foreground">{latestStats.posts_count} posts</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Connect New Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>Connect Social Media Accounts</CardTitle>
          <CardDescription>
            Link your social media accounts to display real-time statistics and attract more sponsors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(platformIcons).map(([platform, Icon]) => {
              const isConnected = accounts.some(acc => acc.platform === platform);
              const connectedAccount = accounts.find(acc => acc.platform === platform);
              
              return (
                <div key={platform} className="relative">
                  <Button
                    variant={isConnected ? "default" : "outline"}
                    className={`h-20 flex-col space-y-2 w-full transition-all duration-200 ${
                      isConnected 
                        ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100 dark:bg-green-950 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900' 
                        : 'hover:border-green-200 hover:bg-green-50/50'
                    }`}
                    onClick={() => !isConnected && handleConnectAccount(platform)}
                    disabled={isConnected}
                  >
                    <div className="flex items-center space-x-1">
                      <Icon className={`h-6 w-6 ${platformColors[platform as keyof typeof platformColors]}`} />
                      {isConnected && (
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    <span className="capitalize text-xs font-medium">
                      {isConnected ? 'Connected' : `Connect ${platform}`}
                    </span>
                    {isConnected && connectedAccount && (
                      <div className="flex flex-col items-center space-y-1">
                        <span className="text-xs text-muted-foreground">@{connectedAccount.username}</span>
                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <Users className="h-3 w-3 mr-1" />
                          {formatNumber(connectedAccount.social_media_stats?.[0]?.followers_count || 0)}
                        </Badge>
                      </div>
                    )}
                  </Button>
                  {isConnected && (
                    <div className="absolute -top-2 -right-2 z-10">
                      <div className="bg-green-500 text-white rounded-full p-1 shadow-md">
                        <CheckCircle className="h-4 w-4" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Stats */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Analytics</CardTitle>
            <CardDescription>
              Comprehensive overview of your social media performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {accounts.map((account) => {
                const Icon = platformIcons[account.platform as keyof typeof platformIcons];
                const latestStats = account.social_media_stats?.[0];
                
                if (!latestStats) return null;
                
                return (
                  <div key={account.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-6 w-6 ${platformColors[account.platform as keyof typeof platformColors]}`} />
                        <div>
                          <h3 className="font-semibold capitalize">{account.platform}</h3>
                          <p className="text-sm text-muted-foreground">@{account.username}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatNumber(latestStats.followers_count)}
                        </div>
                        <div className="text-xs text-muted-foreground">Followers</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-green-600">
                          {formatNumber(latestStats.likes_count)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Likes</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-purple-600">
                          {formatNumber(Number(latestStats.views_count))}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Views</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-orange-600">
                          {latestStats.engagement_rate?.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Engagement</div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-2xl font-bold text-gray-600">
                          {formatNumber(latestStats.posts_count)}
                        </div>
                        <div className="text-xs text-muted-foreground">Posts</div>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground text-right">
                      Last updated: {new Date(latestStats.recorded_at).toLocaleString()}
                    </div>
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