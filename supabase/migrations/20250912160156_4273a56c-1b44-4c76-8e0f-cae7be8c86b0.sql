-- Create a simple test function to verify database access
CREATE OR REPLACE FUNCTION public.test_token_functions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Test basic functionality
  result := jsonb_build_object(
    'test_encrypt', public.encrypt_token('test_token_123'),
    'current_user', current_user,
    'user_agent', current_setting('request.headers', true)::json->>'user-agent',
    'timestamp', now()
  );
  
  RETURN result;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.test_token_functions() TO service_role;