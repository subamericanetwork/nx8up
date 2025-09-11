-- Enable pgsodium extension for encryption (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Create a function to securely encrypt tokens
CREATE OR REPLACE FUNCTION public.encrypt_token(token text)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
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

-- Create a function to securely decrypt tokens
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_token text)
RETURNS text
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
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

-- Create new columns for encrypted tokens
ALTER TABLE public.social_media_accounts 
ADD COLUMN IF NOT EXISTS encrypted_access_token text,
ADD COLUMN IF NOT EXISTS encrypted_refresh_token text;

-- Migrate existing tokens to encrypted columns
UPDATE public.social_media_accounts 
SET 
  encrypted_access_token = public.encrypt_token(access_token),
  encrypted_refresh_token = public.encrypt_token(refresh_token)
WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL;

-- Drop the old unencrypted columns
ALTER TABLE public.social_media_accounts 
DROP COLUMN IF EXISTS access_token,
DROP COLUMN IF EXISTS refresh_token;

-- Remove the old overly permissive RLS policy
DROP POLICY IF EXISTS "Creators can manage their own social accounts" ON public.social_media_accounts;

-- Create more restrictive RLS policies

-- Policy for general account information (excluding sensitive tokens)
CREATE POLICY "Creators can view their own social account info" 
ON public.social_media_accounts 
FOR SELECT 
USING (auth.uid() = creator_id);

-- Policy for inserting new accounts
CREATE POLICY "Creators can create their own social accounts" 
ON public.social_media_accounts 
FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

-- Policy for updating account information (excluding tokens)
CREATE POLICY "Creators can update their own social account info" 
ON public.social_media_accounts 
FOR UPDATE 
USING (auth.uid() = creator_id);

-- Policy for deleting accounts
CREATE POLICY "Creators can delete their own social accounts" 
ON public.social_media_accounts 
FOR DELETE 
USING (auth.uid() = creator_id);

-- Create a secure view for accessing account data without exposing encrypted tokens
CREATE OR REPLACE VIEW public.social_media_accounts_safe AS
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
FROM public.social_media_accounts;

-- Grant appropriate permissions on the safe view
GRANT SELECT ON public.social_media_accounts_safe TO authenticated;

-- Create RLS policy for the safe view
ALTER VIEW public.social_media_accounts_safe SET (security_invoker = on);

-- Create a secure function for edge functions to access tokens (only for system use)
CREATE OR REPLACE FUNCTION public.get_decrypted_tokens(account_id uuid)
RETURNS TABLE(access_token text, refresh_token text)
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  SELECT 
    public.decrypt_token(encrypted_access_token) as access_token,
    public.decrypt_token(encrypted_refresh_token) as refresh_token
  FROM public.social_media_accounts 
  WHERE id = account_id;
$$;

-- Create a secure function for updating tokens (only for system use)
CREATE OR REPLACE FUNCTION public.update_encrypted_tokens(
  account_id uuid,
  new_access_token text DEFAULT NULL,
  new_refresh_token text DEFAULT NULL
)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE SQL
AS $$
  UPDATE public.social_media_accounts 
  SET 
    encrypted_access_token = CASE 
      WHEN new_access_token IS NOT NULL THEN public.encrypt_token(new_access_token)
      ELSE encrypted_access_token
    END,
    encrypted_refresh_token = CASE 
      WHEN new_refresh_token IS NOT NULL THEN public.encrypt_token(new_refresh_token)
      ELSE encrypted_refresh_token
    END,
    updated_at = now()
  WHERE id = account_id;
$$;

-- Revoke direct access to encrypted token columns from regular users
REVOKE SELECT (encrypted_access_token, encrypted_refresh_token) ON public.social_media_accounts FROM authenticated;
REVOKE UPDATE (encrypted_access_token, encrypted_refresh_token) ON public.social_media_accounts FROM authenticated;