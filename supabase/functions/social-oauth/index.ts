import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Add immediate logging to ensure we can see function calls
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[${requestId}] === OAUTH FUNCTION START ===`);
  console.log(`[${requestId}] Method: ${req.method}, URL: ${req.url}`);
  console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
  
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

      console.log(`[${requestId}] STEP 3: All validations passed - proceeding with callback...`);
      
      try {
        console.log(`[${requestId}] === STARTING MINIMAL CALLBACK TEST ===`);
        
        // Just return success for now to test
        console.log(`[${requestId}] Returning test success response`);
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Test callback completed successfully',
          test_mode: true,
          request_id: requestId
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