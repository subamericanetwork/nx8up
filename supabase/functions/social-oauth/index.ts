import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 DIAGNOSTIC MODE - Method:', req.method, 'URL:', req.url);
  console.log('🚀 Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Environment variables check:');
    console.log('  - SUPABASE_URL exists:', !!Deno.env.get('SUPABASE_URL'));
    console.log('  - SERVICE_ROLE_KEY exists:', !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    console.log('  - GOOGLE_CLIENT_ID exists:', !!Deno.env.get('GOOGLE_CLIENT_ID'));
    console.log('  - GOOGLE_CLIENT_SECRET exists:', !!Deno.env.get('GOOGLE_CLIENT_SECRET'));

    console.log('📨 Reading request body...');
    let requestBody;
    try {
      const bodyText = await req.text();
      console.log('📋 Raw body text:', bodyText);
      requestBody = JSON.parse(bodyText);
      console.log('📋 Parsed body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error('❌ Body parsing error:', parseError.message);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { action, platform, redirect_url, code } = requestBody;
    console.log('📋 Extracted fields:', { 
      action, 
      platform, 
      has_redirect_url: !!redirect_url, 
      has_code: !!code,
      code_length: code ? code.length : 0
    });

    // DIAGNOSTIC: Just return success for now to test logging
    return new Response(JSON.stringify({ 
      diagnostic: true,
      received: { action, platform, has_code: !!code },
      message: 'Diagnostic mode - check logs for details'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 DIAGNOSTIC ERROR - Type:', typeof error);
    console.error('💥 DIAGNOSTIC ERROR - Message:', error.message);
    console.error('💥 DIAGNOSTIC ERROR - Stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error occurred',
      details: 'Diagnostic mode - check function logs',
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
});