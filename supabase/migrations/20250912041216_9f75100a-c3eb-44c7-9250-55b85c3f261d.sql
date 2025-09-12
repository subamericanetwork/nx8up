-- CRITICAL SECURITY FIX: Add missing creator_id filter to safe_social_accounts view
-- This prevents users from seeing other users' social media accounts

-- Drop and recreate the view with proper security filtering
DROP VIEW IF EXISTS public.safe_social_accounts;

CREATE VIEW public.safe_social_accounts 
WITH (security_invoker = true) AS
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
WHERE is_active = true 
  AND creator_id = auth.uid()  -- CRITICAL: Only show user's own accounts
  AND auth.uid() IS NOT NULL;  -- Additional security check

-- Grant select permission to authenticated users
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation
COMMENT ON VIEW public.safe_social_accounts IS 
'SECURITY: Secure view with security_invoker=true that filters by creator_id=auth.uid(). Users can ONLY see their own active social media accounts. Double protection through view filtering AND underlying table RLS policies.';

-- Verify the view now includes the creator_id filter
SELECT pg_get_viewdef('public.safe_social_accounts'::regclass) as secure_view_definition;