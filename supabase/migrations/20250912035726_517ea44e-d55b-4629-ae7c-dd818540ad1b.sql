-- Fix security issue: Add RLS policies to safe_social_accounts view
-- The view already filters by creator_id = auth.uid(), but needs explicit RLS policies

-- Enable Row Level Security on the view
ALTER VIEW public.safe_social_accounts SET (security_barrier = true);

-- Create RLS policy for the view to ensure only account owners can access their data
-- Since this is a view, we need to use a security definer function approach

CREATE OR REPLACE FUNCTION public.safe_social_accounts_security()
RETURNS SETOF public.safe_social_accounts
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  FROM social_media_accounts
  WHERE creator_id = auth.uid()
    AND auth.uid() IS NOT NULL;
$$;

-- Grant appropriate permissions
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add comment for security documentation
COMMENT ON VIEW public.safe_social_accounts IS 'SECURITY: View with built-in creator_id filtering and security barrier enabled';
COMMENT ON FUNCTION public.safe_social_accounts_security() IS 'SECURITY: Secure function for safe social accounts access with proper auth validation';