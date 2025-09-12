-- Security Enhancement: Strengthen RLS Policies to Prevent Data Exposure
-- This migration addresses critical security vulnerabilities by implementing comprehensive
-- RLS policies that explicitly deny anonymous access to sensitive user data.

-- =====================================================
-- 1. STRENGTHEN PROFILES TABLE SECURITY
-- =====================================================

-- Drop existing policies to replace with more secure versions
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can only update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users cannot delete profiles" ON public.profiles;

-- Create comprehensive policies that explicitly deny anonymous access
CREATE POLICY "Authenticated users can view own profile only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Authenticated users can insert own profile only" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated users can update own profile only" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Explicitly deny all access to anonymous users
CREATE POLICY "Block anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon
USING (false);

-- Prevent deletion entirely
CREATE POLICY "Prevent profile deletion" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (false);

-- =====================================================
-- 2. STRENGTHEN SOCIAL MEDIA ACCOUNTS TABLE SECURITY  
-- =====================================================

-- The current policies are good but let's add explicit anonymous blocking
CREATE POLICY "Block anonymous access to social accounts" 
ON public.social_media_accounts 
FOR ALL 
TO anon
USING (false);

-- =====================================================
-- 3. STRENGTHEN CAMPAIGNS TABLE SECURITY
-- =====================================================

-- Add explicit anonymous blocking for campaigns
CREATE POLICY "Block anonymous access to campaigns" 
ON public.campaigns 
FOR ALL 
TO anon
USING (false);

-- =====================================================
-- 4. STRENGTHEN APPLICATIONS TABLE SECURITY
-- =====================================================

-- Add explicit anonymous blocking for applications
CREATE POLICY "Block anonymous access to applications" 
ON public.applications 
FOR ALL 
TO anon
USING (false);

-- =====================================================
-- 5. STRENGTHEN OTHER SENSITIVE TABLES
-- =====================================================

-- Block anonymous access to collaborations
CREATE POLICY "Block anonymous access to collaborations" 
ON public.collaborations 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to content
CREATE POLICY "Block anonymous access to content" 
ON public.content 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to social media stats
CREATE POLICY "Block anonymous access to social stats" 
ON public.social_media_stats 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to secure social tokens (extra security)
CREATE POLICY "Block anonymous access to secure tokens" 
ON public.secure_social_tokens 
FOR ALL 
TO anon
USING (false);

-- Block anonymous access to token audit logs
CREATE POLICY "Block anonymous access to token audit" 
ON public.token_access_audit 
FOR ALL 
TO anon
USING (false);

-- =====================================================
-- 6. CREATE SECURITY VALIDATION FUNCTION
-- =====================================================

-- Create a function to validate that all tables have proper RLS protection
CREATE OR REPLACE FUNCTION public.validate_rls_security()
RETURNS TABLE(table_name text, has_rls boolean, has_anon_block boolean, status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        rowsecurity as has_rls,
        EXISTS(
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = t.tablename 
            AND roles @> ARRAY['anon'] 
            AND qual = 'false'
        ) as has_anon_block,
        CASE 
            WHEN NOT rowsecurity THEN 'CRITICAL: RLS not enabled'
            WHEN NOT EXISTS(
                SELECT 1 FROM pg_policies 
                WHERE schemaname = 'public' 
                AND tablename = t.tablename 
                AND roles @> ARRAY['anon'] 
                AND qual = 'false'
            ) THEN 'WARNING: No anonymous blocking policy'
            ELSE 'SECURE: Properly protected'
        END as status
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename NOT IN ('spatial_ref_sys') -- Exclude system tables
    ORDER BY t.tablename;
END;
$$;

-- =====================================================
-- SECURITY SUMMARY
-- =====================================================
-- This migration implements defense-in-depth security by:
-- 1. Replacing broad policies with explicit authenticated-only policies
-- 2. Adding explicit anonymous-blocking policies for all sensitive tables
-- 3. Using TO authenticated and TO anon clauses for clear role separation
-- 4. Creating a validation function to monitor security posture
-- 
-- These changes ensure that:
-- - Anonymous users cannot access any sensitive data
-- - Only authenticated users can access their own data
-- - Business-sensitive information is protected from competitors
-- - Token and credential data is secured with multiple layers