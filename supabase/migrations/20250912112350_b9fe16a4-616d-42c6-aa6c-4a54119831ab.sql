-- Clean up incomplete YouTube account records
DELETE FROM social_media_accounts 
WHERE creator_id = 'c18ea543-c9e6-4cef-9cbb-36794855acd0' 
  AND platform = 'youtube' 
  AND encrypted_access_token IS NULL;