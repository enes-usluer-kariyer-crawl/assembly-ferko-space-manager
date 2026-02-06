-- Add new recurrence columns to reservations table
-- This migration adds support for advanced recurrence options like Outlook

-- Add recurrence_end_type column (never, count, date)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS recurrence_end_type TEXT DEFAULT NULL;

-- Add recurrence_count column (number of occurrences)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT NULL;

-- Add recurrence_end_date column (end date for recurrence)
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ DEFAULT NULL;

-- Update recurrence_pattern to support new values (daily, biweekly, monthly)
-- No constraint change needed as TEXT type already supports any value

-- Add comment for documentation
COMMENT ON COLUMN reservations.recurrence_end_type IS 'How the recurrence ends: never (indefinite), count (after N occurrences), date (on specific date)';
COMMENT ON COLUMN reservations.recurrence_count IS 'Number of occurrences when recurrence_end_type is count';
COMMENT ON COLUMN reservations.recurrence_end_date IS 'End date when recurrence_end_type is date';
