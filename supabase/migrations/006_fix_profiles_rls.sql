-- Fix "Unknown User" issue by allowing all authenticated users to read profiles
-- This is necessary to display the reservation owner's name/email in the calendar

-- Drop potential restrictive policies (covering various naming conventions)
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create permissive policy for SELECT
-- Allow any authenticated user to READ basic profile info (email, full_name) of other users.
CREATE POLICY "Profiles are viewable by authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (TRUE);
