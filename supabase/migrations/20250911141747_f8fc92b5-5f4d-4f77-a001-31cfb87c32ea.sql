-- Add RLS policy for the social_media_accounts_safe view
-- Note: Since this is a view, we need to ensure it inherits security properly

-- First, ensure the view has the security invoker property (already set, but confirming)
ALTER VIEW public.social_media_accounts_safe SET (security_invoker = on);

-- The view will inherit the RLS policies from the underlying table (social_media_accounts)
-- Since we're using security_invoker = on, the view will check permissions as the calling user

-- Grant proper select permission specifically for the safe view
GRANT SELECT ON public.social_media_accounts_safe TO authenticated;

-- Ensure the view works correctly by checking the underlying table's RLS
-- (The existing policies on social_media_accounts already restrict to creator_id = auth.uid())

-- Create an additional security comment for documentation
COMMENT ON VIEW public.social_media_accounts_safe IS 'Secure view of social media accounts without sensitive token data. Inherits RLS policies from social_media_accounts table.';