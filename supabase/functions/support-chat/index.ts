import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Harry, the friendly AI support assistant for THE EAGLES VTU app. You help users understand how to use the app and answer their questions.

About THE EAGLES VTU App:
- THE EAGLES is a VTU (Virtual Top-Up) platform for buying airtime, data, paying bills, and more
- Users can top up their wallet via bank transfer to their dedicated virtual account or by card payment
- Available services include: Airtime purchase, Data bundles, Electricity bills, Cable TV subscriptions, Internet subscriptions
- Transactions are usually instant, but may take up to 5 minutes in rare cases
- Failed transactions are automatically refunded to the wallet within minutes
- Users can save favorite phone numbers for quick recharge
- The app supports MTN, Glo, Airtel, and 9mobile networks

Key Features:
1. Wallet System - Users can fund their wallet and use it for purchases
2. Virtual Account - Each user gets a dedicated bank account for easy deposits
3. Transaction History - Users can view all their past transactions
4. Referral Program - Users can earn rewards by referring friends
5. Favorites - Save frequently used phone numbers for quick access

Support Contacts:
- Email: henry4god99@gmail.com or harrisonokeke91@gmail.com
- Phone/WhatsApp: +35677980822

Always be helpful, friendly, and professional. If you don't know something specific, suggest the user contact support via email or WhatsApp for further assistance.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
