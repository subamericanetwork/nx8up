-- Completely remove any direct SELECT access to the main table for regular users
DROP POLICY IF EXISTS "Creators can view non-sensitive fields only" ON public.social_media_accounts;

-- Only allow service role to SELECT for internal operations (no user access)
CREATE POLICY "Service role can select for internal operations"
ON public.social_media_accounts
FOR SELECT
TO service_role
USING (true);

-- Ensure all user access goes through the safe function
-- The social_media_accounts_safe() function already exists and excludes tokens

-- Add a comment to document the security design
COMMENT ON TABLE public.social_media_accounts IS 
'Security design: Direct access restricted. User access only through social_media_accounts_safe() function. Token access only through get_social_account_with_tokens() for service role.';

COMMENT ON FUNCTION public.social_media_accounts_safe() IS 
'Secure user access to social media accounts without exposing encrypted tokens. All client-side code should use this function.';

COMMENT ON FUNCTION public.get_social_account_with_tokens(uuid) IS 
'Service role only function for accessing encrypted tokens. Only for use by trusted edge functions.';

-- Verify the safe function excludes token fields
CREATE OR REPLACE FUNCTION public.social_media_accounts_safe()
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
    created_at timestamp with time zone,
    updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    -- This function provides secure access to social media accounts
    -- WITHOUT exposing encrypted tokens to client-side code
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
        sma.token_expires_at,  -- Safe to expose expiration time
        sma.created_at,
        sma.updated_at
    FROM public.social_media_accounts sma
    WHERE sma.creator_id = auth.uid()
      AND auth.uid() IS NOT NULL;
$$;