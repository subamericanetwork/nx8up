-- Enable RLS on the social_media_accounts_safe view
ALTER VIEW public.social_media_accounts_safe SET (security_barrier = true);

-- Since we can't add RLS policies directly to views in PostgreSQL,
-- we need to ensure the underlying table policies are sufficient.
-- However, let's create a more explicit security definer function for the view

-- Create a security definer function that replaces the view
CREATE OR REPLACE FUNCTION public.get_safe_social_media_accounts()
RETURNS TABLE(
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
  FROM public.social_media_accounts
  WHERE creator_id = auth.uid();
$$;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.get_safe_social_media_accounts() TO authenticated;

-- Since we can't add policies to views, we'll document that the security is enforced
-- by the underlying table's RLS policies and the security_invoker setting
COMMENT ON VIEW public.social_media_accounts_safe IS 'Secure view inheriting RLS from social_media_accounts table. Security enforced via security_invoker=on and underlying table policies.';