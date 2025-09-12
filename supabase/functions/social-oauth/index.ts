import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[${requestId}] OAUTH FUNCTION START - ${req.method} ${req.url}`);
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Read and parse request body
    const body = await req.json();
    console.log(`[${requestId}] Request body:`, JSON.stringify(body, null, 2));
    
    const { action, platform, code } = body;

    // ============= CONNECT ACTION =============
    if (action === 'connect') {
      console.log(`[${requestId}] Processing connect request for ${platform}`);
      
      const authRedirectUri = 'https://nx8up.lovable.app/oauth/callback';
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const state = `${crypto.randomUUID()}|${platform}`;
      
      authUrl.searchParams.set('client_id', Deno.env.get('GOOGLE_CLIENT_ID') || '');
      authUrl.searchParams.set('redirect_uri', authRedirectUri);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/userinfo.profile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      
      return new Response(JSON.stringify({ 
        auth_url: authUrl.toString(),
        state: state
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============= CALLBACK ACTION =============
    if (action === 'callback') {
      console.log(`[${requestId}] Processing callback for ${platform} with code: ${!!code}`);
      
      if (!code) {
        return new Response(JSON.stringify({ 
          error: 'No authorization code provided'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Step 1: Exchange code for tokens
      console.log(`[${requestId}] Step 1: Exchanging authorization code for tokens`);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://nx8up.lovable.app/oauth/callback'
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.log(`[${requestId}] Token exchange failed: ${tokenResponse.status} - ${errorText}`);
        return new Response(JSON.stringify({ 
          error: 'Token exchange failed',
          details: errorText,
          step: 'token_exchange'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokens = await tokenResponse.json();
      console.log(`[${requestId}] Step 1 completed: Tokens received`);

      // Step 2: Get YouTube channel
      console.log(`[${requestId}] Step 2: Getting YouTube channel info`);
      
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });

      if (!channelResponse.ok) {
        const errorText = await channelResponse.text();
        console.log(`[${requestId}] YouTube API failed: ${channelResponse.status} - ${errorText}`);
        return new Response(JSON.stringify({ 
          error: 'Failed to get YouTube channel',
          details: errorText,
          step: 'youtube_api'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const channelData = await channelResponse.json();
      
      if (!channelData.items?.length) {
        console.log(`[${requestId}] No YouTube channel found`);
        return new Response(JSON.stringify({ 
          error: 'No YouTube channel found',
          step: 'channel_validation'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const channel = channelData.items[0];
      console.log(`[${requestId}] Step 2 completed: Channel found - ${channel.snippet.title}`);

      // Step 3: Validate user
      console.log(`[${requestId}] Step 3: Validating user authentication`);
      
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        console.log(`[${requestId}] No authorization header`);
        return new Response(JSON.stringify({ 
          error: 'Authorization required',
          step: 'auth_header'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (userError || !user) {
        console.log(`[${requestId}] User validation failed: ${userError?.message}`);
        return new Response(JSON.stringify({ 
          error: 'Invalid user token',
          details: userError?.message,
          step: 'user_validation'
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[${requestId}] Step 3 completed: User validated - ${user.id}`);

      // Step 4: Create account (simplified for now - just return success)
      console.log(`[${requestId}] Step 4: Account creation (simplified)`);
      
      // For now, just return success with the data we collected
      return new Response(JSON.stringify({ 
        success: true,
        message: 'OAuth flow completed successfully',
        debug: {
          channel_id: channel.id,
          channel_title: channel.snippet.title,
          user_id: user.id,
          request_id: requestId
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action',
      received: action
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log(`[${requestId}] Function error:`, error.name, error.message);
    console.log(`[${requestId}] Stack:`, error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Function error',
      details: error.message,
      name: error.name
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});