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
  ExternalLink
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
    }
  }, [user]);

  const loadSocialAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('social_media_accounts')
        .select(`
          *,
          social_media_stats(
            followers_count,
            following_count,
            posts_count,
            likes_count,
            views_count,
            engagement_rate,
            recorded_at
          )
        `)
        .eq('creator_id', user?.id)
        .eq('is_active', true)
        .order('recorded_at', { 
          foreignTable: 'social_media_stats', 
          ascending: false 
        });

      if (error) throw error;
      setAccounts(data || []);
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

  const handleConnectAccount = (platform: string) => {
    // This will trigger OAuth flow - for now show coming soon
    toast({
      title: 'Coming Soon',
      description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} integration will be available soon!`,
    });
  };

  const handleSyncStats = async (accountId: string, platform: string) => {
    setSyncing(accountId);
    try {
      // Call edge function to sync stats
      const { error } = await supabase.functions.invoke('sync-social-stats', {
        body: { accountId }
      });

      if (error) throw error;
      
      // Reload accounts to show updated stats
      await loadSocialAccounts();
      
      toast({
        title: 'Success',
        description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} stats updated!`,
      });
    } catch (error) {
      console.error('Error syncing stats:', error);
      toast({
        title: 'Error',
        description: `Failed to sync ${platform} stats`,
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
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center space-x-2">
                  <Icon className={`h-5 w-5 ${platformColors[account.platform as keyof typeof platformColors]}`} />
                  <CardTitle className="text-sm font-medium capitalize">
                    {account.platform}
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSyncStats(account.id, account.platform)}
                  disabled={syncing === account.id}
                >
                  <RefreshCw className={`h-3 w-3 ${syncing === account.id ? 'animate-spin' : ''}`} />
                </Button>
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
              
              return (
                <Button
                  key={platform}
                  variant={isConnected ? "secondary" : "outline"}
                  className="h-20 flex-col space-y-2"
                  onClick={() => !isConnected && handleConnectAccount(platform)}
                  disabled={isConnected}
                >
                  <Icon className={`h-6 w-6 ${platformColors[platform as keyof typeof platformColors]}`} />
                  <span className="capitalize text-xs">
                    {isConnected ? 'Connected' : `Connect ${platform}`}
                  </span>
                  {isConnected && (
                    <Badge variant="outline" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {formatNumber(accounts.find(acc => acc.platform === platform)?.social_media_stats?.[0]?.followers_count || 0)}
                    </Badge>
                  )}
                </Button>
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