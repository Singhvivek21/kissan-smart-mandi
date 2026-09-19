-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- Phase 6: Server-Authoritative Procurement & Payment Integrity RPC
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_procurement(
    p_booking_id UUID,
    p_crop TEXT,
    p_gross_weight NUMERIC,
    p_tare_weight NUMERIC,
    p_moisture NUMERIC,
    p_quality_grade TEXT,
    p_msp_rate NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_officer_id UUID := auth.uid();
    v_officer_role user_role;
    v_booking RECORD;
    v_net_weight NUMERIC;
    v_total_amount NUMERIC;
    v_procurement_id UUID := gen_random_uuid();
    v_payment_id UUID := gen_random_uuid();
BEGIN
    -- 1. Officer Auth & Role Check
    IF v_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Mandi officer authentication required.');
    END IF;

    SELECT role INTO v_officer_role FROM public.profiles WHERE id = v_officer_id;
    IF v_officer_role NOT IN ('OFFICER', 'ADMIN') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Mandi Officers can record procurements.');
    END IF;

    -- 2. Input Weight & Rate Validations
    IF p_gross_weight IS NULL OR p_gross_weight <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gross weight must be greater than 0.');
    END IF;

    IF p_tare_weight IS NULL OR p_tare_weight < 0 OR p_tare_weight >= p_gross_weight THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tare weight must be non-negative and less than gross weight.');
    END IF;

    IF p_msp_rate IS NULL OR p_msp_rate <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Valid MSP rate per quintal is required.');
    END IF;

    -- 3. Lock Booking Row FOR UPDATE
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Booking record not found.');
    END IF;

    -- 4. Idempotency Check (Prevent duplicate procurement records)
    IF EXISTS (SELECT 1 FROM public.procurements WHERE booking_id = p_booking_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Procurement entry already exists for this booking.');
    END IF;

    -- 5. Server-Authoritative Math Calculations
    v_net_weight := p_gross_weight - p_tare_weight;
    v_total_amount := ROUND((v_net_weight * p_msp_rate)::NUMERIC, 2);

    -- 6. Insert Procurement Record
    INSERT INTO public.procurements (
        id, booking_id, farmer_id, centre_id, crop,
        gross_weight, tare_weight, moisture_percentage, quality_grade,
        msp_rate, total_amount, status, officer_id
    ) VALUES (
        v_procurement_id, p_booking_id, v_booking.farmer_id, v_booking.centre_id, p_crop,
        p_gross_weight, p_tare_weight, COALESCE(p_moisture, 0.0), p_quality_grade,
        p_msp_rate, v_total_amount, 'COMPLETED', v_officer_id
    );

    -- 7. Update Booking Status to COMPLETED
    UPDATE public.bookings
    SET status = 'COMPLETED'
    WHERE id = p_booking_id;

    -- 8. Create Pending Payment Record for Direct Benefit Transfer (DBT)
    INSERT INTO public.payments (
        id, procurement_id, farmer_id, amount, status
    ) VALUES (
        v_payment_id, v_procurement_id, v_booking.farmer_id, v_total_amount, 'PENDING'
    );

    -- 9. Add Farmer Notification
    INSERT INTO public.notifications (farmer_id, title, message)
    VALUES (
        v_booking.farmer_id,
        'Procurement Form J Generated',
        'Procurement of ' || v_net_weight::TEXT || ' Qtl ' || p_crop || ' completed. Gross amount: ₹' || v_total_amount::TEXT || '. DBT payment pending disbursal.'
    );

    -- 10. Return Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'procurement_id', v_procurement_id,
        'payment_id', v_payment_id,
        'net_weight', v_net_weight,
        'total_amount', v_total_amount,
        'status', 'COMPLETED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Process DBT Payment Disbursal RPC
CREATE OR REPLACE FUNCTION public.process_dbt_payment(
    p_payment_id UUID,
    p_transaction_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_officer_id UUID := auth.uid();
    v_officer_role user_role;
    v_payment RECORD;
    v_txn_ref TEXT;
BEGIN
    IF v_officer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
    END IF;

    SELECT role INTO v_officer_role FROM public.profiles WHERE id = v_officer_id;
    IF v_officer_role NOT IN ('OFFICER', 'ADMIN') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only Officers/Admins can process DBT payments.');
    END IF;

    SELECT * INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment record not found.');
    END IF;

    IF v_payment.status = 'PAID' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment has already been marked as PAID.');
    END IF;

    v_txn_ref := COALESCE(p_transaction_id, 'KSM-DBT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTRING(v_payment.id::TEXT FROM 1 FOR 6));

    -- Update Payment Record
    UPDATE public.payments
    SET status = 'PAID',
        transaction_id = v_txn_ref,
        payment_date = NOW()
    WHERE id = p_payment_id;

    -- Add Notification
    INSERT INTO public.notifications (farmer_id, title, message)
    VALUES (
        v_payment.farmer_id,
        'Direct Benefit Transfer Disbursed',
        'Direct DBT payment of ₹' || v_payment.amount::TEXT || ' has been disbursed to your linked bank account. Ref: ' || v_txn_ref || '.'
    );

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', v_payment.id,
        'transaction_id', v_txn_ref,
        'amount', v_payment.amount,
        'status', 'PAID'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
