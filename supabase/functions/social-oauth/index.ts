import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
}

serve(async (req) => {
  console.log('=== OAUTH FUNCTION START ===');
  console.log('Method:', req.method, 'URL:', req.url);
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Handling CORS OPTIONS request');
      return new Response(null, { headers: corsHeaders });
    }

    console.log('=== ENVIRONMENT CHECK ===');
    console.log('SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'));
    console.log('GOOGLE_CLIENT_ID exists:', !!Deno.env.get('GOOGLE_CLIENT_ID'));
    console.log('GOOGLE_CLIENT_SECRET exists:', !!Deno.env.get('GOOGLE_CLIENT_SECRET'));
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    if (!Deno.env.get('GOOGLE_CLIENT_ID')) {
      return new Response(JSON.stringify({ 
        error: 'GOOGLE_CLIENT_ID not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('=== CREATING SUPABASE CLIENT ===');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
    );
    console.log('Supabase client created successfully');

    console.log('=== READING REQUEST BODY ===');
    const bodyText = await req.text();
    console.log('Raw body text:', bodyText);
    
    const body = JSON.parse(bodyText);
    console.log('Parsed request body:', body);

    console.log('=== EXTRACTED PARAMETERS ===');
    const { action, platform, code, redirect_url } = body;
    console.log('action:', action);
    console.log('platform:', platform);
    console.log('code exists:', !!code);
    console.log('code length:', code?.length || 0);

    console.log('=== DOMAIN DETECTION ===');
    console.log('Requested redirect URL:', redirect_url);
    const fallbackOrigin = 'https://nx8up.lovable.app';
    console.log('Fallback origin:', fallbackOrigin);
    const finalRedirectUrl = redirect_url || fallbackOrigin;
    console.log('Final redirect URL:', finalRedirectUrl);

    console.log('Using Google Client ID:', Deno.env.get('GOOGLE_CLIENT_ID')?.substring(0, 15) + '...');

    // ============= CONNECT ACTION =============
    if (action === 'connect') {
      console.log('=== PROCESSING CONNECT REQUEST ===');
      
      // Use consistent redirect URI - must match Google Console configuration exactly
      const authRedirectUri = 'https://nx8up.lovable.app/oauth/callback';
      console.log('Using standardized callback URL:', authRedirectUri);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const state = `${crypto.randomUUID()}|${platform}`;
      
      authUrl.searchParams.set('client_id', Deno.env.get('GOOGLE_CLIENT_ID') || '');
      authUrl.searchParams.set('redirect_uri', authRedirectUri);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/userinfo.profile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      console.log('Generated auth URL:', authUrl.toString());
      
      const connectResponse = { 
        auth_url: authUrl.toString(),
        state: state
      };
      
      console.log('Returning connect response:', connectResponse);
      return new Response(JSON.stringify(connectResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============= CALLBACK ACTION =============
    if (action === 'callback') {
      console.log('=== PROCESSING CALLBACK ===');
      console.log('Step 1: Exchanging code for token...');
      
      // Use the SAME redirect URI as connect - must match Google Console configuration
      const authRedirectUri = 'https://nx8up.lovable.app/oauth/callback';
      console.log('Using standardized callback URL for token exchange:', authRedirectUri);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: authRedirectUri,  // MUST match what was sent to Google
          code: code
        })
      });

      console.log('Token exchange response status:', tokenResponse.status);
      console.log('Token exchange headers:', Object.fromEntries(tokenResponse.headers.entries()));
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.log('Token exchange failed with details:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorText,
          redirect_uri: authRedirectUri,
          has_client_id: !!Deno.env.get('GOOGLE_CLIENT_ID'),
          has_client_secret: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
          code_length: code?.length
        });
        return new Response(JSON.stringify({ 
          error: `Token exchange failed: ${tokenResponse.status} - ${errorText}. Make sure your Google OAuth app is configured with redirect URI: https://nx8up.lovable.app/oauth/callback`,
          details: 'Check Google Cloud Console OAuth configuration'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful, got access token');

      console.log('Step 2: Getting user info...');
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!userResponse.ok) {
        console.log('User info fetch failed:', userResponse.status);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch user info' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const userInfo = await userResponse.json();
      console.log('Got user info for:', userInfo.name);

      console.log('Step 3: Getting YouTube channel...');
      const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      let channelData = null;
      if (channelResponse.ok) {
        const channelResult = await channelResponse.json();
        if (channelResult.items && channelResult.items.length > 0) {
          channelData = channelResult.items[0];
          console.log('Got YouTube channel:', channelData.snippet.title);
        } else {
          console.log('No YouTube channel found for user');
        }
      } else {
        console.log('YouTube API call failed:', channelResponse.status);
      }

      console.log('Step 4: Getting authenticated user...');
      const authHeader = req.headers.get('Authorization');
      console.log('Auth header present:', !!authHeader);
      
      if (!authHeader) {
        console.log('ERROR: No authorization header in callback request');
        return new Response(JSON.stringify({ 
          error: 'Missing authorization header',
          details: 'User session not found during OAuth callback'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      console.log('Supabase auth result:', { 
        hasUser: !!user, 
        userId: user?.id,
        authError: authError?.message 
      });

      if (authError || !user) {
        console.log('Authentication failed with details:', {
          authError: authError?.message,
          hasUser: !!user,
          headerLength: authHeader?.length
        });
        return new Response(JSON.stringify({ 
          error: 'User authentication failed',
          details: authError?.message || 'No user found'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Authenticated user:', user.id);

      console.log('Step 5: Saving to database...');
      const accountData = {
        creator_id: user.id,
        platform: 'youtube',
        platform_user_id: channelData?.id || userInfo.id,
        username: channelData?.snippet?.title || userInfo.name || 'User',
        display_name: channelData?.snippet?.title || userInfo.name || 'User',
        profile_image_url: channelData?.snippet?.thumbnails?.default?.url || userInfo.picture,
        is_active: true,
        connected_at: new Date().toISOString()
      };

      const { data: savedAccount, error: dbError } = await supabase
        .from('social_media_accounts')
        .upsert(accountData, { onConflict: 'creator_id,platform' })
        .select()
        .single();

      if (dbError) {
        console.log('Database error:', dbError.message);
        return new Response(JSON.stringify({ 
          error: `Database error: ${dbError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Account saved successfully:', savedAccount.id);

      console.log('Step 6: Saving tokens securely...');
      console.log('Environment check - SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'));
      console.log('Environment check - SUPABASE_SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
      
      // Create service role client for secure token operations
      const serviceRoleSupabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      console.log('Calling update_encrypted_tokens with account_id:', savedAccount.id);
      const { error: tokenError } = await serviceRoleSupabase.rpc('update_encrypted_tokens', {
        account_id: savedAccount.id,
        new_access_token: tokenData.access_token,
        new_refresh_token: tokenData.refresh_token
      });

      if (tokenError) {
        console.log('Token save error details:', {
          message: tokenError.message,
          code: tokenError.code,
          details: tokenError.details,
          hint: tokenError.hint
        });
        
        // Return error if token saving fails
        return new Response(JSON.stringify({ 
          error: `Failed to save tokens: ${tokenError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        console.log('Tokens saved securely');
      }

      console.log('=== SUCCESS - RETURNING ACCOUNT DATA ===');
      const successResponse = { 
        success: true,
        message: 'YouTube account connected successfully!',
        account: {
          id: savedAccount.id,
          platform: savedAccount.platform,
          username: savedAccount.username,
          display_name: savedAccount.display_name
        }
      };
      
      return new Response(JSON.stringify(successResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('ERROR: Invalid action:', action);
    return new Response(JSON.stringify({ 
      error: 'Invalid action' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log('=== FUNCTION ERROR ===');
    console.log('Error type:', typeof error);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});