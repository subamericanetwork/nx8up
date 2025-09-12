import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== OAUTH FUNCTION START ===');
  console.log('Method:', req.method, 'URL:', req.url);
  console.log('Timestamp:', new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS OPTIONS request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ENVIRONMENT CHECK ===');
    const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
    const hasServiceRole = !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');  
    const hasGoogleClientId = !!Deno.env.get('GOOGLE_CLIENT_ID');
    const hasGoogleSecret = !!Deno.env.get('GOOGLE_CLIENT_SECRET');
    
    console.log('SUPABASE_URL exists:', hasSupabaseUrl);
    console.log('SERVICE_ROLE_KEY exists:', hasServiceRole);
    console.log('GOOGLE_CLIENT_ID exists:', hasGoogleClientId);
    console.log('GOOGLE_CLIENT_SECRET exists:', hasGoogleSecret);
    
    if (!hasGoogleClientId) {
      console.log('ERROR: Missing GOOGLE_CLIENT_ID');
      return new Response(JSON.stringify({ 
        error: 'Google Client ID not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('=== CREATING SUPABASE CLIENT ===');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('Supabase client created successfully');

    console.log('=== READING REQUEST BODY ===');
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('Raw body text:', bodyText);
      requestBody = JSON.parse(bodyText || '{}');
      console.log('Parsed request body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.log('Body parsing error:', parseError.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, platform, code } = requestBody;
    console.log('=== EXTRACTED PARAMETERS ===');
    console.log('action:', action);
    console.log('platform:', platform);
    console.log('code exists:', !!code);
    console.log('code length:', code ? code.length : 0);

    if (!action || !platform) {
      console.log('ERROR: Missing required parameters');
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters: action and platform' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use redirect URL from request body or auto-detect as fallback
    console.log('=== DOMAIN DETECTION ===');
    const requestedRedirectUrl = requestBody.redirect_url;
    const fallbackOrigin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || 'https://36d74c24-a521-4533-aa15-00a437291e31.sandbox.lovable.dev';
    const redirectUrl = requestedRedirectUrl || `${fallbackOrigin}/creator-dashboard`;
    
    console.log('Requested redirect URL:', requestedRedirectUrl);
    console.log('Fallback origin:', fallbackOrigin);
    console.log('Final redirect URL:', redirectUrl);

    if (action === 'connect') {
      console.log('=== PROCESSING CONNECT REQUEST ===');
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      console.log('Using Google Client ID:', clientId?.substring(0, 20) + '...');
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const state = crypto.randomUUID();
      authUrl.searchParams.set('client_id', clientId!);
      // Use the OAuth callback route instead of creator-dashboard directly
      const callbackUrl = redirectUrl.replace('/creator-dashboard', '/oauth/callback');
      console.log('Using callback URL:', callbackUrl);
      
      authUrl.searchParams.set('redirect_uri', callbackUrl);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/userinfo.profile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', `${state}|${platform}`);

      const finalAuthUrl = authUrl.toString();
      console.log('Generated auth URL:', finalAuthUrl);
      
      const response = { 
        auth_url: finalAuthUrl,
        state: authUrl.searchParams.get('state')
      };
      console.log('Returning connect response:', JSON.stringify(response, null, 2));
      
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'callback') {
      console.log('=== PROCESSING CALLBACK REQUEST ===');
      
      if (!code) {
        console.log('ERROR: No authorization code provided');
        return new Response(JSON.stringify({ 
          error: 'No authorization code provided' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Step 1: Exchanging code for token...');
      
      // Token exchange - MUST use the same redirect_uri that was sent to Google
      // Extract the origin and construct the callback URL
      const url = new URL(redirectUrl);
      const callbackUrl = `${url.origin}/oauth/callback`;
      console.log('Using callback URL for token exchange:', callbackUrl);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: callbackUrl,  // MUST match what was sent to Google
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
          redirect_uri: `${redirectUrl}?platform=youtube`,
          has_client_id: !!Deno.env.get('GOOGLE_CLIENT_ID'),
          has_client_secret: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
          code_length: code?.length
        });
        return new Response(JSON.stringify({ 
          error: `Token exchange failed: ${tokenResponse.status} - ${errorText}`,
          details: 'OAuth callback error - check Google Cloud Console configuration'
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
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const userInfo = await userResponse.json();
      console.log('Got user info for:', userInfo.email);

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
      console.log('All headers:', Object.fromEntries(req.headers.entries()));
      
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
          error: 'Invalid user token',
          details: authError?.message || 'User authentication failed'
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
      const { error: tokenError } = await supabase.rpc('update_encrypted_tokens', {
        account_id: savedAccount.id,
        new_access_token: tokenData.access_token,
        new_refresh_token: tokenData.refresh_token
      });

      if (tokenError) {
        console.log('Token save warning:', tokenError.message);
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