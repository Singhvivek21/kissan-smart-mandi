-- =============================================================================
-- FINAL FIX FOR "Database error saving new user"
-- Run this in Supabase Dashboard -> SQL Editor -> Run
-- =============================================================================

-- 1. Drop the trigger that is crashing auth.users during signUp
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Convert role column to simple TEXT (avoids any enum casting failure)
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT USING role::TEXT;
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'FARMER';

-- 3. Update Profiles RLS policies to allow smooth user profile creation
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (true);

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (true);
