-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Phase 5: Cryptographic QR Gate Verification & Replay Prevention RPC
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_and_admit_qr(
    p_booking_id UUID,
    p_centre_id UUID,
    p_token_number TEXT,
    p_slot_date DATE,
    p_signature TEXT,
    p_secret_key TEXT DEFAULT 'KISSAN_MANDI_SECRET_2026'
)
RETURNS JSONB AS $$
DECLARE
    v_officer_id UUID := auth.uid();
    v_officer_role user_role;
    v_officer_centre UUID;
    v_expected_sig TEXT;
    v_booking RECORD;
    v_farmer_name TEXT;
BEGIN
    -- 1. Officer Auth & Authorization Check
    IF v_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Mandi officer authentication required.');
    END IF;

    SELECT role, assigned_centre_id INTO v_officer_role, v_officer_centre
    FROM public.profiles
    WHERE id = v_officer_id;

    IF v_officer_role NOT IN ('OFFICER', 'ADMIN') THEN
        RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'error', 'Only authorized Mandi Officers can scan gate passes.');
    END IF;

    -- If officer is assigned to a specific centre, enforce centre matching
    IF v_officer_role = 'OFFICER' AND v_officer_centre IS NOT NULL AND v_officer_centre != p_centre_id THEN
        RETURN jsonb_build_object('success', false, 'code', 'WRONG_CENTRE', 'error', 'This booking belongs to another procurement centre.');
    END IF;

    -- 2. Cryptographic Signature Verification (HMAC-SHA256)
    v_expected_sig := encode(
        hmac(
            p_booking_id::TEXT || ':' || p_token_number || ':' || p_centre_id::TEXT || ':' || p_slot_date::TEXT, 
            p_secret_key, 
            'sha256'
        ), 
        'hex'
    );

    IF v_expected_sig != p_signature THEN
        RETURN jsonb_build_object('success', false, 'code', 'TAMPERED_QR', 'error', 'Cryptographic signature mismatch. Gate pass QR has been altered or forged.');
    END IF;

    -- 3. Lock Booking Row FOR UPDATE
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'error', 'Booking record not found in system database.');
    END IF;

    -- 4. Check Status & Replay Prevention
    IF v_booking.status = 'CANCELLED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'CANCELLED_BOOKING', 'error', 'This slot booking has been cancelled by the farmer.');
    END IF;

    IF v_booking.status = 'IN_PROGRESS' OR v_booking.status = 'COMPLETED' THEN
        RETURN jsonb_build_object('success', false, 'code', 'REPLAY_ATTEMPT', 'error', 'Replay Prevention: Token ' || v_booking.token_number || ' has already been admitted at Mandi Gate.');
    END IF;

    -- 5. Atomically Mark Booking as Admitted (IN_PROGRESS)
    UPDATE public.bookings
    SET status = 'IN_PROGRESS',
        admitted_at = NOW()
    WHERE id = p_booking_id;

    -- Fetch farmer name for response display
    SELECT full_name INTO v_farmer_name FROM public.profiles WHERE id = v_booking.farmer_id;

    -- Send notification to farmer
    INSERT INTO public.notifications (farmer_id, title, message)
    VALUES (
        v_booking.farmer_id,
        'Gate Verification Passed',
        'Token ' || v_booking.token_number || ' verified at Mandi Gate. Proceed to Weighbridge Bay.'
    );

    -- 6. Return Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking.id,
        'token_number', v_booking.token_number,
        'farmer_name', COALESCE(v_farmer_name, 'Farmer'),
        'crop', v_booking.crop,
        'quantity', v_booking.quantity,
        'vehicle_number', v_booking.vehicle_number,
        'vehicle_type', v_booking.vehicle_type,
        'admitted_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
