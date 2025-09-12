import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Youtube, 
  Instagram, 
  Music, 
  Twitter,
  Settings,
  X
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
}

const platformConfig = {
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-500',
    description: 'Connect your YouTube channel to track subscribers and video performance',
    available: true
  },
  instagram: {
    name: 'Instagram', 
    icon: Instagram,
    color: 'text-pink-500',
    description: 'Connect your Instagram account to track followers and engagement',
    available: true
  },
  tiktok: {
    name: 'TikTok',
    icon: Music,
    color: 'text-black',
    description: 'Connect your TikTok account to track followers and video metrics',
    available: false
  },
  twitter: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: 'text-black',
    description: 'Connect your X account to track followers and engagement',
    available: false
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
        .rpc('social_media_accounts_safe')
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
    console.log('=== CONNECT BUTTON CLICKED ===', { platform, user: !!user });
    
    const config = platformConfig[platform as keyof typeof platformConfig];
    
    if (!config?.available) {
      console.log('Platform not available:', platform);
      toast({
        title: 'Coming Soon',
        description: `${config.name} integration will be available soon!`,
        variant: 'default'
      });
      return;
    }

    setConnecting(platform);
    
    try {
      console.log('Starting OAuth flow for platform:', platform);
      console.log('Current window.location.href:', window.location.href);
      console.log('Current window.location.origin:', window.location.origin);
      
      // Use the correct OAuth callback URL (not dashboard)
      const redirectUrl = 'https://nx8up.lovable.app/oauth/callback';
        
      console.log('Redirect URL will be:', redirectUrl);
        
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: { 
          action: 'connect',
          platform,
          redirect_url: redirectUrl
        }
      });

      console.log('OAuth initiation response:', { data, error, platform });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }

      if (data?.auth_url) {
        console.log('Opening popup for auth URL:', data.auth_url);
        
        // Open popup window for OAuth
        const popup = window.open(
          data.auth_url,
          'oauth-popup',
          'width=600,height=700,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no'
        );
        
        if (!popup) {
          throw new Error('Popup blocked. Please allow popups for this site and try again.');
        }
        
        // Set up message listener for OAuth callback
        const messageListener = (event: MessageEvent) => {
          console.log('Received message from popup:', event.data, 'from origin:', event.origin);
          
          // Accept messages from any origin for cross-origin compatibility
          if (event.data?.type === 'OAUTH_CALLBACK') {
            const { success, error, account, platform: callbackPlatform } = event.data;
            
            // Clean up immediately
            cleanup();
            
            if (error) {
              console.error('OAuth error from popup:', error);
              toast({
                title: 'Connection Failed',
                description: error || 'OAuth authorization failed',
                variant: 'destructive'
              });
              setConnecting(null);
              return;
            }

            if (success && account) {
              console.log('OAuth success via message:', account);
              toast({
                title: 'Connected Successfully!',
                description: `Your ${account.platform || callbackPlatform || platform} account has been connected`,
              });
              setConnecting(null);
              // Refresh accounts list
              setTimeout(() => loadConnectedAccounts(), 1000);
            }
          }
        };
        
        // Cleanup function
        const cleanup = () => {
          if (checkClosed) {
            clearInterval(checkClosed);
          }
          window.removeEventListener('message', messageListener);
          try {
            if (!popup.closed) {
              popup.close();
            }
          } catch (e) {
            console.log('Popup already closed');
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Simple popup monitoring - only check if closed
        const checkClosed = setInterval(() => {
          try {
            if (popup.closed) {
              console.log('Popup was closed by user');
              cleanup();
              setConnecting(null);
              // Refresh accounts to see if connection was successful
              setTimeout(() => loadConnectedAccounts(), 1000);
              return;
            }
          } catch (error) {
            console.log('Error checking popup status:', error);
            cleanup();
            setConnecting(null);
          }
        }, 1000); // Check less frequently

        // Add timeout to prevent infinite waiting
        setTimeout(() => {
          try {
            if (!popup.closed) {
              console.log('OAuth timeout - closing popup');
              cleanup();
              setConnecting(null);
              toast({
                title: 'Connection Timeout',
                description: 'The connection process took too long. Please try again.',
                variant: 'destructive'
              });
            }
          } catch (e) {
            console.log('Timeout cleanup already handled');
          }
        }, 120000); // 2 minute timeout
        
      } else {
        console.error('No auth URL in response:', data);
        throw new Error('No authentication URL received');
      }
    } catch (error) {
      console.error('Error connecting account:', error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${config?.name}: ${error.message || 'Unknown error'}`,
        variant: 'destructive'
      });
      setConnecting(null);
    }
  };

  // Reload accounts when needed (called from parent component after OAuth success)
  const refreshAccounts = async () => {
    await loadConnectedAccounts();
  };

  const handleDisconnect = async (accountId: string, platform: string) => {
    try {
      console.log('Disconnecting account:', { accountId, platform });
      
      // Instead of just setting is_active to false, actually delete the account and tokens
      const { error: deleteError } = await supabase
        .from('social_media_accounts')
        .delete()
        .eq('id', accountId);

      if (deleteError) {
        console.error('Error deleting account:', deleteError);
        throw deleteError;
      }

      // Remove from local state
      setAccounts(accounts.filter(account => account.id !== accountId));

      console.log('Account disconnected successfully');
      toast({
        title: 'Account Disconnected',
        description: `${platformConfig[platform as keyof typeof platformConfig]?.name} account has been disconnected and removed`
      });
    } catch (error: any) {
      console.error('Error disconnecting account:', error);
      toast({
        title: 'Error',
        description: `Failed to disconnect account: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Connect Socials</h2>
        <p className="text-muted-foreground">
          Connect your social media accounts to allow publishing on your behalf.
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(platformConfig).map(([platform, config]) => {
          const connectedAccount = accounts.find(acc => acc.platform === platform && acc.is_active);
          const Icon = config.icon;
          const isConnected = !!connectedAccount;

          return (
            <div key={platform} className="flex items-center justify-between p-4 bg-background border rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium">{config.name}</h3>
                  {isConnected && connectedAccount && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        {connectedAccount.username}
                      </span>
                      {platform === 'instagram' && connectedAccount.username && (
                        <span className="text-xs text-muted-foreground">
                          Analytics not available
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(connectedAccount!.id, platform)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(platform)}
                    disabled={connecting === platform || !config.available}
                    className="px-4"
                  >
                    {connecting === platform 
                      ? 'Connecting...' 
                      : config.available 
                        ? 'Connect' 
                        : 'Coming Soon'
                    }
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}