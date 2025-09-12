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
      
      // Use the production domain for OAuth redirect
      const redirectUrl = window.location.hostname.includes('sandbox.lovable.dev') 
        ? 'https://nx8up.loveable.app/creator-dashboard'
        : `${window.location.origin}/creator-dashboard`;
        
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
        
        // Monitor popup for completion and OAuth callback
        const checkClosed = setInterval(() => {
          try {
            // Check if popup is closed
            if (popup.closed) {
              clearInterval(checkClosed);
              setConnecting(null);
              // Refresh accounts to see if connection was successful
              setTimeout(() => loadConnectedAccounts(), 1000);
              return;
            }

            // Try to access popup URL to detect callback
            try {
              const popupUrl = popup.location.href;
              console.log('Popup URL:', popupUrl);
              
              // Check if we're back on our domain (handle all Lovable domains)
              if (popupUrl.includes(window.location.origin) || 
                  popupUrl.includes('lovable.app') || 
                  popupUrl.includes('lovable.dev') ||
                  popupUrl.includes('sandbox.lovable.dev')) {
                const urlParams = new URLSearchParams(new URL(popupUrl).search);
                const code = urlParams.get('code');
                const error = urlParams.get('error');
                const state = urlParams.get('state');
                
                // Extract platform from state if available
                let callbackPlatform = platform;
                if (state && state.includes('|')) {
                  callbackPlatform = state.split('|')[1];
                }
                
                console.log('Callback detected:', { code: !!code, error, platform: callbackPlatform });
                
                if (code || error) {
                  // OAuth callback detected - process it
                  clearInterval(checkClosed);
                  popup.close();
                  
                  if (error) {
                    console.error('OAuth error in popup:', error);
                    toast({
                      title: 'Connection Failed',
                      description: 'OAuth authorization was denied or failed',
                      variant: 'destructive'
                    });
                    setConnecting(null);
                    return;
                  }

                  if (code) {
                    console.log('OAuth code received, processing callback...');
                    // Process the OAuth callback
                    handleOAuthCallback(callbackPlatform, code);
                  }
                }
              }
            } catch (e) {
              // Cross-origin error - popup is still on OAuth provider's domain
              // This is expected, continue monitoring
              console.log('Cross-origin access blocked (expected while on OAuth provider)');
            }
          } catch (error) {
            // If we can't access the popup, it might be closed
            console.error('Error monitoring popup:', error);
            if (popup.closed) {
              clearInterval(checkClosed);
              setConnecting(null);
            }
          }
        }, 500); // Check more frequently

        // Also add a timeout to prevent infinite waiting
        setTimeout(() => {
          if (!popup.closed) {
            clearInterval(checkClosed);
            popup.close();
            setConnecting(null);
            console.log('OAuth timeout - closing popup');
            toast({
              title: 'Connection Timeout',
              description: 'The connection process took too long. Please try again.',
              variant: 'destructive'
            });
          }
        }, 300000); // 5 minute timeout
        
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

  const handleOAuthCallback = async (platform: string, code: string) => {
    try {
      console.log('Processing OAuth callback for platform:', platform);
      
      const { data, error } = await supabase.functions.invoke('social-oauth', {
        body: { 
          action: 'callback',
          platform,
          code,
          redirect_url: `${window.location.origin}/creator-dashboard`
        }
      });

      if (error) {
        console.error('OAuth callback error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('OAuth callback failed:', data);
        throw new Error(data?.error || 'Connection failed');
      }

      console.log('OAuth callback successful:', data);
      
      toast({
        title: 'Connected Successfully!',
        description: `Your ${platform} account has been connected`,
      });

      // Refresh the accounts list
      setTimeout(() => loadConnectedAccounts(), 1000);

    } catch (error) {
      console.error('OAuth callback processing error:', error);
      toast({
        title: 'Connection Failed',
        description: `Failed to connect ${platform} account: ${error.message || 'Please try again.'}`,
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