import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OAuthConfig {
  client_id: string;
  redirect_uri: string;
  scope: string;
  auth_url: string;
  token_url: string;
}

const getOAuthConfig = (platform: string, redirectUrl: string): OAuthConfig | null => {
  const baseRedirectUri = `${redirectUrl}?platform=${platform}`;
  
  switch (platform) {
    case 'youtube':
      return {
        client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
        redirect_uri: baseRedirectUri,
        scope: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile',
        auth_url: 'https://accounts.google.com/o/oauth2/v2/auth',
        token_url: 'https://oauth2.googleapis.com/token'
      };
    
    case 'instagram':
      return {
        client_id: Deno.env.get('INSTAGRAM_CLIENT_ID') || '',
        redirect_uri: baseRedirectUri,
        scope: 'user_profile,user_media',
        auth_url: 'https://api.instagram.com/oauth/authorize',
        token_url: 'https://api.instagram.com/oauth/access_token'
      };
    
    case 'tiktok':
      return {
        client_id: Deno.env.get('TIKTOK_CLIENT_ID') || '',
        redirect_uri: baseRedirectUri,
        scope: 'user.info.basic,video.list',
        auth_url: 'https://www.tiktok.com/auth/authorize/',
        token_url: 'https://open-api.tiktok.com/oauth/access_token/'
      };
    
    case 'twitter':
      return {
        client_id: Deno.env.get('TWITTER_CLIENT_ID') || '',
        redirect_uri: baseRedirectUri,
        scope: 'tweet.read users.read follows.read',
        auth_url: 'https://twitter.com/i/oauth2/authorize',
        token_url: 'https://api.twitter.com/2/oauth2/token'
      };
    
    default:
      return null;
  }
};

const exchangeCodeForToken = async (platform: string, code: string, config: OAuthConfig): Promise<any> => {
  const tokenData = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.client_id,
    client_secret: Deno.env.get(`${platform.toUpperCase()}_CLIENT_SECRET`) || '',
    redirect_uri: config.redirect_uri,
    code: code
  });

  const response = await fetch(config.token_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenData
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.statusText}`);
  }

  return await response.json();
};

const getUserInfo = async (platform: string, accessToken: string): Promise<any> => {
  let userInfoUrl = '';
  let headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`
  };

  switch (platform) {
    case 'youtube':
      userInfoUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
      break;
    case 'instagram':
      userInfoUrl = `https://graph.instagram.com/me?fields=id,username,account_type,media_count&access_token=${accessToken}`;
      headers = {}; // Instagram uses access_token in URL
      break;
    case 'tiktok':
      userInfoUrl = 'https://open-api.tiktok.com/oauth/userinfo/';
      break;
    case 'twitter':
      userInfoUrl = 'https://api.twitter.com/2/users/me';
      break;
  }

  const response = await fetch(userInfoUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return await response.json();
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Social OAuth function called');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    const { action, platform, redirect_url, code, state } = requestBody;

    console.log('OAuth request:', { action, platform, redirect_url, code: !!code, state });

    // Check if required environment variables exist
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    console.log('Environment check:', {
      hasGoogleClientId: !!googleClientId,
      hasGoogleClientSecret: !!googleClientSecret,
      googleClientIdLength: googleClientId?.length || 0
    });

    if (action === 'connect') {
      // Step 1: Generate OAuth URL
      const config = getOAuthConfig(platform, redirect_url);
      
      if (!config || !config.client_id) {
        console.error(`OAuth not configured for ${platform}`, { config });
        throw new Error(`OAuth not configured for ${platform}. Missing client ID.`);
      }

      // Generate state parameter for CSRF protection
      const stateParam = crypto.randomUUID();
      
      const authUrl = new URL(config.auth_url);
      authUrl.searchParams.set('client_id', config.client_id);
      authUrl.searchParams.set('redirect_uri', config.redirect_uri);
      authUrl.searchParams.set('scope', config.scope);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', stateParam);

      console.log('Generated auth URL:', authUrl.toString());

      return new Response(
        JSON.stringify({ 
          auth_url: authUrl.toString(),
          state: stateParam 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } else if (action === 'callback') {
      // Step 2: Handle OAuth callback
      if (!code) {
        throw new Error('Authorization code not provided');
      }

      const config = getOAuthConfig(platform, redirect_url);
      if (!config) {
        throw new Error(`OAuth not configured for ${platform}`);
      }

      // Exchange code for access token
      const tokenResponse = await exchangeCodeForToken(platform, code, config);
      console.log('Token exchange successful for platform:', platform);

      // Get user information
      const userInfo = await getUserInfo(platform, tokenResponse.access_token);
      console.log('User info retrieved for platform:', platform, userInfo);

      // Get the current user from the auth header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('No authorization header provided');
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        throw new Error('Invalid user token');
      }

      // Store the connection in our database - first without tokens
      const socialAccountData = {
        creator_id: user.id,
        platform: platform,
        platform_user_id: userInfo.id || userInfo.data?.user?.id,
        username: userInfo.login || userInfo.username || userInfo.data?.user?.username,
        display_name: userInfo.name || userInfo.display_name || userInfo.data?.user?.display_name,
        profile_image_url: userInfo.picture || userInfo.profile_image_url || userInfo.avatar_url,
        token_expires_at: tokenResponse.expires_in ? 
          new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : null,
        is_active: true,
        connected_at: new Date().toISOString()
      };

      const { data: accountData, error: accountError } = await supabase
        .from('social_media_accounts')
        .upsert(socialAccountData, {
          onConflict: 'creator_id,platform,platform_user_id'
        })
        .select()
        .single();

      if (accountError) {
        console.error('Database error:', accountError);
        throw new Error('Failed to store account connection');
      }

      // Now securely update the encrypted tokens using the secure function
      const { error: tokenUpdateError } = await supabase
        .rpc('update_encrypted_tokens', {
          account_id: accountData.id,
          new_access_token: tokenResponse.access_token,
          new_refresh_token: tokenResponse.refresh_token
        });

      if (tokenUpdateError) {
        console.error('Error updating encrypted tokens:', tokenUpdateError);
        throw new Error('Failed to store tokens securely');
      }

      console.log('Account stored successfully:', accountData.id);

      // Automatically sync stats for the newly connected account
      try {
        console.log('Attempting to sync stats for newly connected account...');
        const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-social-stats', {
          body: { accountId: accountData.id }
        });
        
        if (syncError) {
          console.error('Failed to sync stats after connection:', syncError);
        } else {
          console.log('Successfully synced stats after connection:', syncResult);
        }
      } catch (syncError) {
        console.error('Error calling sync-social-stats:', syncError);
        // Don't fail the connection if stats sync fails
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          account: {
            id: accountData.id,
            platform: accountData.platform,
            username: accountData.username,
            display_name: accountData.display_name,
            profile_image_url: accountData.profile_image_url,
            connected_at: accountData.connected_at
          },
          message: `${platform} account connected successfully!`
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    throw new Error('Invalid action specified');

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Check the function logs for more information'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});