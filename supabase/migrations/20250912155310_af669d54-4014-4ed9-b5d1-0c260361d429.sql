-- Check if pgsodium extension is enabled and fix encryption permissions
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Grant necessary permissions for encryption functions
GRANT USAGE ON SCHEMA pgsodium TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pgsodium TO service_role;

-- Ensure the encryption/decryption functions work properly
DROP FUNCTION IF EXISTS public.encrypt_token(text);
DROP FUNCTION IF EXISTS public.decrypt_token(text);

-- Recreate encryption functions with proper permissions
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN token IS NULL OR token = '' THEN NULL
    ELSE encode(pgsodium.crypto_aead_det_encrypt(
      convert_to(token, 'utf8'),
      convert_to('social_media_tokens', 'utf8'),
      (SELECT raw_key FROM pgsodium.valid_key WHERE name = 'social_tokens' LIMIT 1)
    ), 'base64')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN encrypted_token IS NULL OR encrypted_token = '' THEN NULL
    ELSE convert_from(pgsodium.crypto_aead_det_decrypt(
      decode(encrypted_token, 'base64'),
      convert_to('social_media_tokens', 'utf8'),
      (SELECT raw_key FROM pgsodium.valid_key WHERE name = 'social_tokens' LIMIT 1)
    ), 'utf8')
  END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.encrypt_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(text) TO service_role;