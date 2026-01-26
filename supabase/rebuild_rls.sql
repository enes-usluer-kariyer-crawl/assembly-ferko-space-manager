-- ============================================
-- MASTER RLS POLICY REFACTOR (BULLETPROOF SECURITY)
-- ============================================

-- 1. Helper Function: public.is_admin()
-- Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RESET: Drop ALL existing policies on target tables
-- We use a DO block to dynamically find and drop all policies for these tables.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('profiles', 'rooms', 'reservations')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. TABLE-BY-TABLE POLICIES

-- =======================
-- PROFILES
-- =======================
-- SELECT: Users can see their own. Admins can see everyone.
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT TO authenticated
USING ( auth.uid() = id OR public.is_admin() );

-- INSERT: Allow authenticated users to insert their own profile.
CREATE POLICY "profiles_insert_policy" ON profiles
FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = id );

-- UPDATE: Users update their own. Admins update everyone.
CREATE POLICY "profiles_update_policy" ON profiles
FOR UPDATE TO authenticated
USING ( auth.uid() = id OR public.is_admin() );

-- DELETE: Admins only (Implicitly restricted, but let's be explicit if needed, or rely on lack of policy. 
-- However, for robustness, we can add an admin-only delete policy).
CREATE POLICY "profiles_delete_policy" ON profiles
FOR DELETE TO authenticated
USING ( public.is_admin() );


-- =======================
-- ROOMS
-- =======================
-- SELECT: All authenticated users can view rooms.
CREATE POLICY "rooms_select_policy" ON rooms
FOR SELECT TO authenticated
USING ( true );

-- INSERT: Only Admins.
CREATE POLICY "rooms_insert_policy" ON rooms
FOR INSERT TO authenticated
WITH CHECK ( public.is_admin() );

-- UPDATE: Only Admins.
CREATE POLICY "rooms_update_policy" ON rooms
FOR UPDATE TO authenticated
USING ( public.is_admin() )
WITH CHECK ( public.is_admin() );

-- DELETE: Only Admins.
CREATE POLICY "rooms_delete_policy" ON rooms
FOR DELETE TO authenticated
USING ( public.is_admin() );


-- =======================
-- RESERVATIONS
-- =======================
-- SELECT: Everyone sees reservations (for calendar).
CREATE POLICY "reservations_select_policy" ON reservations
FOR SELECT TO authenticated
USING ( true );

-- INSERT: Authenticated users can insert their own.
CREATE POLICY "reservations_insert_policy" ON reservations
FOR INSERT TO authenticated
WITH CHECK ( auth.uid() = user_id );

-- UPDATE: Users can cancel their own (if status is pending). Admins can update status for ANY.
CREATE POLICY "reservations_update_policy" ON reservations
FOR UPDATE TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending')
  OR public.is_admin()
)
WITH CHECK (
  (auth.uid() = user_id AND status = 'cancelled') -- Users can ONLY change status to cancelled
  OR public.is_admin() -- Admins can do anything
);

-- DELETE: Admins only.
CREATE POLICY "reservations_delete_policy" ON reservations
FOR DELETE TO authenticated
USING ( public.is_admin() );


-- 4. TRIGGER STABILIZATION
-- Re-create handle_new_user with ON CONFLICT DO NOTHING to prevent race conditions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Trigger definition remains the same, but function body is updated)

-- ============================================
-- REFACTOR COMPLETE
-- ============================================
