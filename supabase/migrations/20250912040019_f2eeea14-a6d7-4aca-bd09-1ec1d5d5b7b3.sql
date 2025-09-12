-- Fix security issue by replacing unsafe view with secure function approach
-- Drop the existing view since it can't have RLS policies
DROP VIEW IF EXISTS public.safe_social_accounts;

-- Create a security definer function that provides the same functionality
-- but with proper access control
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
    WHERE sma.creator_id = auth.uid();
END;
$$;

-- Create a new secure view that calls the function
CREATE VIEW public.safe_social_accounts AS
SELECT * FROM public.get_safe_social_accounts();

-- Grant permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_safe_social_accounts() TO authenticated;
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation
COMMENT ON FUNCTION public.get_safe_social_accounts() IS 'SECURITY: Secure function that returns social media accounts for authenticated users only, with no token exposure';
COMMENT ON VIEW public.safe_social_accounts IS 'SECURITY: Secure view backed by authenticated function - only shows user own accounts';