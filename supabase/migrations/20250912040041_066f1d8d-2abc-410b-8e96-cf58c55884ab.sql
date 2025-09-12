-- Fix security issue by cleaning up dependencies and creating secure view
-- First drop the dependent function
DROP FUNCTION IF EXISTS public.safe_social_accounts_security() CASCADE;

-- Drop the existing view with cascade to remove all dependencies
DROP VIEW IF EXISTS public.safe_social_accounts CASCADE;

-- Create a security definer function that provides secure access
CREATE OR REPLACE FUNCTION public.get_safe_social_accounts()
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
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- SECURITY: Only authenticated users can access this function
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required';
    END IF;
    
    -- Return only the current user's social media accounts (no tokens exposed)
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
        sma.created_at,
        sma.updated_at
    FROM public.social_media_accounts sma
    WHERE sma.creator_id = auth.uid()
      AND sma.is_active = true;
END;
$$;

-- Create a new secure view that calls the function
CREATE VIEW public.safe_social_accounts AS
SELECT * FROM public.get_safe_social_accounts();

-- Grant permissions to authenticated users only
GRANT EXECUTE ON FUNCTION public.get_safe_social_accounts() TO authenticated;
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.get_safe_social_accounts() IS 'SECURITY: Secure function enforcing user access control - only returns authenticated user social accounts';
COMMENT ON VIEW public.safe_social_accounts IS 'SECURITY: Secure view with built-in authentication and access control';