import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== SIMPLE TEST FUNCTION ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Handling CORS OPTIONS request');
      return new Response(null, { headers: corsHeaders });
    }

    console.log('Environment variables check:');
    console.log('SUPABASE_URL:', !!Deno.env.get('SUPABASE_URL'));
    console.log('GOOGLE_CLIENT_ID:', !!Deno.env.get('GOOGLE_CLIENT_ID'));
    console.log('GOOGLE_CLIENT_SECRET:', !!Deno.env.get('GOOGLE_CLIENT_SECRET'));
    console.log('SUPABASE_SERVICE_ROLE_KEY:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    console.log('SUPABASE_PUBLISHABLE_KEY:', !!Deno.env.get('SUPABASE_PUBLISHABLE_KEY'));

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

    const { action } = body;
    console.log('Action:', action);

    if (action === 'connect') {
      console.log('Processing connect action');
      return new Response(JSON.stringify({ 
        message: 'Connect action received successfully',
        test: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'callback') {
      console.log('Processing callback action');
      return new Response(JSON.stringify({ 
        message: 'Callback action received successfully',
        test: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Unknown action:', action);
    return new Response(JSON.stringify({ 
      error: 'Unknown action',
      received: action 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.log('=== ERROR ===');
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Function error',
      message: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});