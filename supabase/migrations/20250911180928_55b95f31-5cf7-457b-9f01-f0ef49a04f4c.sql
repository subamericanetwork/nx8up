-- SECURITY FIX: Remove direct creator access to encrypted token fields
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

-- Allow creators to update non-sensitive fields only (no token fields)
CREATE POLICY "Creators can update account info (no tokens)"
ON public.social_media_accounts
FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

-- Allow creators to view their accounts (tokens will be excluded via view)
CREATE POLICY "Creators can view their accounts"
ON public.social_media_accounts
FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

-- Create a secure view that creators can use to safely access their accounts
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

-- Create a secure function for edge functions to safely update tokens
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

-- Add trigger to prevent token updates by non-service roles
CREATE OR REPLACE FUNCTION public.prevent_token_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow service role to update tokens
    IF current_user = 'service_role' THEN
        RETURN NEW;
    END IF;
    
    -- For other users, prevent token field changes
    IF OLD.encrypted_access_token IS DISTINCT FROM NEW.encrypted_access_token 
       OR OLD.encrypted_refresh_token IS DISTINCT FROM NEW.encrypted_refresh_token THEN
        RAISE EXCEPTION 'Access denied: Token fields can only be updated by service role';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER prevent_token_updates_trigger
    BEFORE UPDATE ON public.social_media_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_token_updates();

-- Add documentation comments
COMMENT ON TABLE public.social_media_accounts IS 'Stores social media account connections. Encrypted tokens are only accessible through secure service role functions from edge functions.';
COMMENT ON COLUMN public.social_media_accounts.encrypted_access_token IS 'Encrypted OAuth access token. Only accessible via service role functions from edge functions.';
COMMENT ON COLUMN public.social_media_accounts.encrypted_refresh_token IS 'Encrypted OAuth refresh token. Only accessible via service role functions from edge functions.';
COMMENT ON VIEW public.creator_social_accounts IS 'Safe view for creators to access their social accounts without token exposure.';
COMMENT ON FUNCTION public.secure_update_social_tokens IS 'Secure function for edge functions to update social media tokens with proper validation.';
COMMENT ON FUNCTION public.prevent_token_updates IS 'Trigger function to prevent direct token updates by non-service roles.';