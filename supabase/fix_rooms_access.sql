-- ============================================
-- FIX: Enable public read access for rooms table
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Make sure RLS is enabled on rooms table (idempotent)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Rooms are viewable by authenticated users" ON rooms;

-- 3. Create a new policy that allows ALL users (including anonymous) to read rooms
-- This is safe because room data is not sensitive
CREATE POLICY "Enable read access for all users"
    ON "public"."rooms"
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4. Keep the admin-only policy for write operations (if it doesn't exist)
-- First drop it to avoid duplicates
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;

CREATE POLICY "Admins can manage rooms"
    ON rooms FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Insert default rooms if they don't exist (upsert pattern)
INSERT INTO rooms (name, capacity, features, is_active) VALUES
    ('Büyük Oda', 20, ARRAY['projector', 'whiteboard', 'video_conference', 'sound_system'], TRUE),
    ('Eğitim Odası', 15, ARRAY['projector', 'whiteboard', 'video_conference'], TRUE),
    ('Demo Odası', 4, ARRAY['tv_screen', 'whiteboard'], TRUE),
    ('Koltuklu Oda', 2, ARRAY['comfortable_seating'], TRUE),
    ('Masalı Oda', 2, ARRAY['desk', 'whiteboard'], TRUE)
ON CONFLICT (name) DO NOTHING;

-- 6. Verify the data was inserted
SELECT id, name, capacity, is_active FROM rooms ORDER BY name;
