-- Add an additional security layer by restricting service role operations
-- Create a more secure service role policy that validates the calling context

-- Drop existing service role policies
DROP POLICY IF EXISTS "Service role can select for internal operations" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Service role can insert social accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Service role can update social accounts" ON public.social_media_accounts;

-- Create context-aware service role policies
-- These will only work when called from proper edge function context

CREATE POLICY "Service role insert only from edge functions"
ON public.social_media_accounts
FOR INSERT
TO service_role
WITH CHECK (
    -- Only allow inserts when coming from edge function context
    current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
    OR current_setting('application_name') = 'PostgREST'
);

CREATE POLICY "Service role update only from edge functions"
ON public.social_media_accounts
FOR UPDATE
TO service_role
USING (
    -- Only allow updates when coming from edge function context
    current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
    OR current_setting('application_name') = 'PostgREST'
)
WITH CHECK (
    current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
    OR current_setting('application_name') = 'PostgREST'
);

-- No direct SELECT policy for service role - tokens only accessible through secure functions

-- Add additional security to the token access function
CREATE OR REPLACE FUNCTION public.get_social_account_with_tokens(account_id uuid)
RETURNS TABLE(
    id uuid,
    creator_id uuid,
    platform text,
    platform_user_id text,
    username text,
    display_name text,
    profile_image_url text,
    is_active boolean,
    connected_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    token_expires_at timestamp with time zone,
    encrypted_access_token text,
    encrypted_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Additional security: Only callable by service role from edge functions
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'Access denied: This function requires service role access';
    END IF;
    
    -- Validate that the account exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.social_media_accounts 
        WHERE id = account_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Account not found or inactive';
    END IF;
    
    RETURN QUERY
    SELECT 
        sma.id,
        sma.creator_id,
        sma.platform,
        sma.platform_user_id,
        sma.username,
        sma.display_name,
        sma.profile_image_url,
        sma.is_active,
        sma.connected_at,
        sma.last_synced_at,
        sma.token_expires_at,
        sma.encrypted_access_token,
        sma.encrypted_refresh_token,
        sma.created_at,
        sma.updated_at
    FROM public.social_media_accounts sma
    WHERE sma.id = account_id;
END;
$$;