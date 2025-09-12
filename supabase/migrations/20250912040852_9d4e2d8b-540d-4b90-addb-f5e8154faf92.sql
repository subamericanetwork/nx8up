-- Fix the search path security warning for the get_safe_social_accounts function
-- The function already has SET search_path = public, but let's make it more explicit

CREATE OR REPLACE FUNCTION public.get_safe_social_accounts()
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    -- SECURITY: This function only returns social media accounts for the authenticated user
    -- It cannot expose other users' data because of the WHERE clause
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
      AND sma.is_active = true
      AND auth.uid() IS NOT NULL;  -- Additional security check
$$;