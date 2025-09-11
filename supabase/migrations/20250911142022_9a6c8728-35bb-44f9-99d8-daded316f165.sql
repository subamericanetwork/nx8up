-- Fix the RLS issue with social_media_accounts_safe view
-- Since PostgreSQL views can't have RLS policies directly, we need to ensure
-- the security is properly handled through the underlying table

-- Drop the existing view and recreate it as a more secure implementation
DROP VIEW IF EXISTS public.social_media_accounts_safe;

-- Create a secure replacement that explicitly filters by the current user
CREATE VIEW public.social_media_accounts_safe 
WITH (security_invoker = on, security_barrier = true)
AS 
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
WHERE creator_id = auth.uid();

-- Grant appropriate permissions
GRANT SELECT ON public.social_media_accounts_safe TO authenticated;

-- Add security comment
COMMENT ON VIEW public.social_media_accounts_safe IS 'Secure view of social media accounts without tokens. Filters data by authenticated user ID for security.';