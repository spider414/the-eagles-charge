import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation constants
const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 10000;
const VALID_ROLES = ["user", "assistant", "system"];

interface ChatMessage {
  role: string;
  content: string;
}

// Validate message structure and content
function validateMessages(messages: unknown): { valid: boolean; error?: string } {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "Invalid messages format - must be a non-empty array" };
  }

  if (messages.length > MAX_MESSAGES) {
    return { valid: false, error: `Message history too long (max ${MAX_MESSAGES} messages)` };
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    
    if (!msg || typeof msg !== "object") {
      return { valid: false, error: `Invalid message structure at index ${i}` };
    }

    const message = msg as ChatMessage;

    if (!message.role || typeof message.role !== "string") {
      return { valid: false, error: `Missing or invalid role at index ${i}` };
    }

    if (!VALID_ROLES.includes(message.role)) {
      return { valid: false, error: `Invalid message role "${message.role}" at index ${i}` };
    }

    if (!message.content || typeof message.content !== "string") {
      return { valid: false, error: `Missing or invalid content at index ${i}` };
    }

    if (message.content.length > MAX_MESSAGE_LENGTH) {
      return { valid: false, error: `Message too long at index ${i} (max ${MAX_MESSAGE_LENGTH} chars)` };
    }
  }

  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support chat is public: signed-in users are identified, guests are allowed too.
    // Parse and validate request body
    let body: { messages: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { messages } = body;

    // Validate messages array
    const validation = validateMessages(messages);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validatedMessages = messages as ChatMessage[];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Harry, the friendly AI support assistant for HARMIC RECHARGE app. You help users understand how to use the app and answer their questions.

About HARMIC RECHARGE App:
- HARMIC RECHARGE is a VTU (Virtual Top-Up) platform for buying airtime, data, paying bills, and more
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
- Email: harmicrecharge@harmicglobal.com
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
          ...validatedMessages,
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
    return new Response(JSON.stringify({ error: "An error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
