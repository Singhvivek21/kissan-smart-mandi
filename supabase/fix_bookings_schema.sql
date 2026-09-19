-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Migration: Fix and Expand public.bookings Schema with Full Column Support
-- Problem Statement ID: 26032
-- =============================================================================

-- 1. Safely add missing columns to public.bookings if they don't already exist
DO $$ 
BEGIN
    -- Crop produce name (e.g. 'Wheat (गेहूं)', 'Mustard (सरसों)')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'crop') THEN
        ALTER TABLE public.bookings ADD COLUMN crop TEXT DEFAULT 'Produce';
    END IF;

    -- Quantity in Quintals
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'quantity') THEN
        ALTER TABLE public.bookings ADD COLUMN quantity NUMERIC(10, 2) DEFAULT 40.0;
    END IF;

    -- Slot Date (e.g. '2026-09-19')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slot_date') THEN
        ALTER TABLE public.bookings ADD COLUMN slot_date DATE DEFAULT CURRENT_DATE;
    END IF;

    -- Slot Time window (e.g. '08:00 AM - 11:00 AM')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'slot_time') THEN
        ALTER TABLE public.bookings ADD COLUMN slot_time TEXT DEFAULT '08:00 AM - 11:00 AM';
    END IF;

    -- Vehicle Type (e.g. 'Tractor Trolley', 'Mini Truck')
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'vehicle_type') THEN
        ALTER TABLE public.bookings ADD COLUMN vehicle_type TEXT DEFAULT 'Tractor Trolley';
    END IF;

    -- Vehicle Registration Number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'vehicle_number') THEN
        ALTER TABLE public.bookings ADD COLUMN vehicle_number TEXT DEFAULT 'HR-05-AB-7721';
    END IF;

    -- Farmer Full Name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'farmer_name') THEN
        ALTER TABLE public.bookings ADD COLUMN farmer_name TEXT DEFAULT 'Farmer';
    END IF;

    -- Farmer Phone Number (for lookup and SMS alerts)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'farmer_phone') THEN
        ALTER TABLE public.bookings ADD COLUMN farmer_phone TEXT DEFAULT '9876543210';
    END IF;

    -- Mandi Centre Name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'mandi_name') THEN
        ALTER TABLE public.bookings ADD COLUMN mandi_name TEXT DEFAULT 'Krishi Upaj Mandi, Sector 7, Karnal';
    END IF;

    -- Token Sequence number for queue ordering
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'token_sequence') THEN
        ALTER TABLE public.bookings ADD COLUMN token_sequence INT DEFAULT 1;
    END IF;

    -- Cryptographic QR signature
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'qr_signature') THEN
        ALTER TABLE public.bookings ADD COLUMN qr_signature TEXT DEFAULT 'HMAC_SECURE_QR_SIG';
    END IF;

    -- Cancellation reason if cancelled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'cancel_reason') THEN
        ALTER TABLE public.bookings ADD COLUMN cancel_reason TEXT;
    END IF;
END $$;

-- 2. Create performance indexes for real-time lookups
CREATE INDEX IF NOT EXISTS idx_bookings_farmer_phone ON public.bookings(farmer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_date ON public.bookings(slot_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- 3. Configure Row Level Security (RLS) policies allowing application reads and inserts
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow public read access to bookings" ON public.bookings;
    CREATE POLICY "Allow public read access to bookings"
        ON public.bookings FOR SELECT
        USING (true);
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow public insert to bookings" ON public.bookings;
    CREATE POLICY "Allow public insert to bookings"
        ON public.bookings FOR INSERT
        WITH CHECK (true);
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Allow public update to bookings" ON public.bookings;
    CREATE POLICY "Allow public update to bookings"
        ON public.bookings FOR UPDATE
        USING (true);
EXCEPTION WHEN undefined_object THEN NULL; END $$;
