-- ============================================
-- Migration: Add is_admin column to profiles
-- ============================================

-- 1. Add is_admin column (Default: Everyone is a normal user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Sync existing admin roles to is_admin column
UPDATE profiles
SET is_admin = TRUE
WHERE role = 'admin';

-- 3. Authorize specific admin users by email
UPDATE profiles
SET is_admin = TRUE
WHERE email IN (
    'oylum.bicer@kariyer.net',
    'merve.varici@kariyer.net',
    'dogus.yon@kariyer.net',
    'vildan.sonmez@kariyer.net'
);

-- 4. Create index for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- 5. Update RLS policies to also check is_admin column

-- Update rooms policy to check is_admin
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;
CREATE POLICY "Admins can manage rooms"
    ON rooms FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.is_admin = TRUE)
        )
    );

-- Update reservations update policy
DROP POLICY IF EXISTS "Users can update own reservations, admins can update any" ON reservations;
CREATE POLICY "Users can update own reservations, admins can update any"
    ON reservations FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.is_admin = TRUE)
        )
    );

-- Update reservations delete policy
DROP POLICY IF EXISTS "Users can delete own reservations, admins can delete any" ON reservations;
CREATE POLICY "Users can delete own reservations, admins can delete any"
    ON reservations FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.is_admin = TRUE)
        )
    );

-- 6. Update the is_admin helper function to also check is_admin column
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = user_id
        AND (profiles.role = 'admin' OR profiles.is_admin = TRUE)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
