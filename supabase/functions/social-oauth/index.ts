import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SUPER SIMPLE VERSION FOR DEBUGGING - LOGS EVERYTHING
serve(async (req) => {
  // Log immediately at start
  console.log('=== FUNCTION START ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Timestamp:', new Date().toISOString());
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS OPTIONS');
    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  // Log everything about the request
  console.log('=== REQUEST DETAILS ===');
  
  try {
    // Read body
    const body = await req.text();
    console.log('Raw body:', body);
    
    let parsed;
    try {
      parsed = JSON.parse(body || '{}');
      console.log('Parsed body:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Body parse error:', e.message);
      parsed = {};
    }
    
    // Log all headers
    console.log('=== HEADERS ===');
    for (const [key, value] of req.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    
    // Log environment
    console.log('=== ENVIRONMENT ===');
    console.log('SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'));
    console.log('SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    console.log('GOOGLE_CLIENT_ID exists:', !!Deno.env.get('GOOGLE_CLIENT_ID'));
    console.log('GOOGLE_CLIENT_SECRET exists:', !!Deno.env.get('GOOGLE_CLIENT_SECRET'));
    
    console.log('=== RETURNING SUCCESS ===');
    
    // Return a successful response with diagnostic info
    return new Response(JSON.stringify({
      success: true,
      message: 'Function is working - check logs for details',
      timestamp: new Date().toISOString(),
      received: parsed,
      method: req.method
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.log('=== ERROR OCCURRED ===');
    console.log('Error type:', typeof error);
    console.log('Error message:', error?.message || 'No message');
    console.log('Error stack:', error?.stack || 'No stack');
    
    return new Response(JSON.stringify({
      error: true,
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});