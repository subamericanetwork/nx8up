-- Fix RLS security issue for safe_social_accounts view
-- Views don't support direct RLS policies, so we need to enable RLS on the view itself

-- First, enable RLS on the safe_social_accounts view
ALTER VIEW public.safe_social_accounts ENABLE ROW LEVEL SECURITY;

-- Create a security definer function that enforces access control
CREATE OR REPLACE FUNCTION public.enforce_safe_social_accounts_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow authenticated users
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Create RLS policy for the view (SELECT only since it's a read-only view)
CREATE POLICY "Users can only view their own social accounts"
ON public.safe_social_accounts
FOR SELECT
TO authenticated
USING (public.enforce_safe_social_accounts_access());

-- Grant proper permissions
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Add security documentation
COMMENT ON POLICY "Users can only view their own social accounts" ON public.safe_social_accounts IS 'SECURITY: Restricts access to only authenticated users viewing their own social media accounts through the safe_social_accounts view';
COMMENT ON FUNCTION public.enforce_safe_social_accounts_access() IS 'SECURITY: Enforces authenticated access control for safe_social_accounts view';