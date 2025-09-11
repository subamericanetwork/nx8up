-- Drop the view and replace with a secure function approach
DROP VIEW IF EXISTS public.social_media_accounts_safe;

-- Create a secure table function that provides the same interface
-- but with explicit access control built-in
CREATE OR REPLACE FUNCTION public.social_media_accounts_safe()
RETURNS TABLE (
    id uuid,
    creator_id uuid,
    platform text,
    platform_user_id text,
    username text,
    display_name text,
    profile_image_url text,
    is_active boolean,
    connected_at timestamptz,
    last_synced_at timestamptz,
    token_expires_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
STABLE
AS $$
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
      AND auth.uid() IS NOT NULL; -- Explicit authentication check
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.social_media_accounts_safe() TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.social_media_accounts_safe() IS 'Secure function returning social media accounts without sensitive tokens. Access restricted to authenticated users viewing their own accounts only.';