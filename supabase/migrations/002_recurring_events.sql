-- ============================================
-- Assembly Ferko Reservation System
-- Migration 002 - Recurring Events Support
-- ============================================

-- Add recurrence_pattern column to reservations
-- Values: 'none', 'weekly'
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT NOT NULL DEFAULT 'none';

-- Add parent_reservation_id for linking recurring instances to their parent
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS parent_reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE;

-- Index for finding child reservations of a recurring series
CREATE INDEX IF NOT EXISTS idx_reservations_parent_id ON reservations(parent_reservation_id);

-- Index for finding recurring reservations
CREATE INDEX IF NOT EXISTS idx_reservations_recurrence ON reservations(recurrence_pattern) WHERE recurrence_pattern != 'none';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
