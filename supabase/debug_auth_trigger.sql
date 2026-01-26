-- 1. Temporarily drop the trigger to isolate the issue
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Check and Fix RLS on profiles table
-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the service_role (and postgres) to insert/update/select/delete
-- This is often implicit, but good to have explicit if things are weird.
DROP POLICY IF EXISTS "Enable all access for service_role" ON public.profiles;
CREATE POLICY "Enable all access for service_role" ON public.profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- OPTIONAL: For debugging, allow ANYONE to insert (Uncomment if needed)
-- DROP POLICY IF EXISTS "Enable insert for everyone" ON public.profiles;
-- CREATE POLICY "Enable insert for everyone" ON public.profiles FOR INSERT WITH CHECK (true);