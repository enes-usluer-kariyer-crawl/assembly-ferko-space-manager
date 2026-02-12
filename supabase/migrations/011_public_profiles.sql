-- ============================================
-- ALLOW PUBLIC PROFILES SELECT
-- ============================================

-- Ensure all authenticated users can view profiles
-- This is required to show "Created by" information in the calendar for all users

-- Drop existing overlapping policies to clean up
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles" ON profiles;

-- Create the permissive policy
CREATE POLICY "Profiles are viewable by authenticated users"
ON profiles FOR SELECT
TO authenticated
USING (true);
