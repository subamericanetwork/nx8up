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
      console.log('Callback validation - Code exists:', !!code, 'Platform:', platform);
      
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

      console.log('All validations passed - proceeding with callback...');
      
      // For now, just return success to test if we get this far
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Callback validation successful',
        test: true,
        receivedCode: code?.substring(0, 20) + '...',
        platform: platform
      }), {
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
      name: error.name,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});