-- Add image URL column to rooms table
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS img TEXT DEFAULT NULL;
