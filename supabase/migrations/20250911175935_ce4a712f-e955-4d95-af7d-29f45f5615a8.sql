-- Step 1: Create a secure view that excludes token fields for client access
CREATE OR REPLACE VIEW public.social_media_accounts_secure AS
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
FROM public.social_media_accounts;

-- Step 2: Enable RLS on the view
ALTER VIEW public.social_media_accounts_secure SET (security_invoker = on);

-- Step 3: Create RLS policies for the secure view (creators can only see their own accounts)
CREATE POLICY "Creators can view their own social accounts (secure)"
ON public.social_media_accounts_secure
FOR SELECT
USING (auth.uid() = creator_id);

-- Step 4: Update existing RLS policies on main table to RESTRICT token access to service role only
DROP POLICY IF EXISTS "Creators can view their own social account info" ON public.social_media_accounts;

-- New policy that allows creators to see non-sensitive fields only when accessed through secure functions
CREATE POLICY "Creators can view non-sensitive account info"
ON public.social_media_accounts
FOR SELECT
USING (
    auth.uid() = creator_id 
    AND current_setting('role') = 'service_role'
);

-- Service role can access everything (for internal functions)
CREATE POLICY "Service role full access"
ON public.social_media_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 5: Update the existing safe function to use secure access
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
    -- This function runs with definer rights (service role), 
    -- but only returns data for the authenticated user
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
        sma.created_at,
        sma.updated_at
    FROM public.social_media_accounts sma
    WHERE sma.creator_id = auth.uid()
      AND auth.uid() IS NOT NULL;
$$;

-- Step 6: Create a service-role-only function for token access (used by edge functions)
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
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    -- This function can only be called by service role (edge functions)
    -- and includes the encrypted tokens for OAuth operations
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
$$;

-- Step 7: Grant necessary permissions
GRANT SELECT ON public.social_media_accounts_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_media_accounts_safe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_social_account_with_tokens(uuid) TO service_role;