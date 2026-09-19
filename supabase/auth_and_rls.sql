-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Phase 3: Authentication, RBAC & Row Level Security (RLS) Policies
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

-- Enable RLS on all 7 canonical tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- =============================================================================

-- Get the role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_role, 'FARMER'::user_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is Admin or Officer
CREATE OR REPLACE FUNCTION public.is_officer_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('OFFICER', 'ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get the assigned procurement centre ID of the current Officer
CREATE OR REPLACE FUNCTION public.get_officer_centre_id()
RETURNS UUID AS $$
DECLARE
    v_centre_id UUID;
BEGIN
    SELECT assigned_centre_id INTO v_centre_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN v_centre_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Prevent users from changing their own role during UPDATE
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- If user is NOT an Admin, prevent modifying the role or assigned_centre_id columns
    IF (auth.uid() IS NOT NULL AND public.get_auth_role() != 'ADMIN') THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Unauthorized: You cannot alter your account role.';
        END IF;
        IF NEW.assigned_centre_id IS DISTINCT FROM OLD.assigned_centre_id THEN
            RAISE EXCEPTION 'Unauthorized: You cannot alter your assigned procurement centre.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to guard profiles against role escalation
DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

-- Automatic Profile Creation Trigger on Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_role_text TEXT;
    v_role user_role := 'FARMER';
BEGIN
    v_role_text := NEW.raw_user_meta_data->>'role';
    IF v_role_text IS NOT NULL THEN
        IF UPPER(v_role_text) = 'OFFICER' THEN v_role := 'OFFICER';
        ELSIF UPPER(v_role_text) = 'ADMIN' THEN v_role := 'ADMIN';
        ELSE v_role := 'FARMER';
        END IF;
    END IF;

    INSERT INTO public.profiles (id, full_name, mobile, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Kisan ' || SUBSTRING(COALESCE(NEW.phone, NEW.id::TEXT) FROM 1 FOR 6)),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'mobile', '9' || SUBSTRING(REPLACE(NEW.id::TEXT, '-', '') FROM 1 FOR 9)),
        NEW.email,
        v_role
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. DROP ALL EXISTING DANGEROUS POLICIES
-- =============================================================================

DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('profiles', 'procurement_centres', 'slots', 'bookings', 'procurements', 'payments', 'notifications')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- =============================================================================
-- 3. PROFILES RLS POLICIES
-- =============================================================================

-- Users can view their own profile; Officers/Admins view all
CREATE POLICY "profiles_select_policy"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_officer_or_admin());

-- Users can insert their own profile on signup
CREATE POLICY "profiles_insert_policy"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR public.is_officer_or_admin());

-- Users can update their own profile (trigger prevents role change)
CREATE POLICY "profiles_update_policy"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_officer_or_admin());

-- =============================================================================
-- 4. PROCUREMENT CENTRES RLS POLICIES
-- =============================================================================

-- Anyone authenticated can view procurement centres
CREATE POLICY "centres_select_policy"
    ON public.procurement_centres FOR SELECT
    USING (true);

-- Officers/Admins can manage centres
CREATE POLICY "centres_admin_policy"
    ON public.procurement_centres FOR ALL
    USING (public.is_officer_or_admin());

-- =============================================================================
-- 5. SLOTS RLS POLICIES
-- =============================================================================

-- Anyone authenticated can view available slots
CREATE POLICY "slots_select_policy"
    ON public.slots FOR SELECT
    USING (true);

-- Officers/Admins can create and modify slot schedules
CREATE POLICY "slots_admin_policy"
    ON public.slots FOR ALL
    USING (public.is_officer_or_admin());

-- =============================================================================
-- 6. BOOKINGS RLS POLICIES
-- =============================================================================

-- Farmers view own bookings; Officers view bookings for their centre; Admins view all
CREATE POLICY "bookings_select_policy"
    ON public.bookings FOR SELECT
    USING (
        auth.uid() = farmer_id 
        OR public.get_auth_role() = 'ADMIN'
        OR (public.get_auth_role() = 'OFFICER' AND (public.get_officer_centre_id() IS NULL OR centre_id = public.get_officer_centre_id()))
    );

-- Farmers can insert bookings for themselves
CREATE POLICY "bookings_insert_policy"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() = farmer_id OR public.is_officer_or_admin());

-- Farmers can cancel own pending bookings; Officers/Admins can update status
CREATE POLICY "bookings_update_policy"
    ON public.bookings FOR UPDATE
    USING (
        (auth.uid() = farmer_id AND status = 'WAITING')
        OR public.get_auth_role() = 'ADMIN'
        OR (public.get_auth_role() = 'OFFICER' AND (public.get_officer_centre_id() IS NULL OR centre_id = public.get_officer_centre_id()))
    );

-- =============================================================================
-- 7. PROCUREMENTS RLS POLICIES
-- =============================================================================

-- Farmers view own procurements; Officers/Admins view centre procurements
CREATE POLICY "procurements_select_policy"
    ON public.procurements FOR SELECT
    USING (
        auth.uid() = farmer_id 
        OR public.get_auth_role() = 'ADMIN'
        OR (public.get_auth_role() = 'OFFICER' AND (public.get_officer_centre_id() IS NULL OR centre_id = public.get_officer_centre_id()))
    );

-- Officers/Admins can insert/update procurements
CREATE POLICY "procurements_manage_policy"
    ON public.procurements FOR ALL
    USING (public.is_officer_or_admin());

-- =============================================================================
-- 8. PAYMENTS RLS POLICIES
-- =============================================================================

-- Farmers view own payment records; Officers/Admins view all
CREATE POLICY "payments_select_policy"
    ON public.payments FOR SELECT
    USING (auth.uid() = farmer_id OR public.is_officer_or_admin());

-- Officers/Admins manage payments
CREATE POLICY "payments_manage_policy"
    ON public.payments FOR ALL
    USING (public.is_officer_or_admin());

-- =============================================================================
-- 9. NOTIFICATIONS RLS POLICIES
-- =============================================================================

-- Farmers view own notifications
CREATE POLICY "notifications_select_policy"
    ON public.notifications FOR SELECT
    USING (auth.uid() = farmer_id OR public.is_officer_or_admin());

-- Farmers update is_read status on own notifications
CREATE POLICY "notifications_update_policy"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = farmer_id);

-- System / Officers create notifications
CREATE POLICY "notifications_insert_policy"
    ON public.notifications FOR INSERT
    WITH CHECK (true);
