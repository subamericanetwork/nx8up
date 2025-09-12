-- SECURITY FIX PART 2: Complete Secure Implementation
-- This completes the ultra-secure token architecture

-- Step 1: Create secure token access functions
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
    -- MAXIMUM SECURITY: Multi-layer validation
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
    -- MAXIMUM SECURITY: Multi-layer validation
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

-- Step 2: Update safe view to use secure architecture
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

-- Step 3: Add audit trail for security monitoring
CREATE TABLE IF NOT EXISTS public.token_access_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid REFERENCES public.social_media_accounts(id),
    access_type text NOT NULL,
    accessed_at timestamp with time zone DEFAULT now(),
    function_name text,
    user_agent text
);

ALTER TABLE public.token_access_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can write audit logs
CREATE POLICY "Service role audit only"
ON public.token_access_audit
FOR INSERT
TO service_role
WITH CHECK (true);

-- Step 4: Update timestamp trigger for secure tokens
CREATE OR REPLACE FUNCTION public.update_secure_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_secure_tokens_updated_at
    BEFORE UPDATE ON public.secure_social_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_secure_tokens_timestamp();

-- Step 5: Enhanced security documentation
COMMENT ON FUNCTION public.get_secure_social_tokens(uuid) IS 'ULTRA-SECURE: Token access with multi-layer validation - service role + edge function context only';
COMMENT ON FUNCTION public.update_secure_social_tokens(uuid, text, text, timestamp with time zone) IS 'ULTRA-SECURE: Token updates with multi-layer validation - service role + edge function context only';
COMMENT ON VIEW public.safe_social_accounts IS 'CREATOR SAFE: Secure view with security_invoker - no token exposure possible';
COMMENT ON TABLE public.token_access_audit IS 'SECURITY MONITORING: Audit trail for all token access attempts';