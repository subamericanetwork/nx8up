-- Security Fix: Add Anonymous Blocking Policies
-- This migration addresses the critical security vulnerability by adding
-- explicit policies that block anonymous users from accessing sensitive data.

-- Add anonymous blocking policies only if they don't exist

-- Block anonymous access to profiles
CREATE POLICY "Deny anonymous profiles access" 
ON public.profiles 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to social media accounts  
CREATE POLICY "Deny anonymous social accounts access" 
ON public.social_media_accounts 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to campaigns
CREATE POLICY "Deny anonymous campaigns access" 
ON public.campaigns 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to applications
CREATE POLICY "Deny anonymous applications access" 
ON public.applications 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to collaborations
CREATE POLICY "Deny anonymous collaborations access" 
ON public.collaborations 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to content
CREATE POLICY "Deny anonymous content access" 
ON public.content 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to social media stats
CREATE POLICY "Deny anonymous social stats access" 
ON public.social_media_stats 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to secure social tokens
CREATE POLICY "Deny anonymous secure tokens access" 
ON public.secure_social_tokens 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to token audit logs
CREATE POLICY "Deny anonymous token audit access" 
ON public.token_access_audit 
FOR ALL 
TO anon
USING (false);

-- =====================================================
-- SECURITY SUMMARY
-- =====================================================
-- This migration adds explicit denial policies for anonymous users
-- to prevent data harvesting attacks on sensitive tables containing:
-- - User emails and personal information (profiles)
-- - Social media tokens and credentials (social_media_accounts, secure_social_tokens)  
-- - Business data and campaign information (campaigns, applications, collaborations)
-- - User-generated content and analytics (content, social_media_stats)
--
-- These policies work in conjunction with existing authenticated user policies
-- to create a defense-in-depth security model.