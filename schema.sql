-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Supabase PostgreSQL Database Schema & Row Level Security (RLS) Policies
-- =============================================================================

-- Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS (Status Values)
-- =============================================================================

-- Booking Status: WAITING -> CALLED -> IN_PROGRESS -> COMPLETED (or CANCELLED)
DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Procurement Status: PENDING -> VERIFIED -> COMPLETED
DO $$ BEGIN
    CREATE TYPE procurement_status AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment Status: PENDING -> PAID
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User Roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('FARMER', 'ADMIN', 'OFFICER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. TABLES DEFINITIONS
-- =============================================================================

-- 1. Profiles Table (Linked with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT,
    role user_role DEFAULT 'FARMER' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Procurement Centres Table
CREATE TABLE IF NOT EXISTS public.procurement_centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT,
    daily_capacity INT DEFAULT 60 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Slots Table (Hourly/Daily windows per Centre)
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id UUID NOT NULL REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT DEFAULT 25 NOT NULL,
    booked_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT chk_slot_capacity CHECK (booked_count <= capacity)
);

-- 4. Bookings Table (Farmer reservations & tokens)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    centre_id UUID NOT NULL REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
    token_number TEXT NOT NULL,
    status booking_status DEFAULT 'WAITING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Procurements Table (Weighment & quality grading)
CREATE TABLE IF NOT EXISTS public.procurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    crop TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL, -- Quantity in Quintals
    quality TEXT NOT NULL,           -- e.g. FAQ Grade A, Grade B
    amount NUMERIC(12, 2) NOT NULL,   -- Gross payable amount (₹)
    status procurement_status DEFAULT 'PENDING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Payments Table (Direct DBT bank payout records)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_id UUID NOT NULL REFERENCES public.procurements(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    transaction_id TEXT,             -- Bank UTR / DBT Reference
    status payment_status DEFAULT 'PENDING' NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_slots_centre_date ON public.slots(centre_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer ON public.bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_status ON public.bookings(centre_id, status);
CREATE INDEX IF NOT EXISTS idx_procurements_farmer ON public.procurements(farmer_id);
CREATE INDEX IF NOT EXISTS idx_payments_farmer ON public.payments(farmer_id);

-- =============================================================================
-- 4. AUTOMATIC PROFILE TRIGGER (ON AUTH SIGNUP)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, mobile, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Kisan ' || SUBSTRING(NEW.phone FROM 7)),
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'mobile', '98' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)),
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'FARMER')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. ADMIN CHECK HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('ADMIN', 'OFFICER')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all 6 tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurement_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- PROFILES POLICIES
-- -----------------------------------------------------------------------------
-- Farmers can read and update their own profile
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- PROCUREMENT CENTRES POLICIES
-- -----------------------------------------------------------------------------
-- Anyone authenticated can view procurement centres to select for booking
CREATE POLICY "Anyone can view procurement centres"
    ON public.procurement_centres FOR SELECT
    USING (true);

-- Only Admins can insert/update/delete centres
CREATE POLICY "Admins can manage procurement centres"
    ON public.procurement_centres FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- SLOTS POLICIES
-- -----------------------------------------------------------------------------
-- Anyone can view available slots
CREATE POLICY "Anyone can view slots"
    ON public.slots FOR SELECT
    USING (true);

-- Admins can create and modify slot schedules & capacity
CREATE POLICY "Admins can manage slots"
    ON public.slots FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- BOOKINGS POLICIES
-- -----------------------------------------------------------------------------
-- Farmers can view only their own bookings; Admins can view all bookings
CREATE POLICY "Farmers can view own bookings, Admins view all"
    ON public.bookings FOR SELECT
    USING (auth.uid() = farmer_id OR public.is_admin());

-- Farmers can create bookings for themselves
CREATE POLICY "Farmers can create bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() = farmer_id OR public.is_admin());

-- Farmers can cancel their own pending booking; Admins can update any status
CREATE POLICY "Farmers can cancel own bookings, Admins can update"
    ON public.bookings FOR UPDATE
    USING (auth.uid() = farmer_id OR public.is_admin());

-- -----------------------------------------------------------------------------
-- PROCUREMENTS POLICIES
-- -----------------------------------------------------------------------------
-- Farmers can view their own procurement records; Admins can view all
CREATE POLICY "Farmers can view own procurements, Admins view all"
    ON public.procurements FOR SELECT
    USING (auth.uid() = farmer_id OR public.is_admin());

-- Only Admins/Officers can record new weighments & grading
CREATE POLICY "Admins can manage procurements"
    ON public.procurements FOR ALL
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- PAYMENTS POLICIES
-- -----------------------------------------------------------------------------
-- Farmers can view their own payment slips; Admins can view all
CREATE POLICY "Farmers can view own payments, Admins view all"
    ON public.payments FOR SELECT
    USING (auth.uid() = farmer_id OR public.is_admin());

-- Only Admins can issue and update payment records
CREATE POLICY "Admins can manage payments"
    ON public.payments FOR ALL
    USING (public.is_admin());

-- =============================================================================
-- 7. SEED DATA (SAMPLE CENTRES, SLOTS & CROPS)
-- =============================================================================

INSERT INTO public.procurement_centres (id, name, location, address, daily_capacity)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Krishi Upaj Mandi - Sector 7', 'Karnal, Haryana', 'GT Road, Near Grain Yard, Sector 7', 60),
    ('a0000000-0000-0000-0000-000000000002', 'Anaaj Mandi - Main Hub', 'Ludhiana, Punjab', 'Gill Road, Mandi Complex', 80),
    ('a0000000-0000-0000-0000-000000000003', 'Kisan Samridhi Center', 'Khargone, Madhya Pradesh', 'Bypass Road, Krishi Upaj', 50)
ON CONFLICT (id) DO NOTHING;

-- Sample Slots for Today & Tomorrow
INSERT INTO public.slots (centre_id, slot_date, start_time, end_time, capacity, booked_count)
VALUES
    ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '08:00:00', '11:00:00', 25, 12),
    ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '11:00:00', '14:00:00', 30, 8),
    ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '14:00:00', '17:00:00', 30, 5),
    ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE + 1, '08:00:00', '11:00:00', 25, 0)
ON CONFLICT DO NOTHING;
