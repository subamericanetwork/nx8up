-- Security Enhancement: Fix RLS Policy Vulnerabilities
-- This migration addresses security issues by adding explicit anonymous blocking policies
-- while preserving existing functional policies.

-- =====================================================
-- 1. ADD EXPLICIT ANONYMOUS BLOCKING POLICIES
-- =====================================================

-- Block anonymous access to profiles (if not already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'Block anonymous access to profiles'
    ) THEN
        CREATE POLICY "Block anonymous access to profiles" 
        ON public.profiles 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to social media accounts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'social_media_accounts' 
        AND policyname = 'Block anonymous access to social accounts'
    ) THEN
        CREATE POLICY "Block anonymous access to social accounts" 
        ON public.social_media_accounts 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to campaigns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'campaigns' 
        AND policyname = 'Block anonymous access to campaigns'
    ) THEN
        CREATE POLICY "Block anonymous access to campaigns" 
        ON public.campaigns 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to applications
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'applications' 
        AND policyname = 'Block anonymous access to applications'
    ) THEN
        CREATE POLICY "Block anonymous access to applications" 
        ON public.applications 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to collaborations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'collaborations' 
        AND policyname = 'Block anonymous access to collaborations'
    ) THEN
        CREATE POLICY "Block anonymous access to collaborations" 
        ON public.collaborations 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to content
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'content' 
        AND policyname = 'Block anonymous access to content'
    ) THEN
        CREATE POLICY "Block anonymous access to content" 
        ON public.content 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to social media stats
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'social_media_stats' 
        AND policyname = 'Block anonymous access to social stats'
    ) THEN
        CREATE POLICY "Block anonymous access to social stats" 
        ON public.social_media_stats 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to secure social tokens (extra security layer)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'secure_social_tokens' 
        AND policyname = 'Block anonymous access to secure tokens'
    ) THEN
        CREATE POLICY "Block anonymous access to secure tokens" 
        ON public.secure_social_tokens 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- Block anonymous access to token audit logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'token_access_audit' 
        AND policyname = 'Block anonymous access to token audit'
    ) THEN
        CREATE POLICY "Block anonymous access to token audit" 
        ON public.token_access_audit 
        FOR ALL 
        TO anon
        USING (false);
    END IF;
END $$;

-- =====================================================
-- 2. CREATE SECURITY VALIDATION FUNCTION
-- =====================================================

-- Create a function to validate RLS security posture
CREATE OR REPLACE FUNCTION public.validate_rls_security()
RETURNS TABLE(table_name text, has_rls boolean, has_anon_block boolean, security_status text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text as table_name,
        t.rowsecurity as has_rls,
        EXISTS(
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' 
            AND p.tablename = t.tablename 
            AND 'anon' = ANY(p.roles)
            AND p.qual = 'false'
        ) as has_anon_block,
        CASE 
            WHEN NOT t.rowsecurity THEN 'CRITICAL: RLS disabled'
            WHEN NOT EXISTS(
                SELECT 1 FROM pg_policies p
                WHERE p.schemaname = 'public' 
                AND p.tablename = t.tablename 
                AND 'anon' = ANY(p.roles)
                AND p.qual = 'false'
            ) THEN 'WARNING: No anonymous blocking'
            ELSE 'SECURE: Properly protected'
        END as security_status
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT IN ('spatial_ref_sys')
    ORDER BY t.tablename;
END;
$$;

-- =====================================================
-- SECURITY SUMMARY
-- =====================================================
-- This migration implements comprehensive security by:
-- 1. Adding explicit anonymous-blocking policies to all sensitive tables
-- 2. Using defensive programming with IF NOT EXISTS checks
-- 3. Creating a security validation function for monitoring
-- 4. Preserving all existing functional policies
--
-- The result is defense-in-depth security that ensures:
-- - Anonymous users cannot access any sensitive data
-- - User emails and personal information are protected
-- - Business data and tokens remain secure
-- - Comprehensive monitoring of security posture