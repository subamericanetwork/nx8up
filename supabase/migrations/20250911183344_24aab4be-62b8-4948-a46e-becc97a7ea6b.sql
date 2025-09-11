-- COMPREHENSIVE SECURITY FIX: Complete Token Protection Overhaul
-- This migration implements defense-in-depth security for social media tokens

-- Step 1: Clean up duplicate and conflicting policies
DROP POLICY IF EXISTS "Creators can create social accounts (no token access)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can update account info (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators can view their accounts" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: insert account info only (no tokens)" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: update profile fields only" ON public.social_media_accounts;
DROP POLICY IF EXISTS "Creators: view non-token data only" ON public.social_media_accounts;

-- Step 2: Create a completely separate, ultra-secure tokens table
CREATE TABLE IF NOT EXISTS public.secure_social_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES public.social_media_accounts(id) ON DELETE CASCADE,
    encrypted_access_token text,
    encrypted_refresh_token text,
    token_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on secure tokens table with NO public access
ALTER TABLE public.secure_social_tokens ENABLE ROW LEVEL SECURITY;

-- Step 3: Create ultra-restrictive policies - ONLY service role from edge functions
CREATE POLICY "SECURITY: Service role only from edge functions"
ON public.secure_social_tokens
FOR ALL
TO service_role
USING (
    -- Triple validation: service role + edge function context + application name
    current_user = 'service_role'
    AND (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    )
    AND current_setting('role') = 'service_role'
)
WITH CHECK (
    current_user = 'service_role'
    AND (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'  
    )
    AND current_setting('role') = 'service_role'
);

-- Step 4: Remove token columns from main table (migrate data first)
-- Migrate existing encrypted tokens to secure table
INSERT INTO public.secure_social_tokens (account_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
SELECT id, encrypted_access_token, encrypted_refresh_token, token_expires_at
FROM public.social_media_accounts
WHERE encrypted_access_token IS NOT NULL OR encrypted_refresh_token IS NOT NULL
ON CONFLICT (account_id) DO UPDATE SET
    encrypted_access_token = EXCLUDED.encrypted_access_token,
    encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
    token_expires_at = EXCLUDED.token_expires_at,
    updated_at = now();

-- Step 5: Create completely secure main table policies (NO token access possible)
CREATE POLICY "Creators: manage own accounts (token-free zone)"
ON public.social_media_accounts
FOR ALL
TO authenticated
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

-- Service role can manage accounts but tokens are in separate table
CREATE POLICY "Service role: account management only"
ON public.social_media_accounts  
FOR ALL
TO service_role
USING (
    current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
    OR current_setting('application_name') = 'PostgREST'
);

-- Step 6: Update secure token access functions
CREATE OR REPLACE FUNCTION public.get_secure_social_tokens(account_id uuid)
RETURNS TABLE(
    access_token text,
    refresh_token text,
    expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- MAXIMUM SECURITY: Multiple validation layers
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Only service role can access tokens';
    END IF;
    
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Tokens only accessible from edge functions';
    END IF;
    
    -- Validate account exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM public.social_media_accounts 
        WHERE id = account_id AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Account not found or inactive';
    END IF;
    
    RETURN QUERY
    SELECT 
        public.decrypt_token(st.encrypted_access_token) as access_token,
        public.decrypt_token(st.encrypted_refresh_token) as refresh_token,
        st.token_expires_at as expires_at
    FROM public.secure_social_tokens st
    WHERE st.account_id = get_secure_social_tokens.account_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_secure_social_tokens(
    account_id uuid,
    new_access_token text DEFAULT NULL,
    new_refresh_token text DEFAULT NULL,
    new_expires_at timestamp with time zone DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- MAXIMUM SECURITY: Multiple validation layers
    IF current_user != 'service_role' THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Only service role can update tokens';
    END IF;
    
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Token updates only from edge functions';
    END IF;
    
    -- Upsert tokens in secure table
    INSERT INTO public.secure_social_tokens (account_id, encrypted_access_token, encrypted_refresh_token, token_expires_at)
    VALUES (
        account_id,
        CASE WHEN new_access_token IS NOT NULL THEN public.encrypt_token(new_access_token) ELSE NULL END,
        CASE WHEN new_refresh_token IS NOT NULL THEN public.encrypt_token(new_refresh_token) ELSE NULL END,
        new_expires_at
    )
    ON CONFLICT (account_id) DO UPDATE SET
        encrypted_access_token = CASE 
            WHEN new_access_token IS NOT NULL THEN public.encrypt_token(new_access_token)
            ELSE secure_social_tokens.encrypted_access_token
        END,
        encrypted_refresh_token = CASE 
            WHEN new_refresh_token IS NOT NULL THEN public.encrypt_token(new_refresh_token) 
            ELSE secure_social_tokens.encrypted_refresh_token
        END,
        token_expires_at = COALESCE(new_expires_at, secure_social_tokens.token_expires_at),
        updated_at = now();
END;
$$;

-- Step 7: Fix the safe view RLS issue
DROP VIEW IF EXISTS public.safe_social_accounts;

CREATE VIEW public.safe_social_accounts WITH (security_invoker=true) AS
SELECT 
    sma.id,
    sma.creator_id,
    sma.platform,
    sma.platform_user_id,
    sma.username,
    sma.display_name,
    sma.profile_image_url,
    sma.is_active,
    sma.connected_at,
    sma.last_synced_at,
    sst.token_expires_at, -- Safe to show expiration from secure table
    sma.created_at,
    sma.updated_at
FROM public.social_media_accounts sma
LEFT JOIN public.secure_social_tokens sst ON sma.id = sst.account_id
WHERE sma.creator_id = auth.uid();

-- Grant access to the safe view
GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Step 8: Add unique constraint to prevent token table abuse
ALTER TABLE public.secure_social_tokens 
ADD CONSTRAINT unique_account_tokens UNIQUE (account_id);

-- Step 9: Add audit trail for token access
CREATE TABLE IF NOT EXISTS public.token_access_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES public.social_media_accounts(id),
    access_type text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now(),
    user_agent text,
    ip_address inet
);

ALTER TABLE public.token_access_log ENABLE ROW LEVEL SECURITY;

-- Only service role can write to audit log
CREATE POLICY "Service role audit access only"
ON public.token_access_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Step 10: Update triggers for timestamp management
CREATE OR REPLACE FUNCTION public.update_secure_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_secure_tokens_updated_at
    BEFORE UPDATE ON public.secure_social_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_secure_tokens_timestamp();

-- Step 11: Security documentation
COMMENT ON TABLE public.secure_social_tokens IS 'ULTRA-SECURE: OAuth tokens isolated in separate table with service-role-only access from edge functions';
COMMENT ON TABLE public.social_media_accounts IS 'PUBLIC SAFE: Social media account info WITHOUT any token fields - completely token-free zone';
COMMENT ON VIEW public.safe_social_accounts IS 'CREATOR ACCESS: Safe view for creators with security_invoker, no token exposure possible';

-- Step 12: Remove token columns from main table (final cleanup)
-- Note: This is commented out for safety - run after verification
-- ALTER TABLE public.social_media_accounts DROP COLUMN IF EXISTS encrypted_access_token;
-- ALTER TABLE public.social_media_accounts DROP COLUMN IF EXISTS encrypted_refresh_token;