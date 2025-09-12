import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
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
    console.log('SUPABASE_PUBLISHABLE_KEY exists:', !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY'));

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
    
    if (!bodyText) {
      console.log('ERROR: Empty request body');
      return new Response(JSON.stringify({ 
        error: 'Empty request body' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let body;
    try {
      body = JSON.parse(bodyText);
      console.log('Parsed request body:', JSON.stringify(body, null, 2));
    } catch (parseError) {
      console.log('ERROR: Failed to parse JSON:', parseError.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('=== EXTRACTED PARAMETERS ===');
    const { action, platform, code, redirect_url } = body;
    console.log('action:', action);
    console.log('platform:', platform);
    console.log('code exists:', !!code);
    console.log('code length:', code?.length || 0);

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
      
      console.log('Generated auth URL:', authUrl.toString());
      
      const connectResponse = { 
        auth_url: authUrl.toString(),
        state: state
      };
      
      console.log('Returning connect response:', JSON.stringify(connectResponse, null, 2));
      return new Response(JSON.stringify(connectResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============= CALLBACK ACTION =============
    if (action === 'callback') {
      console.log('=== PROCESSING CALLBACK ===');
      
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

      console.log('Account data:', JSON.stringify(accountData, null, 2));

      const { data: savedAccount, error: dbError } = await serviceRoleSupabase
        .from('social_media_accounts')
        .upsert(accountData, { onConflict: 'creator_id,platform' })
        .select()
        .maybeSingle();

      if (dbError) {
        console.log('Database error:', dbError.message);
        return new Response(JSON.stringify({ 
          error: `Database error: ${dbError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!savedAccount) {
        console.log('ERROR: No account data returned');
        return new Response(JSON.stringify({ 
          error: 'Failed to save account data' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('Account saved successfully:', savedAccount.id);

      console.log('Step 6: Saving tokens...');
      const { error: tokenError } = await serviceRoleSupabase.rpc('update_encrypted_tokens', {
        account_id: savedAccount.id,
        new_access_token: tokenData.access_token,
        new_refresh_token: tokenData.refresh_token
      });

      if (tokenError) {
        console.log('Token save error:', tokenError.message);
        return new Response(JSON.stringify({ 
          error: `Failed to save tokens: ${tokenError.message}` 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('=== SUCCESS ===');
      return new Response(JSON.stringify({ 
        success: true,
        message: 'YouTube account connected successfully!',
        account: {
          id: savedAccount.id,
          platform: savedAccount.platform,
          username: savedAccount.username,
          display_name: savedAccount.display_name
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('ERROR: Invalid action:', action);
    return new Response(JSON.stringify({ 
      error: 'Invalid action',
      validActions: ['connect', 'callback']
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log('=== FUNCTION ERROR ===');
    console.log('Error type:', typeof error);
    console.log('Error name:', error?.name);
    console.log('Error message:', error?.message);
    console.log('Error stack:', error?.stack);
    
    return new Response(JSON.stringify({ 
      error: error?.message || 'Unknown error occurred',
      errorType: error?.name || 'UnknownError'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});