import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== OAUTH FUNCTION START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Handling CORS OPTIONS request');
      return new Response(null, { headers: corsHeaders });
    }

    console.log('Environment check:');
    console.log('SUPABASE_URL:', !!Deno.env.get('SUPABASE_URL'));
    console.log('GOOGLE_CLIENT_ID:', !!Deno.env.get('GOOGLE_CLIENT_ID'));
    console.log('GOOGLE_CLIENT_SECRET:', !!Deno.env.get('GOOGLE_CLIENT_SECRET'));
    console.log('SUPABASE_SERVICE_ROLE_KEY:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    console.log('SUPABASE_PUBLISHABLE_KEY:', !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY'));

    // Check required environment variables
    if (!Deno.env.get('GOOGLE_CLIENT_ID')) {
      console.log('ERROR: GOOGLE_CLIENT_ID not configured');
      return new Response(JSON.stringify({ 
        error: 'Google Client ID not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Reading request body...');
    let bodyText;
    try {
      bodyText = await req.text();
      console.log('Raw body received:', bodyText);
      console.log('Body length:', bodyText?.length || 0);
    } catch (e) {
      console.log('Error reading request body:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Error reading request body',
        details: e.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
      
    if (!bodyText || bodyText.trim() === '') {
      console.log('ERROR: Empty request body received');
      return new Response(JSON.stringify({ 
        error: 'Empty request body - no data received',
        method: req.method,
        url: req.url
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('Successfully parsed body:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON body',
        details: e.message,
        receivedData: bodyText.substring(0, 200)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, platform, code } = body;
    console.log('Extracted values - Action:', action, 'Platform:', platform, 'Code exists:', !!code);

    // ============= CONNECT ACTION =============
    if (action === 'connect') {
      console.log('=== PROCESSING CONNECT REQUEST ===');
      
      const authRedirectUri = 'https://nx8up.lovable.app/oauth/callback';
      console.log('Using callback URL:', authRedirectUri);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const state = `${crypto.randomUUID()}|${platform}`;
      
      authUrl.searchParams.set('client_id', Deno.env.get('GOOGLE_CLIENT_ID') || '');
      authUrl.searchParams.set('redirect_uri', authRedirectUri);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/userinfo.profile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      const authUrlString = authUrl.toString();
      console.log('Generated auth URL:', authUrlString);
      
      const connectResponse = { 
        auth_url: authUrlString,
        state: state
      };
      
      console.log('Returning connect response:', JSON.stringify(connectResponse, null, 2));
      return new Response(JSON.stringify(connectResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============= CALLBACK ACTION =============
    if (action === 'callback') {
      console.log('=== PROCESSING CALLBACK REQUEST ===');
      console.log('STEP 1: Callback validation - Code exists:', !!code, 'Platform:', platform);
      
      if (!code) {
        console.log('ERROR: No authorization code provided');
        return new Response(JSON.stringify({ 
          error: 'No authorization code provided',
          receivedData: body
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('STEP 2: Checking required secrets');
      // Check required secrets
      if (!Deno.env.get('GOOGLE_CLIENT_SECRET')) {
        console.log('ERROR: GOOGLE_CLIENT_SECRET missing');
        return new Response(JSON.stringify({ 
          error: 'Google Client Secret not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY missing');
        return new Response(JSON.stringify({ 
          error: 'Supabase Service Role Key not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('STEP 3: All validations passed - proceeding with callback...');
      
      try {
        console.log('=== STARTING CALLBACK PROCESSING ===');
        
        // Initialize Supabase client with service role
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        
        console.log('Supabase client initialized');

        // Exchange authorization code for tokens
        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const tokenData = new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://nx8up.lovable.app/oauth/callback'
        });

        console.log('Exchanging code for tokens...');
        console.log('Token request data:', {
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')?.substring(0, 20) + '...',
          code: code.substring(0, 20) + '...',
          redirect_uri: 'https://nx8up.lovable.app/oauth/callback'
        });
        
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: tokenData,
        });

        console.log('Token response status:', tokenResponse.status);
        console.log('Token response headers:', Object.fromEntries(tokenResponse.headers.entries()));
        
        if (!tokenResponse.ok) {
          console.log('=== TOKEN EXCHANGE FAILED ===');
          console.log('Token exchange failed:', tokenResponse.status, tokenResponse.statusText);
          const errorText = await tokenResponse.text();
          console.log('Token exchange error response:', errorText);
          return new Response(JSON.stringify({ 
            error: 'Token exchange failed',
            details: errorText,
            status: tokenResponse.status
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const tokens = await tokenResponse.json();
        console.log('=== TOKENS RECEIVED SUCCESSFULLY ===');
        console.log('Token info:', {
          has_access_token: !!tokens.access_token,
          has_refresh_token: !!tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type
        });

        // Get user info from Google
        console.log('=== GETTING USER INFO FROM GOOGLE ===');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });

        console.log('User info response status:', userInfoResponse.status);
        
        if (!userInfoResponse.ok) {
          console.log('=== FAILED TO GET USER INFO ===');
          console.log('Failed to get user info:', userInfoResponse.status);
          const errorText = await userInfoResponse.text();
          console.log('User info error:', errorText);
          return new Response(JSON.stringify({ 
            error: 'Failed to get user info',
            details: errorText
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const userInfo = await userInfoResponse.json();
        console.log('=== USER INFO RETRIEVED ===');
        console.log('User info:', {
          id: userInfo.id,
          name: userInfo.name,
          email: userInfo.email
        });

        // Get YouTube channel info
        console.log('=== GETTING YOUTUBE CHANNEL INFO ===');
        const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });

        console.log('Channel response status:', channelResponse.status);
        console.log('Channel response headers:', Object.fromEntries(channelResponse.headers.entries()));

        if (!channelResponse.ok) {
          console.log('=== FAILED TO GET CHANNEL INFO ===');
          console.log('Failed to get channel info:', channelResponse.status);
          const errorText = await channelResponse.text();
          console.log('Channel error response:', errorText);
          return new Response(JSON.stringify({ 
            error: 'Failed to get YouTube channel info',
            details: errorText,
            status: channelResponse.status
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const channelData = await channelResponse.json();
        console.log('=== CHANNEL DATA RECEIVED ===');
        console.log('Channel data structure:', {
          items_count: channelData.items?.length || 0,
          pageInfo: channelData.pageInfo,
          has_items: !!channelData.items
        });
        
        if (!channelData.items || channelData.items.length === 0) {
          console.log('=== NO YOUTUBE CHANNEL FOUND ===');
          console.log('Channel data:', channelData);
          return new Response(JSON.stringify({ 
            error: 'No YouTube channel found for this account',
            details: 'The authenticated Google account does not have an associated YouTube channel'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const channel = channelData.items[0];
        console.log('=== CHANNEL INFO RETRIEVED ===');
        console.log('Channel info:', {
          id: channel.id,
          title: channel.snippet.title,
          customUrl: channel.snippet.customUrl,
          publishedAt: channel.snippet.publishedAt
        });

        // Get user ID from authorization header
        console.log('=== VALIDATING USER AUTHORIZATION ===');
        const authHeader = req.headers.get('authorization');
        console.log('Auth header present:', !!authHeader);
        
        if (!authHeader) {
          console.log('=== NO AUTHORIZATION HEADER ===');
          return new Response(JSON.stringify({ 
            error: 'Authorization required - no auth header provided' 
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const token = authHeader.replace('Bearer ', '');
        console.log('Extracted token:', token.substring(0, 20) + '...');

        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        console.log('User validation result:', {
          user_id: user?.id,
          has_error: !!userError,
          error_message: userError?.message
        });

        if (userError || !user) {
          console.log('=== USER VALIDATION FAILED ===');
          console.log('User validation error:', userError);
          return new Response(JSON.stringify({ 
            error: 'Invalid user token',
            details: userError?.message
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('=== USER VALIDATED SUCCESSFULLY ===');
        console.log('User ID:', user.id);

        console.log('=== CREATING SOCIAL MEDIA ACCOUNT ===');
        
        // Ensure we have valid required fields
        const username = channel.snippet.customUrl || channel.snippet.title || `channel-${channel.id}`;
        const displayName = channel.snippet.title || 'YouTube Channel';
        
        console.log('Account data to insert:', {
          creator_id: user.id,
          platform: 'youtube',
          platform_user_id: channel.id,
          username: username,
          display_name: displayName,
          profile_image_url: channel.snippet.thumbnails?.default?.url,
          is_active: true,
          token_expires_at: tokens.expires_in ? 
            new Date(Date.now() + (tokens.expires_in * 1000)).toISOString() : null
        });

        // Create or update social media account
        const { data: account, error: accountError } = await supabase
          .from('social_media_accounts')
          .upsert({
            creator_id: user.id,
            platform: 'youtube',
            platform_user_id: channel.id,
            username: username,
            display_name: displayName,
            profile_image_url: channel.snippet.thumbnails?.default?.url,
            is_active: true,
            connected_at: new Date().toISOString(),
            token_expires_at: tokens.expires_in ? 
              new Date(Date.now() + (tokens.expires_in * 1000)).toISOString() : null
          }, {
            onConflict: 'creator_id,platform',
            ignoreDuplicates: false
          })
          .select()
          .single();

        console.log('Account upsert result:', { 
          has_account: !!account, 
          has_error: !!accountError,
          account_id: account?.id,
          error_message: accountError?.message,
          error_code: accountError?.code,
          error_details: accountError?.details
        });

        if (accountError) {
          console.log('=== ACCOUNT CREATION FAILED ===');
          console.log('Full account error:', JSON.stringify(accountError, null, 2));
          return new Response(JSON.stringify({ 
            error: 'Failed to create social media account',
            details: accountError.message,
            code: accountError.code,
            hint: accountError.hint
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('=== ACCOUNT CREATED SUCCESSFULLY ===');
        console.log('Account ID:', account.id);

        // Store encrypted tokens using secure function
        console.log('=== STORING ENCRYPTED TOKENS ===');
        console.log('Calling update_encrypted_tokens with account ID:', account.id);
        
        const { error: tokenError } = await supabase.rpc('update_encrypted_tokens', {
          account_id: account.id,
          new_access_token: tokens.access_token,
          new_refresh_token: tokens.refresh_token || null
        });

        console.log('Token storage result:', {
          has_error: !!tokenError,
          error_message: tokenError?.message,
          error_code: tokenError?.code
        });

        if (tokenError) {
          console.log('=== TOKEN STORAGE FAILED ===');
          console.log('Full token error:', JSON.stringify(tokenError, null, 2));
          return new Response(JSON.stringify({ 
            error: 'Failed to store tokens',
            details: tokenError.message,
            code: tokenError.code
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('=== TOKENS STORED SUCCESSFULLY ===');

        console.log('OAuth callback completed successfully');

        return new Response(JSON.stringify({ 
          success: true,
          message: 'YouTube account connected successfully',
          account: {
            platform: account.platform,
            username: account.username,
            display_name: account.display_name
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.log('=== CALLBACK PROCESSING ERROR ===');
        console.log('Error name:', error.name);
        console.log('Error message:', error.message);
        console.log('Error stack:', error.stack);
        console.log('Error type:', typeof error);
        console.log('Full error object:', JSON.stringify(error, null, 2));
        
        // Log additional context about where we might have failed
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        console.log('Has auth header:', !!req.headers.get('authorization'));
        console.log('Environment vars available:', {
          SUPABASE_URL: !!Deno.env.get('SUPABASE_URL'),
          SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
          GOOGLE_CLIENT_ID: !!Deno.env.get('GOOGLE_CLIENT_ID'),
          GOOGLE_CLIENT_SECRET: !!Deno.env.get('GOOGLE_CLIENT_SECRET')
        });
        
        return new Response(JSON.stringify({ 
          error: 'Callback processing failed',
          details: error.message,
          name: error.name,
          type: typeof error,
          stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    console.log('ERROR: Unknown action received:', action);
    return new Response(JSON.stringify({ 
      error: 'Unknown action',
      received: action,
      validActions: ['connect', 'callback']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log('=== FUNCTION ERROR ===');
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.log('Error name:', error.name);
    
    return new Response(JSON.stringify({ 
      error: 'Function error occurred',
      message: error.message,
      name: error.name,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});