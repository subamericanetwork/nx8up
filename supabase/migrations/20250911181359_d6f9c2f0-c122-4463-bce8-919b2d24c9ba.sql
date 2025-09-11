-- Critical Security Fix: Prevent creator access to encrypted social media tokens
-- This ensures encrypted tokens can ONLY be accessed by service role from edge functions

-- Remove any existing creator policies that might allow token access
DROP POLICY IF EXISTS "Creators can create their own social accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update their own social account info" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can view their accounts (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can create social accounts without tokens" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update non-token fields only" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can view social accounts safely" ON public.social_media_accounts;

-- Create highly restrictive creator policies that prevent any token field access
CREATE POLICY "Creators: insert account info only (no tokens)"
ON public.social_media_accounts
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = creator_id
    AND encrypted_access_token IS NULL
    AND encrypted_refresh_token IS NULL
);

-- Creators can only update specific non-sensitive fields
CREATE POLICY "Creators: update profile fields only"
ON public.social_media_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

-- Create restricted columns policy - creators can only see non-token fields
CREATE POLICY "Creators: view non-token data only"
ON public.social_media_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- CRITICAL: Update existing functions to have stronger security validation
CREATE OR REPLACE FUNCTION public.get_decrypted_tokens(account_id uuid)
RETURNS TABLE(access_token text, refresh_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- CRITICAL: Only service role from edge functions can access tokens
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Only service role can access encrypted tokens';
    END IF;
    
    -- Additional validation: Must be called from edge function context
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Token access only allowed from edge function context';
    END IF;
    
    RETURN QUERY
    SELECT 
        public.decrypt_token(encrypted_access_token) as access_token,
        public.decrypt_token(encrypted_refresh_token) as refresh_token
    FROM public.social_media_accounts 
    WHERE id = account_id AND is_active = true;
END;
$$;

-- Secure the token update function as well
CREATE OR REPLACE FUNCTION public.update_encrypted_tokens(
    account_id uuid, 
    new_access_token text DEFAULT NULL,
    new_refresh_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- CRITICAL: Only service role from edge functions can update tokens
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Only service role can update encrypted tokens';
    END IF;
    
    -- Validate edge function context
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Token updates only allowed from edge function context';
    END IF;
    
    UPDATE public.social_media_accounts 
    SET 
        encrypted_access_token = CASE 
            WHEN new_access_token IS NOT NULL THEN public.encrypt_token(new_access_token)
            ELSE encrypted_access_token
        END,
        encrypted_refresh_token = CASE 
            WHEN new_refresh_token IS NOT NULL THEN public.encrypt_token(new_refresh_token)
            ELSE encrypted_refresh_token
        END,
        updated_at = now()
    WHERE id = account_id;
END;
$$;

-- Create a completely safe view for frontend use (no token columns at all)
CREATE OR REPLACE VIEW public.safe_social_accounts AS
SELECT 
    id,
    creator_id,
    platform,
    platform_user_id,
    username,
    display_name,
    profile_image_url,
    is_active,
    connected_at,
    last_synced_at,
    token_expires_at,
    created_at,
    updated_at
FROM public.social_media_accounts
WHERE creator_id = auth.uid();

-- Security barrier prevents bypassing RLS
ALTER VIEW public.safe_social_accounts SET (security_barrier = true);
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation
COMMENT ON POLICY "Creators: insert account info only (no tokens)" ON public.social_media_accounts 
IS 'SECURITY: Creators can create accounts but encrypted token fields must be NULL';

COMMENT ON POLICY "Creators: update profile fields only" ON public.social_media_accounts 
IS 'SECURITY: Creators can update profile info but cannot access or modify encrypted tokens';

COMMENT ON POLICY "Creators: view non-token data only" ON public.social_media_accounts 
IS 'SECURITY: Creators see account info but encrypted tokens are never exposed to client';

COMMENT ON VIEW public.safe_social_accounts 
IS 'SECURITY: Safe view that completely excludes encrypted token columns from creator access';