-- Fix function search path security issue
-- Set explicit search_path on all public functions for security

-- Update all existing functions to have explicit search_path
ALTER FUNCTION public.decrypt_token(text) SET search_path = public;
ALTER FUNCTION public.encrypt_token(text) SET search_path = public;
ALTER FUNCTION public.get_decrypted_tokens(uuid) SET search_path = public;
ALTER FUNCTION public.get_safe_social_media_accounts() SET search_path = public;
ALTER FUNCTION public.get_social_account_with_tokens(uuid) SET search_path = public;
ALTER FUNCTION public.secure_update_social_tokens(uuid, text, text, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.update_encrypted_tokens(uuid, text, text) SET search_path = public;
ALTER FUNCTION public.prevent_token_updates() SET search_path = public;
ALTER FUNCTION public.secure_token_validation() SET search_path = public;
ALTER FUNCTION public.get_secure_social_tokens(uuid) SET search_path = public;
ALTER FUNCTION public.update_secure_social_tokens(uuid, text, text, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.update_secure_tokens_timestamp() SET search_path = public;
ALTER FUNCTION public.social_media_accounts_safe() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.security_compliance_check() SET search_path = public;