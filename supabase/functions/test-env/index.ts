import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ENVIRONMENT VARIABLES TEST ===');
    
    const envCheck = {
      GOOGLE_CLIENT_ID: {
        exists: !!Deno.env.get('GOOGLE_CLIENT_ID'),
        length: Deno.env.get('GOOGLE_CLIENT_ID')?.length || 0,
        prefix: Deno.env.get('GOOGLE_CLIENT_ID')?.substring(0, 10) || 'MISSING'
      },
      GOOGLE_CLIENT_SECRET: {
        exists: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
        length: Deno.env.get('GOOGLE_CLIENT_SECRET')?.length || 0,
        prefix: Deno.env.get('GOOGLE_CLIENT_SECRET')?.substring(0, 10) || 'MISSING'
      },
      YOUTUBE_API_KEY: {
        exists: !!Deno.env.get('YOUTUBE_API_KEY'),
        length: Deno.env.get('YOUTUBE_API_KEY')?.length || 0,
        prefix: Deno.env.get('YOUTUBE_API_KEY')?.substring(0, 10) || 'MISSING'
      },
      SUPABASE_URL: {
        exists: !!Deno.env.get('SUPABASE_URL'),
        length: Deno.env.get('SUPABASE_URL')?.length || 0,
        value: Deno.env.get('SUPABASE_URL') || 'MISSING'
      },
      SUPABASE_SERVICE_ROLE_KEY: {
        exists: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        length: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.length || 0,
        prefix: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.substring(0, 20) || 'MISSING'
      }
    };

    console.log('Environment check:', JSON.stringify(envCheck, null, 2));

    return new Response(JSON.stringify({
      success: true,
      environment: envCheck,
      message: 'Environment variables checked successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Test function error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});