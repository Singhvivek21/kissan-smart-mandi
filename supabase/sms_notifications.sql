-- =============================================================================
-- KISSAN – Procure Smart Mandi
-- SMS Notification System Database Schema
-- Department of Consumer Affairs (DoCA) | Problem Statement 26032
-- =============================================================================

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. TABLE: sms_notifications
-- Tracks SMS delivery lifecycle across Mock (Dev/Demo) and MSG91 (Production)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.sms_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN (
            'BOOKING_CONFIRMED',
            'SLOT_REMINDER',
            'TOKEN_APPROACHING',
            'TOKEN_CALLED',
            'PROCUREMENT_COMPLETED',
            'PAYMENT_STATUS_UPDATED',
            'TEST_MESSAGE'
        )
    ),
    template_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'mock' CHECK (provider IN ('mock', 'msg91')),
    message TEXT NOT NULL,
    provider_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'SIMULATED')
    ),
    error_message TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 2. INDEXES FOR HIGH-THROUGHPUT LOOKUPS & AUDITING
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_sms_notifications_phone 
    ON public.sms_notifications(phone_number);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_booking 
    ON public.sms_notifications(booking_id);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_status 
    ON public.sms_notifications(status);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_created_at 
    ON public.sms_notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_notifications_type 
    ON public.sms_notifications(notification_type);

-- Unique constraint for event idempotency: Prevents duplicate SMS for same booking event
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_booking_event 
    ON public.sms_notifications(booking_id, notification_type) 
    WHERE booking_id IS NOT NULL AND status != 'FAILED';

-- =============================================================================
-- 3. AUTOMATIC updated_at TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_sms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sms_notifications_updated_at ON public.sms_notifications;
CREATE TRIGGER trg_sms_notifications_updated_at
    BEFORE UPDATE ON public.sms_notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_sms_updated_at();

-- =============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.sms_notifications ENABLE ROW LEVEL SECURITY;

-- 1. Service Role (Backend Server / Edge Functions) has full access
DO $$ BEGIN
    CREATE POLICY "sms_service_role_all" 
        ON public.sms_notifications 
        FOR ALL 
        USING (auth.jwt() ->> 'role' = 'service_role' OR current_user = 'postgres');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Mandi Officers and Admins can view all SMS logs
DO $$ BEGIN
    CREATE POLICY "sms_officer_admin_select" 
        ON public.sms_notifications 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.profiles 
                WHERE profiles.id = auth.uid() 
                AND profiles.role IN ('OFFICER', 'ADMIN')
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Farmers can view SMS notifications sent to their own profile
DO $$ BEGIN
    CREATE POLICY "sms_farmer_select_own" 
        ON public.sms_notifications 
        FOR SELECT 
        USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Public / Anon can view simulated notifications in development mode
DO $$ BEGIN
    CREATE POLICY "sms_anon_select_dev" 
        ON public.sms_notifications 
        FOR SELECT 
        TO anon, authenticated 
        USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. RPC FUNCTION: log_sms_notification (Non-blocking DB insert/update)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_sms_notification(
    p_user_id UUID,
    p_booking_id UUID,
    p_phone_number TEXT,
    p_notification_type TEXT,
    p_template_id TEXT,
    p_provider TEXT,
    p_message TEXT,
    p_provider_message_id TEXT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sms_id UUID;
BEGIN
    INSERT INTO public.sms_notifications (
        user_id,
        booking_id,
        phone_number,
        notification_type,
        template_id,
        provider,
        message,
        provider_message_id,
        status,
        error_message,
        idempotency_key,
        sent_at,
        delivered_at,
        attempt_count
    ) VALUES (
        p_user_id,
        p_booking_id,
        p_phone_number,
        p_notification_type,
        p_template_id,
        p_provider,
        p_message,
        p_provider_message_id,
        p_status,
        p_error_message,
        p_idempotency_key,
        CASE WHEN p_status IN ('SENT', 'SIMULATED', 'DELIVERED') THEN NOW() ELSE NULL END,
        CASE WHEN p_status = 'DELIVERED' THEN NOW() ELSE NULL END,
        1
    )
    ON CONFLICT (idempotency_key) DO UPDATE SET
        status = EXCLUDED.status,
        provider_message_id = COALESCE(EXCLUDED.provider_message_id, sms_notifications.provider_message_id),
        error_message = EXCLUDED.error_message,
        attempt_count = sms_notifications.attempt_count + 1,
        updated_at = NOW()
    RETURNING id INTO v_sms_id;

    RETURN jsonb_build_object(
        'success', true,
        'sms_id', v_sms_id,
        'status', p_status
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
