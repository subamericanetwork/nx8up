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
        console.log(`[${requestId}] === STARTING CALLBACK PROCESSING ===`);
        
        // Initialize Supabase client with service role
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        );
        
        console.log(`[${requestId}] Supabase client initialized`);

        // STEP 1: Exchange authorization code for tokens
        console.log(`[${requestId}] === STEP 1: EXCHANGING CODE FOR TOKENS ===`);
        try {
          const tokenUrl = 'https://oauth2.googleapis.com/token';
          const tokenData = new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '',
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '',
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: 'https://nx8up.lovable.app/oauth/callback'
          });

          const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenData,
          });

          console.log(`[${requestId}] Token response status:`, tokenResponse.status);
          
          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.log(`[${requestId}] Token exchange failed:`, errorText);
            return new Response(JSON.stringify({ 
              error: 'Token exchange failed',
              details: errorText,
              status: tokenResponse.status,
              step: 'token_exchange',
              debug_info: {
                client_id_exists: !!Deno.env.get('GOOGLE_CLIENT_ID'),
                client_secret_exists: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
                code_length: code?.length || 0
              }
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const tokens = await tokenResponse.json();
          console.log(`[${requestId}] === TOKENS RECEIVED SUCCESSFULLY ===`);

          // STEP 2: Get YouTube channel info
          console.log(`[${requestId}] === STEP 2: GETTING YOUTUBE CHANNEL INFO ===`);
          const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: {
              'Authorization': `Bearer ${tokens.access_token}`,
            },
          });

          console.log(`[${requestId}] Channel response status:`, channelResponse.status);

          if (!channelResponse.ok) {
            const errorText = await channelResponse.text();
            console.log(`[${requestId}] Channel API failed:`, errorText);
            return new Response(JSON.stringify({ 
              error: 'Failed to get YouTube channel info',
              details: errorText,
              status: channelResponse.status,
              step: 'youtube_channel',
              debug_info: {
                has_access_token: !!tokens.access_token,
                token_type: tokens.token_type
              }
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const channelData = await channelResponse.json();
          
          if (!channelData.items || channelData.items.length === 0) {
            console.log(`[${requestId}] No YouTube channel found`);
            return new Response(JSON.stringify({ 
              error: 'No YouTube channel found for this account',
              details: 'The authenticated Google account does not have an associated YouTube channel',
              step: 'youtube_channel_validation',
              debug_info: channelData
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const channel = channelData.items[0];
          console.log(`[${requestId}] Channel found:`, channel.snippet.title);

          // STEP 3: Validate user authorization
          console.log(`[${requestId}] === STEP 3: VALIDATING USER AUTHORIZATION ===`);
          const authHeader = req.headers.get('authorization');
          
          if (!authHeader) {
            console.log(`[${requestId}] No auth header provided`);
            return new Response(JSON.stringify({ 
              error: 'Authorization required',
              step: 'user_auth_header',
              debug_info: { headers_available: Object.keys(Object.fromEntries(req.headers.entries())) }
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const { data: { user }, error: userError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
          );

          if (userError || !user) {
            console.log(`[${requestId}] User validation failed:`, userError?.message);
            return new Response(JSON.stringify({ 
              error: 'Invalid user token',
              details: userError?.message,
              step: 'user_validation',
              debug_info: { 
                has_auth_header: !!authHeader,
                token_length: authHeader?.replace('Bearer ', '').length || 0
              }
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log(`[${requestId}] User validated:`, user.id);

          // STEP 4: Create social media account
          console.log(`[${requestId}] === STEP 4: CREATING SOCIAL MEDIA ACCOUNT ===`);
          
          const username = channel.snippet.customUrl || channel.snippet.title || `channel-${channel.id}`;
          const displayName = channel.snippet.title || 'YouTube Channel';

          const accountData = {
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
          };

          console.log(`[${requestId}] Account data prepared:`, { ...accountData, creator_id: '***' });

          const { data: account, error: accountError } = await supabase
            .from('social_media_accounts')
            .upsert(accountData, {
              onConflict: 'creator_id,platform',
              ignoreDuplicates: false
            })
            .select()
            .single();

          if (accountError) {
            console.log(`[${requestId}] Account creation failed:`, accountError.message);
            return new Response(JSON.stringify({ 
              error: 'Failed to create social media account',
              details: accountError.message,
              code: accountError.code,
              step: 'account_creation',
              debug_info: {
                account_data: { ...accountData, creator_id: '***' },
                supabase_error: accountError
              }
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log(`[${requestId}] Account created successfully:`, account.id);

          // STEP 5: Store encrypted tokens
          console.log(`[${requestId}] === STEP 5: STORING ENCRYPTED TOKENS ===`);
          const { error: tokenError } = await supabase.rpc('update_encrypted_tokens', {
            account_id: account.id,
            new_access_token: tokens.access_token,
            new_refresh_token: tokens.refresh_token || null
          });

          if (tokenError) {
            console.log(`[${requestId}] Token storage failed:`, tokenError.message);
            return new Response(JSON.stringify({ 
              error: 'Failed to store tokens',
              details: tokenError.message,
              code: tokenError.code,
              step: 'token_storage',
              debug_info: {
                account_id: account.id,
                rpc_error: tokenError
              }
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          console.log(`[${requestId}] === OAUTH CALLBACK COMPLETED SUCCESSFULLY ===`);

          return new Response(JSON.stringify({ 
            success: true,
            message: 'YouTube account connected successfully',
            account: {
              id: account.id,
              platform: account.platform,
              username: account.username,
              display_name: account.display_name
            },
            debug_info: {
              request_id: requestId,
              channel_id: channel.id,
              user_id: user.id
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        } catch (stepError) {
          console.log(`[${requestId}] Step error:`, stepError.message);
          return new Response(JSON.stringify({ 
            error: 'Processing step failed',
            details: stepError.message,
            step: 'unknown_step',
            debug_info: {
              error_name: stepError.name,
              error_stack: stepError.stack?.split('\n').slice(0, 3)
            }
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

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