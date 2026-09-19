-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Phase 4: Atomic Slot Booking & Token Allocation RPC
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

CREATE OR REPLACE FUNCTION public.book_slot(
    p_centre_id UUID,
    p_slot_id UUID,
    p_crop TEXT,
    p_quantity NUMERIC,
    p_slot_date DATE,
    p_slot_time TEXT,
    p_vehicle_type TEXT,
    p_vehicle_number TEXT,
    p_secret_key TEXT DEFAULT 'KISSAN_MANDI_SECRET_2026'
)
RETURNS JSONB AS $$
DECLARE
    v_farmer_id UUID := auth.uid();
    v_slot_record RECORD;
    v_next_seq INT;
    v_token_number TEXT;
    v_qr_sig TEXT;
    v_booking_id UUID := gen_random_uuid();
    v_centre_name TEXT;
BEGIN
    -- 1. Authentication Check
    IF v_farmer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required to book a slot.');
    END IF;

    -- 2. Validate produce quantity
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid produce quantity.');
    END IF;

    -- 3. Lock target slot row for UPDATE to guarantee concurrency isolation
    SELECT * INTO v_slot_record
    FROM public.slots
    WHERE id = p_slot_id AND centre_id = p_centre_id AND slot_date = p_slot_date
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Selected procurement slot does not exist.');
    END IF;

    -- 4. Check capacity limit
    IF v_slot_record.booked_count >= v_slot_record.capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'Selected slot is fully booked. Please choose another shift window.');
    END IF;

    -- 5. Duplicate Booking Check (Farmer cannot double-book same slot)
    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE farmer_id = v_farmer_id 
          AND slot_id = p_slot_id 
          AND status != 'CANCELLED'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have an active booking for this slot.');
    END IF;

    -- 6. Lock centre row and calculate sequential token number for centre + date
    SELECT COALESCE(MAX(token_sequence), 0) + 1 INTO v_next_seq
    FROM public.bookings
    WHERE centre_id = p_centre_id AND slot_date = p_slot_date;

    v_token_number := 'KMN-' || LPAD(v_next_seq::TEXT, 3, '0');

    -- 7. Generate Cryptographic QR Signature (HMAC-SHA256)
    v_qr_sig := encode(
        hmac(
            v_booking_id::TEXT || ':' || v_token_number || ':' || p_centre_id::TEXT || ':' || p_slot_date::TEXT, 
            p_secret_key, 
            'sha256'
        ), 
        'hex'
    );

    -- 8. Fetch centre name for notification
    SELECT name INTO v_centre_name FROM public.procurement_centres WHERE id = p_centre_id;

    -- 9. Insert Booking Record
    INSERT INTO public.bookings (
        id, farmer_id, centre_id, slot_id, token_number, token_sequence,
        crop, quantity, slot_date, slot_time, vehicle_type, vehicle_number, qr_signature, status
    ) VALUES (
        v_booking_id, v_farmer_id, p_centre_id, p_slot_id, v_token_number, v_next_seq,
        p_crop, p_quantity, p_slot_date, p_slot_time, p_vehicle_type, p_vehicle_number, v_qr_sig, 'WAITING'
    );

    -- 10. Increment Slot Booked Count
    UPDATE public.slots
    SET booked_count = booked_count + 1
    WHERE id = p_slot_id;

    -- 11. Create In-App Farmer Notification
    INSERT INTO public.notifications (farmer_id, title, message)
    VALUES (
        v_farmer_id, 
        'Slot Booking Confirmed', 
        'Your procurement slot for ' || p_crop || ' (' || p_quantity::TEXT || ' Qtl) on ' || p_slot_date::TEXT || ' at ' || COALESCE(v_centre_name, 'Mandi') || ' is confirmed. Token: ' || v_token_number || '.'
    );

    -- 12. Return Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'booking_id', v_booking_id,
        'token_number', v_token_number,
        'token_sequence', v_next_seq,
        'qr_signature', v_qr_sig,
        'status', 'WAITING',
        'centre_name', v_centre_name,
        'slot_date', p_slot_date,
        'slot_time', p_slot_time
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_booking(
    p_booking_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_booking RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    IF v_booking.farmer_id != v_user_id AND public.get_auth_role() NOT IN ('OFFICER', 'ADMIN') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to cancel this booking.');
    END IF;

    IF v_booking.status != 'WAITING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only bookings in WAITING status can be cancelled.');
    END IF;

    -- Update booking status to CANCELLED
    UPDATE public.bookings
    SET status = 'CANCELLED'
    WHERE id = p_booking_id;

    -- Decrement slot booked_count
    UPDATE public.slots
    SET booked_count = GREATEST(0, booked_count - 1)
    WHERE id = v_booking.slot_id;

    -- Notification
    INSERT INTO public.notifications (farmer_id, title, message)
    VALUES (
        v_booking.farmer_id, 
        'Booking Cancelled', 
        'Your slot booking (Token: ' || v_booking.token_number || ') for ' || v_booking.crop || ' has been cancelled.'
    );

    RETURN jsonb_build_object('success', true, 'message', 'Booking cancelled successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
