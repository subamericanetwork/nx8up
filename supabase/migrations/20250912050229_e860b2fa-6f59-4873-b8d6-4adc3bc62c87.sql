-- Security Fix: Add Anonymous Blocking Policies
-- This addresses the critical security vulnerabilities by blocking anonymous access

-- Block anonymous access to profiles table (prevents email harvesting)
CREATE POLICY "Deny anon access to profiles" 
ON public.profiles 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to social media accounts (protects tokens)
CREATE POLICY "Deny anon access to social accounts" 
ON public.social_media_accounts 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to campaigns (protects business data)
CREATE POLICY "Deny anon access to campaigns" 
ON public.campaigns 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to applications (protects sensitive negotiations)
CREATE POLICY "Deny anon access to applications" 
ON public.applications 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to collaborations
CREATE POLICY "Deny anon access to collaborations" 
ON public.collaborations 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to content
CREATE POLICY "Deny anon access to content" 
ON public.content 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to social media stats
CREATE POLICY "Deny anon access to social stats" 
ON public.social_media_stats 
FOR ALL 
TO anon
USING (false);

-- These policies ensure that anonymous users cannot access any sensitive data
-- while preserving existing authenticated user access patterns