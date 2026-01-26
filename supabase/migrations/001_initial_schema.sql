-- ============================================
-- Assembly Ferko Reservation System
-- Database Migration - Initial Schema
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ENUM TYPES
-- ============================================

-- User role enum
CREATE TYPE user_role AS ENUM ('admin', 'user');

-- Reservation status enum
CREATE TYPE reservation_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- ============================================
-- 2. PROFILES TABLE
-- ============================================

CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX idx_profiles_email ON profiles(email);

-- Index for role-based queries (e.g., finding admins)
CREATE INDEX idx_profiles_role ON profiles(role);

-- ============================================
-- 3. ROOMS TABLE
-- ============================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    features TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active rooms queries
CREATE INDEX idx_rooms_is_active ON rooms(is_active);

-- ============================================
-- 4. RESERVATIONS TABLE
-- ============================================

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status reservation_status NOT NULL DEFAULT 'pending',
    tags TEXT[] DEFAULT '{}',
    catering_requested BOOLEAN NOT NULL DEFAULT FALSE,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure end_time is after start_time
    CONSTRAINT chk_valid_time_range CHECK (end_time > start_time)
);

-- Index for room availability queries
CREATE INDEX idx_reservations_room_time ON reservations(room_id, start_time, end_time);

-- Index for user's reservations
CREATE INDEX idx_reservations_user_id ON reservations(user_id);

-- Index for status filtering (pending approvals, etc.)
CREATE INDEX idx_reservations_status ON reservations(status);

-- Index for date range queries
CREATE INDEX idx_reservations_start_time ON reservations(start_time);

-- Index for catering requests
CREATE INDEX idx_reservations_catering ON reservations(catering_requested) WHERE catering_requested = TRUE;

-- ============================================
-- 5. SEED DATA - ROOMS
-- ============================================

INSERT INTO rooms (name, capacity, features, is_active) VALUES
    ('Büyük Oda', 20, ARRAY['projector', 'whiteboard', 'video_conference', 'sound_system'], TRUE),
    ('Eğitim Odası', 15, ARRAY['projector', 'whiteboard', 'video_conference'], TRUE),
    ('Demo Odası', 4, ARRAY['tv_screen', 'whiteboard'], TRUE),
    ('Koltuklu Oda', 2, ARRAY['comfortable_seating'], TRUE),
    ('Masalı Oda', 2, ARRAY['desk', 'whiteboard'], TRUE);

-- ============================================
-- 6. TRIGGER: Auto-create profile on user signup
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'user'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 7. TRIGGER: Auto-update updated_at timestamp
-- ============================================

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to profiles table
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to rooms table
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to reservations table
CREATE TRIGGER update_reservations_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES

-- Users can view all profiles (needed for displaying reservation owner names)
CREATE POLICY "Profiles are viewable by authenticated users"
    ON profiles FOR SELECT
    TO authenticated
    USING (TRUE);

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ROOMS POLICIES

-- Everyone can view active rooms
CREATE POLICY "Rooms are viewable by authenticated users"
    ON rooms FOR SELECT
    TO authenticated
    USING (TRUE);

-- Only admins can insert/update/delete rooms
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

-- RESERVATIONS POLICIES

-- All authenticated users can view all reservations (needed for calendar)
CREATE POLICY "Reservations are viewable by authenticated users"
    ON reservations FOR SELECT
    TO authenticated
    USING (TRUE);

-- Authenticated users can create reservations
CREATE POLICY "Authenticated users can create reservations"
    ON reservations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reservations, admins can update any
CREATE POLICY "Users can update own reservations, admins can update any"
    ON reservations FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Users can delete their own reservations, admins can delete any
CREATE POLICY "Users can delete own reservations, admins can delete any"
    ON reservations FOR DELETE
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = user_id
        AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for reservation conflicts
CREATE OR REPLACE FUNCTION check_reservation_conflict(
    p_room_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM reservations
        WHERE room_id = p_room_id
        AND status IN ('pending', 'approved')
        AND id != COALESCE(p_exclude_reservation_id, '00000000-0000-0000-0000-000000000000')
        AND (
            (start_time < p_end_time AND end_time > p_start_time)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check "Big Event" availability (all rooms must be free)
CREATE OR REPLACE FUNCTION check_big_event_availability(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Returns TRUE if all rooms are available (no conflicts)
    RETURN NOT EXISTS (
        SELECT 1 FROM reservations
        WHERE status IN ('pending', 'approved')
        AND id != COALESCE(p_exclude_reservation_id, '00000000-0000-0000-0000-000000000000')
        AND (
            (start_time < p_end_time AND end_time > p_start_time)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if time slot has a "Big Event" blocking it
CREATE OR REPLACE FUNCTION has_big_event_blocking(
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    big_event_tags TEXT[] := ARRAY['ÖM-Success Meetings', 'Exco Toplantısı', 'ÖM- HR Small Talks'];
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM reservations
        WHERE status IN ('pending', 'approved')
        AND id != COALESCE(p_exclude_reservation_id, '00000000-0000-0000-0000-000000000000')
        AND tags && big_event_tags
        AND (
            (start_time < p_end_time AND end_time > p_start_time)
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
