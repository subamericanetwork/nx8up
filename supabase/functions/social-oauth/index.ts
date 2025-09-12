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

      // Step 4: Create account
      console.log(`[${requestId}] Step 4: Creating social media account`);
      
      const username = channel.snippet.customUrl || channel.snippet.title || `channel-${channel.id}`;
      const displayName = channel.snippet.title || 'YouTube Channel';

      // First, delete any existing account for this user/platform combination
      console.log(`[${requestId}] Removing any existing account for user ${user.id} platform youtube`);
      
      const { error: deleteError } = await supabase
        .from('social_media_accounts')
        .delete()
        .eq('creator_id', user.id)
        .eq('platform', 'youtube');
      
      if (deleteError) {
        console.log(`[${requestId}] Delete existing account error (non-critical):`, deleteError.message);
      }

      // Now insert the new account
      console.log(`[${requestId}] Inserting new account`);
      
      const { data: account, error: accountError } = await supabase
        .from('social_media_accounts')
        .insert({
          creator_id: user.id,
          platform: 'youtube',
          platform_user_id: channel.id,
          username: username,
          display_name: displayName,
          profile_image_url: channel.snippet.thumbnails?.default?.url,
          is_active: true,
          connected_at: new Date().toISOString(),
          token_expires_at: tokens.expires_in ? 
            new Date(Date.now() + (tokens.expires_in * 1000)).toISOString() : null
        })
        .select()
        .single();

      if (accountError) {
        console.log(`[${requestId}] Account creation failed: ${accountError.message}`);
        console.log(`[${requestId}] Account error details:`, JSON.stringify(accountError, null, 2));
        return new Response(JSON.stringify({ 
          error: 'Failed to create social media account',
          details: accountError.message,
          code: accountError.code,
          hint: accountError.hint,
          step: 'account_creation'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[${requestId}] Step 4 completed: Account created - ${account.id}`);

      // Step 5: Store encrypted tokens using service role client
      console.log(`[${requestId}] Step 5: Storing encrypted tokens directly`);
      
      // Create service role client for secure token operations
      const serviceSupabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // First encrypt the tokens using the database function
      const { data: encryptedTokens, error: encryptError } = await serviceSupabase
        .rpc('encrypt_token', { token: tokens.access_token });

      if (encryptError) {
        console.log(`[${requestId}] Token encryption failed: ${encryptError.message}`);
        return new Response(JSON.stringify({ 
          error: 'Failed to encrypt tokens',
          details: encryptError.message,
          step: 'token_encryption'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let encryptedRefreshToken = null;
      if (tokens.refresh_token) {
        const { data: encRefreshToken, error: encRefreshError } = await serviceSupabase
          .rpc('encrypt_token', { token: tokens.refresh_token });
        
        if (encRefreshError) {
          console.log(`[${requestId}] Refresh token encryption failed: ${encRefreshError.message}`);
          return new Response(JSON.stringify({ 
            error: 'Failed to encrypt refresh token',
            details: encRefreshError.message,
            step: 'refresh_token_encryption'
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        encryptedRefreshToken = encRefreshToken;
      }

      // Update the account with encrypted tokens directly using service role
      const { error: tokenUpdateError } = await serviceSupabase
        .from('social_media_accounts')
        .update({
          encrypted_access_token: encryptedTokens,
          encrypted_refresh_token: encryptedRefreshToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id);

      if (tokenUpdateError) {
        console.log(`[${requestId}] Token storage failed: ${tokenUpdateError.message}`);
        console.log(`[${requestId}] Token error details:`, JSON.stringify(tokenUpdateError, null, 2));
        return new Response(JSON.stringify({ 
          error: 'Failed to store tokens',
          details: tokenUpdateError.message,
          code: tokenUpdateError.code,
          step: 'token_storage'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log(`[${requestId}] Step 5 completed: Tokens stored successfully via direct update`);
      
      // Step 6: Trigger initial stats sync
      console.log(`[${requestId}] Step 6: Triggering initial stats sync`);
      
      try {
        const { error: syncError } = await supabase.functions.invoke('sync-social-stats', {
          body: { accountId: account.id }
        });
        
        if (syncError) {
          console.log(`[${requestId}] Stats sync failed (non-critical):`, syncError.message);
        } else {
          console.log(`[${requestId}] Step 6 completed: Initial stats sync triggered`);
        }
      } catch (syncErr) {
        console.log(`[${requestId}] Stats sync error (non-critical):`, syncErr);
      }
      
      // Return success with account information
      return new Response(JSON.stringify({ 
        success: true,
        message: 'YouTube account connected successfully',
        account: {
          id: account.id,
          platform: account.platform,
          username: account.username,
          display_name: account.display_name
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