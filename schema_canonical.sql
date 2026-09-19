-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Canonical Production Schema Definition
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

-- Enable pgcrypto for UUID generation & HMAC calculation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUM TYPE DEFINITIONS
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('FARMER', 'OFFICER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE procurement_status AS ENUM ('PENDING', 'VERIFIED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. TABLE DEFINITIONS
-- =============================================================================

-- 1. Procurement Centres
CREATE TABLE IF NOT EXISTS public.procurement_centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT NOT NULL,
    daily_capacity INT DEFAULT 60 NOT NULL CHECK (daily_capacity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Profiles (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    email TEXT,
    role user_role DEFAULT 'FARMER' NOT NULL,
    assigned_centre_id UUID REFERENCES public.procurement_centres(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Slots (Operating Time Windows per Centre)
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id UUID NOT NULL REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT DEFAULT 25 NOT NULL CHECK (capacity > 0),
    booked_count INT DEFAULT 0 NOT NULL CHECK (booked_count >= 0 AND booked_count <= capacity),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_slot_centre_date_time UNIQUE (centre_id, slot_date, start_time)
);

-- 4. Bookings (Farmer Slot Reservations & Tokens)
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    centre_id UUID NOT NULL REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES public.slots(id) ON DELETE CASCADE,
    token_number TEXT NOT NULL,
    token_sequence INT NOT NULL CHECK (token_sequence > 0),
    crop TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    slot_date DATE NOT NULL,
    slot_time TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    vehicle_number TEXT NOT NULL,
    qr_signature TEXT NOT NULL,
    status booking_status DEFAULT 'WAITING' NOT NULL,
    admitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_centre_date_token UNIQUE (centre_id, slot_date, token_sequence)
);

-- 5. Procurements (Official Weighment & Grading)
CREATE TABLE IF NOT EXISTS public.procurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    centre_id UUID NOT NULL REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    crop TEXT NOT NULL,
    gross_weight NUMERIC(10, 2) NOT NULL CHECK (gross_weight > 0),
    tare_weight NUMERIC(10, 2) NOT NULL CHECK (tare_weight >= 0),
    net_weight NUMERIC(10, 2) GENERATED ALWAYS AS (gross_weight - tare_weight) STORED,
    moisture_percentage NUMERIC(4, 2) DEFAULT 0.00 CHECK (moisture_percentage >= 0 AND moisture_percentage <= 100),
    quality_grade TEXT NOT NULL,
    msp_rate NUMERIC(10, 2) NOT NULL CHECK (msp_rate > 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
    status procurement_status DEFAULT 'PENDING' NOT NULL,
    officer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Payments (DBT Payout Disbursal Records)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_id UUID NOT NULL UNIQUE REFERENCES public.procurements(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    transaction_id TEXT UNIQUE,
    status payment_status DEFAULT 'PENDING' NOT NULL,
    payment_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Notifications (In-App Farmer Alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================================================
-- 3. INDEXES FOR HIGH-CONCURRENCY LOOKUPS
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_slots_centre_date ON public.slots(centre_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_id ON public.bookings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_centre_date_status ON public.bookings(centre_id, slot_date, status);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON public.bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_procurements_farmer ON public.procurements(farmer_id);
CREATE INDEX IF NOT EXISTS idx_procurements_centre ON public.procurements(centre_id);
CREATE INDEX IF NOT EXISTS idx_payments_farmer ON public.payments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_notifications_farmer ON public.notifications(farmer_id, is_read);

-- =============================================================================
-- 4. SEED DATA FOR PROCUREMENT CENTRES
-- =============================================================================

INSERT INTO public.procurement_centres (id, name, location, address, daily_capacity)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Krishi Upaj Mandi - Sector 7', 'Karnal, Haryana', 'GT Road, Near Grain Yard, Sector 7', 60),
    ('a0000000-0000-0000-0000-000000000002', 'Anaaj Mandi - Main Hub', 'Ludhiana, Punjab', 'Gill Road, Mandi Complex', 80),
    ('a0000000-0000-0000-0000-000000000003', 'Kisan Samridhi Center', 'Khargone, Madhya Pradesh', 'Bypass Road, Krishi Upaj', 50),
    ('a0000000-0000-0000-0000-000000000004', 'Rajya Krishi Mandi - Meerut Bypass', 'Meerut, Uttar Pradesh', 'NH-58 Bypass, Grain Market', 70)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    address = EXCLUDED.address,
    daily_capacity = EXCLUDED.daily_capacity;
