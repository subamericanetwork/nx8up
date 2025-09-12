-- Fix Security Definer View warning by using the recommended SECURITY INVOKER approach
-- Drop the current security definer function and view
DROP VIEW IF EXISTS public.safe_social_accounts;
DROP FUNCTION IF EXISTS public.get_safe_social_accounts();

-- Create a simple view with SECURITY INVOKER that relies on underlying table RLS
-- This is the Supabase recommended approach for views
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
WHERE is_active = true;

-- Grant select permission to authenticated users
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation explaining the approach
COMMENT ON VIEW public.safe_social_accounts IS 
'SECURITY: Uses security_invoker=true to inherit caller privileges and rely on underlying table RLS policies. Shows only authenticated user own active social media accounts through social_media_accounts table RLS policies.';

-- Verify the view uses security invoker (should return true)
SELECT 
    schemaname, 
    viewname, 
    viewoptions
FROM pg_views 
WHERE viewname = 'safe_social_accounts' 
AND schemaname = 'public';