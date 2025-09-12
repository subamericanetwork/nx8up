-- Fix the security issue with safe_social_accounts view
-- Views cannot have RLS policies directly applied to them in PostgreSQL
-- Instead, we'll drop the unsafe view and ensure only the secure function is available

-- Drop the unsafe view that doesn't have proper security
DROP VIEW IF EXISTS public.safe_social_accounts;

-- Create a comment to document why the view was removed
COMMENT ON FUNCTION public.social_media_accounts_safe() IS 
'SECURITY: This function provides secure access to social media accounts without exposing encrypted tokens. Uses RLS and creator_id filtering. Replaces the unsafe safe_social_accounts view.';

-- Ensure the secure function has proper permissions
REVOKE ALL ON FUNCTION public.social_media_accounts_safe() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.social_media_accounts_safe() TO authenticated;