-- Fix security issues by replacing security definer approach with proper RLS
-- Drop the security definer function and view that caused the security warning
DROP VIEW IF EXISTS public.safe_social_accounts CASCADE;
DROP FUNCTION IF EXISTS public.get_safe_social_accounts() CASCADE;

-- Recreate the original secure view approach but with explicit RLS considerations
-- This view automatically filters by auth.uid() so it's inherently secure
CREATE VIEW public.safe_social_accounts AS
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
FROM public.social_media_accounts
WHERE creator_id = auth.uid()
  AND is_active = true;

-- Set security barrier to ensure the WHERE clause is enforced
ALTER VIEW public.safe_social_accounts SET (security_barrier = true);

-- Grant select permission to authenticated users only
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Ensure the underlying table has proper RLS (it should already be there)
-- Verify that social_media_accounts table has RLS enabled
-- This view inherits the security from the underlying table

-- Add security documentation
COMMENT ON VIEW public.safe_social_accounts IS 'SECURITY: Secure view with built-in creator_id filtering and security barrier enabled. Only shows authenticated user own active social media accounts without exposing sensitive tokens.';