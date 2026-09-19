/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * Supabase Edge Function: send-sms (supabase/functions/send-sms/index.ts)
 * ==============================================================================
 * 
 * Supports:
 * - SMS_MODE = 'mock' (default, zero-cost hackathon/dev mode)
 * - SMS_MODE = 'msg91' (production mode with MSG91 API & DLT)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

// Standard DLT Templates
const TEMPLATES: Record<string, { id: string; template: string }> = {
  BOOKING_CONFIRMED: {
    id: "1107168000000001",
    template: "Dear {farmer_name}, your procurement slot for {crop} ({quantity} Qtl) is CONFIRMED at {centre_name} on {slot_date} ({slot_time}). Your Token is {token_number}. — KISSAN Mandi"
  },
  SLOT_REMINDER: {
    id: "1107168000000002",
    template: "Reminder: Dear {farmer_name}, your mandi arrival slot is scheduled for today at {slot_time} at {centre_name}. Token: {token_number}. — KISSAN Mandi"
  },
  TOKEN_APPROACHING: {
    id: "1107168000000003",
    template: "Notice: Dear {farmer_name}, your Token {token_number} is approaching turn ({tokens_ahead} vehicles ahead) at {centre_name}. Please proceed to Entry Gate. — KISSAN Mandi"
  },
  TOKEN_CALLED: {
    id: "1107168000000004",
    template: "URGENT: Dear {farmer_name}, Token {token_number} is CALLED NOW to Bay / Weighbridge at {centre_name}. Please move your vehicle immediately. — KISSAN Mandi"
  },
  PROCUREMENT_COMPLETED: {
    id: "1107168000000005",
    template: "Receipt: Dear {farmer_name}, procurement of {quantity} Qtl {crop} completed at {centre_name}. Amount: Rs {amount}. J-Form #{receipt_id} generated. — KISSAN Mandi"
  },
  PAYMENT_STATUS_UPDATED: {
    id: "1107168000000006",
    template: "Payment: Dear {farmer_name}, DBT payment of Rs {amount} for J-Form #{receipt_id} has been PROCESSED. Ref: {transaction_id}. Disbursed via PFMS. — KISSAN Mandi"
  },
  TEST_MESSAGE: {
    id: "1107168000000007",
    template: "KISSAN Mandi Gateway Test: Dear {farmer_name}, test notification verified for phone {phone_number}. Status: OK. — KISSAN Mandi"
  }
};

function normalizePhone(phone: string): string {
  if (!phone) return "";
  const clean = phone.replace(/[\s\-\(\)\+]/g, "");
  if (clean.length === 12 && clean.startsWith("91")) return clean.substring(2);
  if (clean.length === 11 && clean.startsWith("0")) return clean.substring(1);
  return clean;
}

function maskPhone(phone: string): string {
  const norm = normalizePhone(phone);
  if (!norm || norm.length < 10) return "**********";
  return `${norm.substring(0, 5)}*****`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      notificationType,
      phoneNumber,
      farmerName = "Farmer",
      bookingId = null,
      userId = null,
      variables = {},
      forceResend = false
    } = body;

    const smsMode = (Deno.env.get("SMS_MODE") || "mock").toLowerCase();
    const normalized = normalizePhone(phoneNumber);

    // Validate phone
    if (!/^[6-9]\d{9}$/.test(normalized)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid Indian mobile number: "${phoneNumber}". Expected 10 digits.`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const tplConfig = TEMPLATES[notificationType];
    if (!tplConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Unsupported notificationType: ${notificationType}`
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Compile message
    let compiled = tplConfig.template;
    const mergedVars = { farmer_name: farmerName, phone_number: normalized, ...variables };
    for (const [k, v] of Object.entries(mergedVars)) {
      compiled = compiled.replace(new RegExp(`\\{${k}\\}`, "g"), String(v || "--"));
    }

    const idempotencyKey = bookingId && notificationType ? `IDEMP_${bookingId}_${notificationType}` : null;

    // Connect to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Idempotency check
    if (idempotencyKey && !forceResend) {
      const { data: existing } = await supabase
        .from("sms_notifications")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existing && ["SENT", "SIMULATED", "DELIVERED"].includes(existing.status)) {
        return new Response(JSON.stringify({
          success: true,
          duplicatePrevented: true,
          notification: existing
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    let status = "SIMULATED";
    let providerMessageId = `MOCK-SMS-${Date.now().toString(36).toUpperCase()}`;
    let errorMessage = null;

    if (smsMode === "msg91") {
      const authKey = Deno.env.get("MSG91_AUTH_KEY");
      const senderId = Deno.env.get("MSG91_SENDER_ID") || "KSMAND";
      const entityId = Deno.env.get("MSG91_DLT_ENTITY_ID") || "";

      if (!authKey) {
        status = "FAILED";
        errorMessage = "MSG91_AUTH_KEY is not configured in server environment";
      } else {
        try {
          const res = await fetch("https://control.msg91.com/api/v5/flow/", {
            method: "POST",
            headers: {
              "authkey": authKey,
              "content-type": "application/json",
              "accept": "application/json"
            },
            body: JSON.stringify({
              template_id: tplConfig.id,
              sender: senderId,
              short_url: "0",
              dlt_pe_id: entityId || undefined,
              recipients: [{ mobiles: `91${normalized}`, ...mergedVars }]
            })
          });
          const json = await res.json();
          if (json.type === "success" || json.message_id) {
            status = "SENT";
            providerMessageId = json.message_id || `MSG91-${Date.now()}`;
          } else {
            status = "FAILED";
            errorMessage = json.message || "MSG91 API error";
          }
        } catch (e) {
          status = "FAILED";
          errorMessage = (e as Error).message;
        }
      }
    }

    // Insert record in sms_notifications table
    const record = {
      phone_number: normalized,
      notification_type: notificationType,
      template_id: tplConfig.id,
      provider: smsMode,
      message: compiled,
      provider_message_id: providerMessageId,
      status: status,
      error_message: errorMessage,
      attempt_count: 1,
      idempotency_key: idempotencyKey,
      sent_at: status !== "FAILED" ? new Date().toISOString() : null,
      delivered_at: status === "SIMULATED" ? new Date().toISOString() : null
    };

    const { data: inserted, error: dbError } = await supabase
      .from("sms_notifications")
      .insert(record)
      .select()
      .maybeSingle();

    return new Response(JSON.stringify({
      success: status !== "FAILED",
      mode: smsMode,
      notification: inserted || record,
      maskedPhone: maskPhone(normalized),
      note: smsMode === "mock" ? "SMS simulated — development mode" : "Dispatched via MSG91"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: (err as Error).message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
