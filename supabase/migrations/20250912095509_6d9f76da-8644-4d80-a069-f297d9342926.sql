-- Fix RLS policies for social_media_accounts to allow service role operations
-- Drop the complex edge function context policies that might be causing issues
DROP POLICY IF EXISTS "Service role insert only from edge functions" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Service role update only from edge functions" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Service role: account management" ON public.social_media_accounts;

-- Create simpler service role policies that work reliably
CREATE POLICY "Service role full access" 
ON public.social_media_accounts 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure creators can still manage their accounts (without tokens)
-- This policy already exists but let's make sure it works properly
DROP POLICY IF EXISTS "Creators: manage accounts (token-free)" ON public.social_media_accounts;

CREATE POLICY "Creators can manage their accounts" 
ON public.social_media_accounts 
FOR ALL 
USING ((auth.uid() = creator_id) AND (encrypted_access_token IS NULL OR encrypted_access_token = ''))
WITH CHECK ((auth.uid() = creator_id) AND (encrypted_access_token IS NULL OR encrypted_access_token = ''));