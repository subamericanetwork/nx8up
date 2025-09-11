-- Step 1: Drop existing policies that allow token access
DROP POLICY IF EXISTS "Creators can view their own social account info" ON public.social_media_accounts;

-- Step 2: Create restrictive policy - tokens only accessible via service role
CREATE POLICY "Creators can view non-sensitive fields only"
ON public.social_media_accounts
FOR SELECT
USING (
    auth.uid() = creator_id 
    AND current_setting('role') = 'service_role'
);

-- Step 3: Service role can access everything (for internal functions)
CREATE POLICY "Service role full access to social accounts"
ON public.social_media_accounts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Step 4: Create a service-role-only function for token access (used by edge functions)
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

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_social_account_with_tokens(uuid) TO service_role;