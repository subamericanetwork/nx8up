-- Fix security linter warnings from previous migration

-- Fix WARN: Function Search Path Mutable
-- Update functions to have stable search_path settings

CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN token IS NULL OR token = '' THEN NULL
    ELSE encode(pgsodium.crypto_aead_det_encrypt(
      convert_to(token, 'utf8'),
      convert_to('social_media_tokens', 'utf8'),
      NULL
    ), 'base64')
  END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE 
    WHEN encrypted_token IS NULL OR encrypted_token = '' THEN NULL
    ELSE convert_from(pgsodium.crypto_aead_det_decrypt(
      decode(encrypted_token, 'base64'),
      convert_to('social_media_tokens', 'utf8'),
      NULL
    ), 'utf8')
  END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_token_updates()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow service role to update tokens
    IF current_user = 'service_role' THEN
        RETURN NEW;
    END IF;
    
    -- For other users, prevent token field changes
    IF OLD.encrypted_access_token IS DISTINCT FROM NEW.encrypted_access_token 
       OR OLD.encrypted_refresh_token IS DISTINCT FROM NEW.encrypted_refresh_token THEN
        RAISE EXCEPTION 'SECURITY_VIOLATION: Token fields can only be updated by service role';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Fix ERROR: Security Definer View warnings
-- Remove security_barrier from views and rely on underlying table RLS instead
-- This is safer and removes the security definer view warning

DROP VIEW IF EXISTS public.safe_social_accounts;
DROP VIEW IF EXISTS public.creator_social_accounts;

-- Create views without security_barrier (let RLS on base table handle security)
CREATE VIEW public.safe_social_accounts AS
SELECT 
    id,
    creator_id,
    platform,
    platform_user_id,
    username,
    display_name,
    profile_image_url,
    is_active,
    connected_at,
    last_synced_at,
    token_expires_at,
    created_at,
    updated_at
FROM public.social_media_accounts
WHERE creator_id = auth.uid();

GRANT SELECT ON public.safe_social_accounts TO authenticated;

-- Update comments to reflect security design
COMMENT ON VIEW public.safe_social_accounts 
IS 'SECURITY: Safe view for creators - excludes all encrypted token fields. Security enforced by RLS on base table.';

COMMENT ON FUNCTION public.prevent_token_updates() 
IS 'SECURITY: Trigger function preventing direct token field modifications by non-service roles';

-- Verify that all token access functions have proper security
CREATE OR REPLACE FUNCTION public.secure_token_validation()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    -- This function validates that only service role from edge functions can access tokens
    IF current_user != 'service_role' THEN
        RETURN false;
    END IF;
    
    -- Validate edge function context
    IF NOT (
        current_setting('request.headers', true)::json->>'user-agent' LIKE '%supabase-edge-runtime%'
        OR current_setting('application_name') = 'PostgREST'
    ) THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

COMMENT ON FUNCTION public.secure_token_validation() 
IS 'SECURITY: Validates service role access from edge function context for token operations';