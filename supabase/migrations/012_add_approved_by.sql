-- Add approved_by column to reservations table to track who approved the reservation
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_reservations_approved_by ON public.reservations(approved_by);
