-- Enable RLS on the safe_social_accounts view and create proper policies
-- This fixes the security issue where the view doesn't have explicit RLS policies

-- Enable Row Level Security on the view
ALTER VIEW public.safe_social_accounts SET (security_invoker = on);

-- Create RLS policy for the view to ensure only account owners can access their data
CREATE POLICY "safe_social_accounts_user_access" 
ON public.safe_social_accounts
FOR SELECT 
TO authenticated
USING (creator_id = auth.uid() AND auth.uid() IS NOT NULL);

-- Grant select permission to authenticated users
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add documentation about the security measures
COMMENT ON VIEW public.safe_social_accounts IS 
'SECURITY: View with RLS enabled and security_invoker=true. Users can only access their own social media accounts through creator_id filtering and RLS policies. Triple protection: view filter + RLS policy + underlying table policies.';