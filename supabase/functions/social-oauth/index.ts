import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🚀 FUNCTION START - Method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    console.log('✅ Supabase client created');

    const requestBody = await req.json();
    const { action, platform, redirect_url, code } = requestBody;
    console.log('📋 Request data:', { 
      action, 
      platform, 
      has_redirect_url: !!redirect_url, 
      has_code: !!code 
    });

    if (!action || !platform) {
      console.error('❌ Missing required parameters');
      throw new Error('Missing action or platform');
    }

    // Auto-detect domain
    const origin = req.headers.get('origin') || 'https://nx8up.lovable.app';
    const actualRedirectUrl = `${origin}/creator-dashboard`;
    console.log('🌐 Using redirect URL:', actualRedirectUrl);

    if (action === 'connect') {
      console.log('🔗 Processing CONNECT request');
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      if (!clientId) {
        console.error('❌ No Google Client ID found');
        throw new Error('Google Client ID not configured');
      }
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', `${actualRedirectUrl}?platform=youtube`);
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile');
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', crypto.randomUUID());

      console.log('✅ Generated auth URL successfully');
      return new Response(JSON.stringify({ 
        auth_url: authUrl.toString(),
        state: authUrl.searchParams.get('state')
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'callback') {
      console.log('🔄 Processing CALLBACK request');
      
      if (!code) {
        console.error('❌ No authorization code provided');
        throw new Error('No authorization code provided');
      }

      console.log('1️⃣ Exchanging code for token...');
      
      // Step 1: Exchange code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
          redirect_uri: `${actualRedirectUrl}?platform=youtube`,
          code: code
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      console.log('✅ Token exchange successful');

      console.log('2️⃣ Getting user info...');
      
      // Step 2: Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      if (!userResponse.ok) {
        console.error('❌ User info fetch failed:', userResponse.status);
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userResponse.json();
      console.log('✅ Got user info:', { id: userInfo.id, email: userInfo.email });

      console.log('3️⃣ Getting YouTube channel...');
      
      // Step 3: Get YouTube channel
      const channelResponse = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true`, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });

      let channelData = null;
      if (channelResponse.ok) {
        const channelResult = await channelResponse.json();
        if (channelResult.items && channelResult.items.length > 0) {
          channelData = channelResult.items[0];
          console.log('✅ Got YouTube channel:', channelData.snippet.title);
        } else {
          console.log('⚠️ No YouTube channel found');
        }
      } else {
        console.log('⚠️ YouTube API call failed:', channelResponse.status);
      }

      console.log('4️⃣ Getting authenticated user...');
      
      // Step 4: Get authenticated user
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        console.error('❌ No auth header');
        throw new Error('No authorization header');
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      );

      if (authError || !user) {
        console.error('❌ Auth failed:', authError);
        throw new Error('Invalid user token');
      }

      console.log('✅ Authenticated user:', user.id);

      console.log('5️⃣ Saving to database...');
      
      // Step 5: Save to database
      const accountData = {
        creator_id: user.id,
        platform: 'youtube',
        platform_user_id: channelData?.id || userInfo.id,
        username: channelData?.snippet?.title || userInfo.name || 'User',
        display_name: channelData?.snippet?.title || userInfo.name || 'User',
        profile_image_url: channelData?.snippet?.thumbnails?.default?.url || userInfo.picture,
        is_active: true,
        connected_at: new Date().toISOString()
      };

      const { data: savedAccount, error: dbError } = await supabase
        .from('social_media_accounts')
        .upsert(accountData, {
          onConflict: 'creator_id,platform'
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database error:', dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('✅ Account saved:', savedAccount.id);

      // Step 6: Save tokens securely
      const { error: tokenError } = await supabase.rpc('update_encrypted_tokens', {
        account_id: savedAccount.id,
        new_access_token: tokenData.access_token,
        new_refresh_token: tokenData.refresh_token
      });

      if (tokenError) {
        console.log('⚠️ Token save failed (account still created):', tokenError);
      } else {
        console.log('✅ Tokens saved securely');
      }

      console.log('🎉 SUCCESS - Account connected!');
      
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

    throw new Error('Invalid action');

  } catch (error) {
    console.error('💥 FUNCTION ERROR:', error.message);
    console.error('📍 Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check function logs for more information'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});