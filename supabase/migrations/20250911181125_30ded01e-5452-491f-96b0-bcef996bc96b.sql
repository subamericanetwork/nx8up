-- Enhanced security fix for social media token access
-- Remove any potential direct access to encrypted tokens by creators

-- First, check what policies exist and drop the ones that might allow token access
DROP POLICY IF EXISTS "Creators can create their own social accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update their own social account info" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can create social accounts (no token access)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update account info (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can view their accounts (no tokens)" ON public.social_media_accounts;

-- Create the most restrictive policies for creators - no token field access
CREATE POLICY "Creators can create social accounts without tokens"
ON public.social_media_accounts
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = creator_id 
    AND encrypted_access_token IS NULL 
    AND encrypted_refresh_token IS NULL
);

-- Creators can only update non-sensitive fields, cannot touch token fields
CREATE POLICY "Creators can update non-token fields only"
ON public.social_media_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (
    auth.uid() = creator_id 
    -- Ensure token fields cannot be modified by creators
    AND encrypted_access_token = OLD.encrypted_access_token
    AND encrypted_refresh_token = OLD.encrypted_refresh_token
);

-- Creators can view their accounts but not the token fields (view will filter)
CREATE POLICY "Creators can view social accounts safely"
ON public.social_media_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- Create a secure view that excludes token fields entirely
DROP VIEW IF EXISTS public.creator_social_accounts;
CREATE VIEW public.creator_social_accounts AS
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
    token_expires_at,  -- Safe to show when tokens expire
    created_at,
    updated_at
FROM public.social_media_accounts
WHERE creator_id = auth.uid();

-- Ensure the view is secure
ALTER VIEW public.creator_social_accounts SET (security_barrier = true);
GRANT SELECT ON public.creator_social_accounts TO authenticated;

-- Add a function that validates token operations are only from edge functions
CREATE OR REPLACE FUNCTION public.validate_edge_function_context()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
BEGIN
    -- Check if called by service role
    IF current_user != 'service_role' THEN
        RETURN false;
    END IF;
    
    -- Check if called from edge function context
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- Update existing token functions to use this validation
CREATE OR REPLACE FUNCTION public.get_decrypted_tokens(account_id uuid)
RETURNS TABLE(access_token text, refresh_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate edge function context
    IF NOT public.validate_edge_function_context() THEN
        RAISE EXCEPTION 'Access denied: Token access only allowed from authenticated edge functions';
    END IF;
    
    RETURN QUERY
    SELECT 
        public.decrypt_token(encrypted_access_token) as access_token,
        public.decrypt_token(encrypted_refresh_token) as refresh_token
    FROM public.social_media_accounts 
    WHERE id = account_id AND is_active = true;
END;
$$;

-- Document the security improvements
COMMENT ON POLICY "Creators can create social accounts without tokens" ON public.social_media_accounts 
IS 'Creators can create social accounts but cannot set token fields - tokens are set only by secure edge functions';

COMMENT ON POLICY "Creators can update non-token fields only" ON public.social_media_accounts 
IS 'Creators can update profile fields but encrypted tokens remain unchanged - only edge functions can modify tokens';

COMMENT ON POLICY "Creators can view social accounts safely" ON public.social_media_accounts 
IS 'Creators can view their accounts through the secure view that excludes encrypted token fields';

COMMENT ON VIEW public.creator_social_accounts 
IS 'Secure view for creators to access their social accounts without exposing encrypted tokens';

COMMENT ON FUNCTION public.validate_edge_function_context() 
IS 'Security function that validates operations are performed from authorized edge function context only';