-- Fix security vulnerability: Remove public access to campaigns and restrict to authenticated users only
-- This prevents competitors and unauthorized users from accessing sensitive business information

-- Drop the vulnerable policy that allows anyone to view active campaigns
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;

-- Create a secure policy that only allows authenticated creators to view active campaigns
-- This ensures only logged-in creators can browse campaigns for applications
CREATE POLICY "Authenticated creators can view active campaigns" 
ON public.campaigns 
FOR SELECT 
TO authenticated
USING (
  status = 'active'::campaign_status 
  AND auth.uid() IS NOT NULL
  AND auth.uid() IN (
    SELECT id FROM public.profiles WHERE user_type = 'creator'
  )
);

-- Ensure the existing sponsor policies remain intact for campaign management
-- (These policies already exist and are secure, just verifying they're properly documented)

-- Sponsors can still view their own campaigns (existing policy should remain)
-- Sponsors can still create campaigns (existing policy should remain)  
-- Sponsors can still update their own campaigns (existing policy should remain)