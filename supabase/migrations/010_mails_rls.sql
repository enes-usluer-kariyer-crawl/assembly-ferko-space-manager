-- ============================================
-- MAILS TABLE RLS POLICY
-- Allow authenticated users to read mails for autocomplete
-- ============================================

-- Enable RLS on mails table (if not already enabled)
ALTER TABLE public.mails ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read mails for autocomplete
CREATE POLICY "mails_select_policy" ON public.mails
FOR SELECT TO authenticated
USING ( true );
