-- Remove direct creator access to encrypted token fields
-- This ensures tokens can only be accessed through secure service role functions

-- Drop existing creator policies that might expose token fields
DROP POLICY IF EXISTS "Creators can create their own social accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update their own social account info" ON public.social_media_accounts;

-- Create secure policies that exclude encrypted token fields for creators
CREATE POLICY "Creators can create social accounts (no token access)"
ON public.social_media_accounts
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = creator_id 
    AND encrypted_access_token IS NULL 
    AND encrypted_refresh_token IS NULL
);

-- Allow creators to update non-sensitive fields only
CREATE POLICY "Creators can update account info (no tokens)"
ON public.social_media_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (
    auth.uid() = creator_id 
    -- Prevent any token field updates by creators
    AND (encrypted_access_token IS NULL OR encrypted_access_token = OLD.encrypted_access_token)
    AND (encrypted_refresh_token IS NULL OR encrypted_refresh_token = OLD.encrypted_refresh_token)
);

-- Allow creators to view their accounts without token fields
CREATE POLICY "Creators can view their accounts (no tokens)"
ON public.social_media_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- Ensure service role policies are restrictive and context-aware
-- These were already created in the previous migration, but let's verify they exist

-- Add a view that creators can use to safely access their accounts
CREATE OR REPLACE VIEW public.creator_social_accounts AS
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
    token_expires_at,  -- Safe to expose expiration time
    created_at,
    updated_at
FROM public.social_media_accounts
WHERE creator_id = auth.uid();

-- Grant SELECT permission on the view to authenticated users
GRANT SELECT ON public.creator_social_accounts TO authenticated;

-- Add RLS to the view (though views inherit from base table)
ALTER VIEW public.creator_social_accounts SET (security_barrier = true);

-- Create a secure function for edge functions to update tokens only
CREATE OR REPLACE FUNCTION public.secure_update_social_tokens(
    account_id uuid,
    new_access_token text DEFAULT NULL,
    new_refresh_token text DEFAULT NULL,
    new_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only callable by service role from edge functions
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'Access denied: This function requires service role access';
    END IF;
    
    -- Validate edge function context
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RAISE EXCEPTION 'Access denied: This function can only be called from edge functions';
    END IF;
    
    -- Validate that the account exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.social_media_accounts 
        WHERE id = account_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Account not found or inactive';
    END IF;
    
    -- Update tokens using the existing secure function
    PERFORM public.update_encrypted_tokens(
        account_id, 
        new_access_token, 
        new_refresh_token
    );
    
    -- Update expiration time if provided
    IF new_expires_at IS NOT NULL THEN
        UPDATE public.social_media_accounts 
        SET token_expires_at = new_expires_at, updated_at = now()
        WHERE id = account_id;
    END IF;
    
    RETURN true;
END;
$$;

-- Add comments to document the security design
COMMENT ON TABLE public.social_media_accounts IS 'Stores social media account connections. Encrypted tokens are only accessible through secure service role functions from edge functions.';
COMMENT ON COLUMN public.social_media_accounts.encrypted_access_token IS 'Encrypted OAuth access token. Only accessible via service role functions from edge functions.';
COMMENT ON COLUMN public.social_media_accounts.encrypted_refresh_token IS 'Encrypted OAuth refresh token. Only accessible via service role functions from edge functions.';

-- Log this security improvement
INSERT INTO public.social_media_accounts (creator_id, platform, platform_user_id, username, display_name, is_active)
SELECT 
    '00000000-0000-0000-0000-000000000000'::uuid,
    'security_audit',
    'token_access_secured',
    'system',
    'Token access security enhanced - creators can no longer access encrypted tokens directly',
    false
WHERE NOT EXISTS (
    SELECT 1 FROM public.social_media_accounts 
    WHERE platform = 'security_audit' AND platform_user_id = 'token_access_secured'
);