-- ============================================
-- Private Calendar Access - RLS Policy Update
-- Ensures only authenticated users can view reservations
-- ============================================

-- Drop the public view policy if it exists (defensive)
DROP POLICY IF EXISTS "View Reservations Public" ON reservations;

-- Ensure authenticated-only SELECT policy exists
-- (This is idempotent - won't fail if policy already exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'reservations'
        AND policyname = 'View Reservations Authenticated'
    ) THEN
        CREATE POLICY "View Reservations Authenticated" ON reservations
            FOR SELECT
            TO authenticated
            USING (TRUE);
    END IF;
END $$;

-- Note: The original migration (001_initial_schema.sql) already has:
-- CREATE POLICY "Reservations are viewable by authenticated users"
-- This migration ensures no public access policy exists and adds an
-- explicit authenticated-only policy for clarity.

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
