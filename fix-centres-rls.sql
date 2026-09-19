-- =============================================================================
-- KISSAN: Allow Procurement Centres CRUD in Development
-- Run this in your Supabase SQL Editor if you encounter RLS policy errors on insert
-- =============================================================================

-- 1. Ensure procurement_centres table has correct columns
CREATE TABLE IF NOT EXISTS public.procurement_centres (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    address TEXT NOT NULL,
    daily_capacity INT DEFAULT 50 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.procurement_centres ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Anyone can view procurement centres" ON public.procurement_centres;
DROP POLICY IF EXISTS "Admins can manage procurement centres" ON public.procurement_centres;
DROP POLICY IF EXISTS "Public dev management of procurement centres" ON public.procurement_centres;

-- 4. Create development policy allowing full access for testing
CREATE POLICY "Public dev management of procurement centres"
    ON public.procurement_centres FOR ALL
    USING (true)
    WITH CHECK (true);

-- 5. Ensure slots table has correct columns
CREATE TABLE IF NOT EXISTS public.slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    centre_id UUID REFERENCES public.procurement_centres(id) ON DELETE CASCADE,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INT DEFAULT 25 NOT NULL,
    booked_count INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. Enable RLS on slots
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;

-- 7. Development policy for slots table
DROP POLICY IF EXISTS "Public dev management of slots" ON public.slots;
CREATE POLICY "Public dev management of slots"
    ON public.slots FOR ALL
    USING (true)
    WITH CHECK (true);

-- 8. Ensure bookings table has correct columns
CREATE TABLE IF NOT EXISTS public.bookings (
    id TEXT PRIMARY KEY,
    farmer_id TEXT,
    farmer_name TEXT,
    farmer_phone TEXT,
    centre_id UUID REFERENCES public.procurement_centres(id) ON DELETE SET NULL,
    mandi_name TEXT,
    slot_id UUID REFERENCES public.slots(id) ON DELETE SET NULL,
    token_number TEXT NOT NULL,
    crop TEXT,
    quantity NUMERIC(10, 2),
    slot_date DATE,
    slot_time TEXT,
    vehicle_type TEXT,
    vehicle_number TEXT,
    status TEXT DEFAULT 'WAITING' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 10. Development policy for bookings table
DROP POLICY IF EXISTS "Anyone can view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Farmers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public dev management of bookings" ON public.bookings;

CREATE POLICY "Public dev management of bookings"
    ON public.bookings FOR ALL
    USING (true)
    WITH CHECK (true);

-- 11. Ensure procurements table has correct columns
CREATE TABLE IF NOT EXISTS public.procurements (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
    farmer_id TEXT,
    farmer_name TEXT,
    farmer_phone TEXT,
    centre_name TEXT,
    crop TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    quality TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'PENDING' NOT NULL,
    payment_status TEXT DEFAULT 'Direct DBT Initiated',
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. Enable RLS on procurements
ALTER TABLE public.procurements ENABLE ROW LEVEL SECURITY;

-- 13. Development policy for procurements table
DROP POLICY IF EXISTS "Public dev management of procurements" ON public.procurements;
CREATE POLICY "Public dev management of procurements"
    ON public.procurements FOR ALL
    USING (true)
    WITH CHECK (true);

-- 14. Ensure payments table has correct columns
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    farmer_id TEXT,
    farmer_name TEXT,
    farmer_phone TEXT,
    procurement_id TEXT REFERENCES public.procurements(id) ON DELETE CASCADE,
    crop TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    transaction_id TEXT,
    status TEXT DEFAULT 'PENDING' NOT NULL,
    payment_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 15. Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 16. Development policy for payments table
DROP POLICY IF EXISTS "Public dev management of payments" ON public.payments;
CREATE POLICY "Public dev management of payments"
    ON public.payments FOR ALL
    USING (true)
    WITH CHECK (true);

-- 17. Ensure notifications table has correct columns
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    farmer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 18. Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 19. Development policy for notifications table
DROP POLICY IF EXISTS "Public dev management of notifications" ON public.notifications;
CREATE POLICY "Public dev management of notifications"
    ON public.notifications FOR ALL
    USING (true)
    WITH CHECK (true);
