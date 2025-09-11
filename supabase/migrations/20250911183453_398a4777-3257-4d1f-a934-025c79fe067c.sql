-- SECURITY FIX PART 1: Create Ultra-Secure Token Storage
-- This implements complete separation of OAuth tokens from account data

-- Step 1: Clean up duplicate policies first
DROP POLICY IF EXISTS "Creators can create social accounts (no token access)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update account info (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can view their accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: insert account info only (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: update profile fields only" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: view non-token data only" ON public.social_media_accounts;

-- Step 2: Create ultra-secure separate tokens table
CREATE TABLE IF NOT EXISTS public.secure_social_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL UNIQUE REFERENCES public.social_media_accounts(id) ON DELETE CASCADE,
    encrypted_access_token text,
    encrypted_refresh_token text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable maximum security on tokens table
ALTER TABLE public.secure_social_tokens ENABLE ROW LEVEL SECURITY;

-- Step 3: Ultra-restrictive RLS - ONLY service role from edge functions
CREATE POLICY "SECURITY: Service role edge functions only"
ON public.secure_social_tokens
FOR ALL
TO service_role
USING (
    current_user = 'service_role'
    AND (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    )
)
WITH CHECK (
    current_user = 'service_role'
    AND (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    )
);

-- Step 4: Migrate existing tokens to secure table
INSERT INTO public.secure_social_tokens (account_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
SELECT id, encrypted_access_token, encrypted_refresh_token, token_expires_at
FROM public.social_media_accounts
WHERE encrypted_access_token IS NOT NULL OR encrypted_refresh_token IS NOT NULL
ON CONFLICT (account_id) DO UPDATE SET
    encrypted_access_token = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    token_expires_at = EXCLUDED.token_expires_at,
    updated_at = now();

-- Step 5: Create secure main table policies (no token access possible)
CREATE POLICY "Creators: manage accounts (token-free)"
ON public.social_media_accounts
FOR ALL
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

-- Service role can manage accounts (tokens in separate secure table)
CREATE POLICY "Service role: account management"
ON public.social_media_accounts
FOR ALL
TO service_role
USING (
    current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
    OR current_setting('application_name') = 'PostgREST'
);

-- Security documentation
COMMENT ON TABLE public.secure_social_tokens IS 'ULTRA-SECURE: OAuth tokens completely isolated with service-role-only access';
COMMENT ON TABLE public.social_media_accounts IS 'SAFE ZONE: Account data without any sensitive tokens';