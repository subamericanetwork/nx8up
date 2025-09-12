-- Fix Security Linter Issues: Function Search Path
-- This migration addresses the remaining security warnings by fixing function search paths

-- =====================================================
-- FIX FUNCTION SEARCH PATH SECURITY ISSUE
-- =====================================================

-- Drop and recreate the validation function with proper search path
DROP FUNCTION IF EXISTS public.validate_rls_security();

CREATE OR REPLACE FUNCTION public.validate_rls_security()
RETURNS TABLE(table_name text, has_rls boolean, has_anon_block boolean, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.schemaname||'.'||t.tablename as table_name,
        t.rowsecurity as has_rls,
        EXISTS(
            SELECT 1 FROM pg_policies p
            WHERE p.schemaname = 'public' 
            AND p.tablename = t.tablename 
            AND p.roles @> ARRAY['anon'] 
            AND p.qual = 'false'
        ) as has_anon_block,
        CASE 
            WHEN NOT t.rowsecurity THEN 'CRITICAL: RLS not enabled'
            WHEN NOT EXISTS(
                SELECT 1 FROM pg_policies p
                WHERE p.schemaname = 'public' 
                AND p.tablename = t.tablename 
                AND p.roles @> ARRAY['anon'] 
                AND p.qual = 'false'
            ) THEN 'WARNING: No anonymous blocking policy'
            ELSE 'SECURE: Properly protected'
        END as status
    FROM pg_tables t
    WHERE t.schemaname = 'public'
    AND t.tablename NOT IN ('spatial_ref_sys') -- Exclude system tables
    ORDER BY t.tablename;
END;
$$;

-- Create a helper function to check table security status
CREATE OR REPLACE FUNCTION public.check_table_security_summary()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    critical_count integer;
    warning_count integer;
    result_text text;
BEGIN
    -- Count critical and warning issues
    SELECT 
        COUNT(*) FILTER (WHERE status LIKE 'CRITICAL:%'),
        COUNT(*) FILTER (WHERE status LIKE 'WARNING:%')
    INTO critical_count, warning_count
    FROM public.validate_rls_security();
    
    -- Build result summary
    IF critical_count > 0 THEN
        result_text := format('CRITICAL: %s tables with RLS disabled! ', critical_count);
    ELSE
        result_text := 'GOOD: All tables have RLS enabled. ';
    END IF;
    
    IF warning_count > 0 THEN
        result_text := result_text || format('WARNING: %s tables lack anonymous blocking policies.', warning_count);
    ELSE
        result_text := result_text || 'EXCELLENT: All tables properly block anonymous access.';
    END IF;
    
    RETURN result_text;
END;
$$;

-- =====================================================
-- SECURITY VALIDATION SUMMARY
-- =====================================================
-- Updated functions now have proper search_path set to prevent security issues
-- You can validate security status by running: SELECT * FROM public.validate_rls_security();
-- Or get a summary with: SELECT public.check_table_security_summary();