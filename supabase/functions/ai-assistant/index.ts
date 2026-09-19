import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2.39.0";

/**
 * ==============================================================================
 * KISSAN – Procure Smart Mandi
 * Authenticated Context-Aware AI Assistant (Supabase Edge Function)
 * Exclusively using Google Gemini API (Free Tier)
 * ==============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Please send a POST request." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    let body: { message?: string; selectedLang?: string };
    try {
      body = await req.json();
    } catch (_parseErr) {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = body?.message?.trim();
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Validation error: 'message' string field is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = body.selectedLang || "hi-IN";
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Configuration error: GEMINI_API_KEY is not set on backend." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user from Supabase JWT Header
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://fqxsbrflcmtfhyieeyep.supabase.co";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_imFTIfne54wwVXSLXb25MQ_m-3HsfFc";

    let farmerContextText = "User context: Default Authenticated Farmer Rameshwar Singh (F-10024).";

    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } }
        });

        const { data: { user }, error: userErr } = await supabase.auth.getUser();

        if (user && !userErr) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, mobile, role")
            .eq("id", user.id)
            .maybeSingle();

          const { data: bookings } = await supabase
            .from("bookings")
            .select("token_number, slot_date, slot_time, crop, quantity, status, vehicle_number")
            .eq("farmer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: procurements } = await supabase
            .from("procurements")
            .select("crop, net_weight, quality_grade, total_amount, status")
            .eq("farmer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: payments } = await supabase
            .from("payments")
            .select("amount, status, transaction_id, payment_date")
            .eq("farmer_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const activeB = bookings && bookings[0] ? bookings[0] : null;
          const activeP = procurements && procurements[0] ? procurements[0] : null;
          const activePay = payments && payments[0] ? payments[0] : null;

          farmerContextText = `
AUTHENTICATED FARMER LIVE CONTEXT (STRICT FACTUAL SOURCE OF TRUTH):
- Farmer Name: ${profile?.full_name || 'Farmer'} (${user.email})
- Active Slot Booking: ${activeB ? `Token: ${activeB.token_number}, Crop: ${activeB.crop}, Quantity: ${activeB.quantity} Qtl, Date: ${activeB.slot_date}, Shift: ${activeB.slot_time}, Status: ${activeB.status}` : 'No active slot booking scheduled.'}
- Recent Procurement Record: ${activeP ? `Net Weight: ${activeP.net_weight} Qtl ${activeP.crop}, Grade: ${activeP.quality_grade}, Settlement Amount: ₹${activeP.total_amount}, Status: ${activeP.status}` : 'No procurement weighment recorded yet.'}
- Recent DBT Payment Disbursal: ${activePay ? `Amount: ₹${activePay.amount}, Status: ${activePay.status}, Txn Reference: ${activePay.transaction_id || 'Pending'}` : 'No payment disbursal pending.'}
`;
        }
      } catch (authErr) {
        console.warn("Notice reading farmer context:", authErr);
      }
    }

    // Google Gemini 1.5 Flash System Instruction
    const systemPrompt = `You are the official KISSAN Mandi AI Assistant for the Department of Consumer Affairs (DoCA), Govt of India.
You assist Indian farmers with mandi slot bookings, token status, MSP rates, weighment slips, and Direct Benefit Transfer (DBT) payments.

OFFICIAL 2026-27 MSP RATES:
- Wheat: ₹2,275/Quintal
- Paddy (Grade A): ₹2,203/Quintal
- Mustard: ₹5,650/Quintal
- Cotton: ₹6,620/Quintal
- Gram (Chana): ₹5,440/Quintal
- Maize: ₹2,090/Quintal

${farmerContextText}

RULES:
1. Always base answers regarding token numbers, booking status, procurement amounts, and payment references STRICTLY on the AUTHENTICATED FARMER LIVE CONTEXT above.
2. Never hallucinate fake token numbers or fake bank transactions.
3. Keep responses concise (3-4 sentences maximum).
4. Answer fluently in ${lang === "hi-IN" ? "Hindi (हिन्दी)" : (lang === "pa-IN" ? "Punjabi (ਪੰਜਾਬੀ)" : "English")}.`;

    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(geminiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiRes.json();
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to process query.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
