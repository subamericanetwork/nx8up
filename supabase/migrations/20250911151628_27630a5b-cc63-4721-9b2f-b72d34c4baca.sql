-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create more secure and comprehensive RLS policies for profiles table
-- This ensures users can only access their own profile data and prevents unauthorized access to email addresses

-- Policy for viewing profiles (SELECT)
CREATE POLICY "Users can only view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Policy for inserting profiles (INSERT) 
CREATE POLICY "Users can only insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Policy for updating profiles (UPDATE)
CREATE POLICY "Users can only update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- Policy for deleting profiles (DELETE) - restrict this operation
CREATE POLICY "Users cannot delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (false);

-- Ensure the id column cannot be null (it should reference auth.users primary key)
ALTER TABLE public.profiles 
ALTER COLUMN id SET NOT NULL;

-- Add a constraint to ensure id references auth.users if not already present
-- (This may fail if constraint already exists, which is fine)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;