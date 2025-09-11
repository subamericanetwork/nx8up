-- Fix critical security vulnerability: Prevent manipulation of social media statistics
-- Current policy allows any authenticated user to insert fake stats, which could:
-- 1. Inflate follower counts and engagement rates fraudulently
-- 2. Affect business decisions based on false metrics  
-- 3. Give unfair advantages to creators with manipulated data

-- Drop the insecure policy that allows anyone to insert social stats
DROP POLICY IF EXISTS "System can insert social stats" ON public.social_media_stats;

-- Create a secure policy that only allows legitimate system operations
-- Edge functions use the service role key and bypass RLS, but we need a policy
-- for any potential future authenticated operations that should be restricted

-- Only allow INSERT operations from the system/edge functions
-- Since edge functions use service role key, they bypass RLS anyway
-- This policy ensures no regular authenticated users can manipulate stats
CREATE POLICY "Only system service can insert social stats" 
ON public.social_media_stats 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Alternative approach: completely remove INSERT access for public role
-- and rely entirely on service role operations (edge functions)
-- This is the most secure approach since only edge functions should insert stats

-- Revoke INSERT permission from public role to be extra secure
REVOKE INSERT ON public.social_media_stats FROM public;
REVOKE INSERT ON public.social_media_stats FROM authenticated;

-- Only allow service role (edge functions) to insert
GRANT INSERT ON public.social_media_stats TO service_role;