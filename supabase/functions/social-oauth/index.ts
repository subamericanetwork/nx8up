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

    let body;
    try {
      const bodyText = await req.text();
      console.log('Raw body:', bodyText);
      body = JSON.parse(bodyText);
      console.log('Parsed body:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('Error parsing body:', e.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON body',
        details: e.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action, platform, code } = body;
    console.log('Action:', action, 'Platform:', platform);

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
      console.log('Callback data check:', {
        hasCode: !!code,
        codeLength: code?.length || 0,
        platform: platform
      });
      
      if (!code) {
        console.log('ERROR: No authorization code provided');
        return new Response(JSON.stringify({ 
          error: 'No authorization code provided' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Early validation of required secrets for callback
      if (!Deno.env.get('GOOGLE_CLIENT_SECRET')) {
        console.log('ERROR: GOOGLE_CLIENT_SECRET missing for callback');
        return new Response(JSON.stringify({ 
          error: 'Google Client Secret not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
        console.log('ERROR: SUPABASE_SERVICE_ROLE_KEY missing for callback');
        return new Response(JSON.stringify({ 
          error: 'Supabase Service Role Key not configured' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Step 1: Exchanging code for token...');
      console.log('About to make token exchange request to Google...');
      const authRedirectUri = 'https://nx8up.lovable.app/oauth/callback';
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: authRedirectUri,
          code: code
        })
      });

      console.log('Token exchange response status:', tokenResponse.status);
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.log('Token exchange failed:', errorText);
        return new Response(JSON.stringify({ 
          error: `Token exchange failed: ${tokenResponse.status}`,
          details: errorText
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

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

      console.log('Step 3: Getting authenticated user...');
      const authHeader = req.headers.get('Authorization');
      console.log('Auth header present:', !!authHeader);
      
      if (!authHeader) {
        console.log('ERROR: No authorization header');
        return new Response(JSON.stringify({ 
          error: 'Missing authorization header' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create regular supabase client for auth
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || ''
      );

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        console.log('Authentication failed:', authError?.message);
        return new Response(JSON.stringify({ 
          error: 'Authentication failed',
          details: authError?.message
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Authenticated user:', user.id);

      console.log('Step 4: Creating service role client...');
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

      console.log('Step 5: Saving account to database...');
      const accountData = {
        creator_id: user.id,
        platform: 'youtube',
        platform_user_id: userInfo.id,
        username: userInfo.name || 'User',
        display_name: userInfo.name || 'User',
        profile_image_url: userInfo.picture,
        is_active: true,
        connected_at: new Date().toISOString()
      };

      console.log('Account data to save:', JSON.stringify(accountData, null, 2));

      const { data: savedAccount, error: dbError } = await serviceRoleSupabase
        .from('social_media_accounts')
        .upsert(accountData, { onConflict: 'creator_id,platform' })
        .select()
        .maybeSingle();

      if (dbError) {
        console.log('Database error:', dbError.message, dbError.code, dbError.details);
        return new Response(JSON.stringify({ 
          error: `Database error: ${dbError.message}`,
          code: dbError.code,
          details: dbError.details
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!savedAccount) {
        console.log('ERROR: No account data returned from upsert');
        return new Response(JSON.stringify({ 
          error: 'Failed to save account data - no data returned' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Account saved successfully with ID:', savedAccount.id);

      console.log('Step 6: Saving tokens...');
      const { error: tokenError } = await serviceRoleSupabase.rpc('update_encrypted_tokens', {
        account_id: savedAccount.id,
        new_access_token: tokenData.access_token,
        new_refresh_token: tokenData.refresh_token
      });

      if (tokenError) {
        console.log('Token save error:', tokenError.message, tokenError.code, tokenError.details);
        return new Response(JSON.stringify({ 
          error: `Failed to save tokens: ${tokenError.message}`,
          code: tokenError.code,
          details: tokenError.details
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Tokens saved successfully');

      console.log('=== SUCCESS - OAuth flow completed ===');
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

      console.log('Returning success response:', JSON.stringify(successResponse, null, 2));
      return new Response(JSON.stringify(successResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
      name: error.name
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});