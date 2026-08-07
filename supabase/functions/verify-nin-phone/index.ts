import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const API_BASE = 'https://checkmyninbvn.com.ng/api';

function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) return digits;
  if (digits.length === 13 && digits.startsWith('234')) return '0' + digits.slice(3);
  if (digits.length === 10) return '0' + digits;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('CHECKMYNINBVN_API_KEY');
    if (!apiKey) return json({ error: 'NIN verification is not configured' }, 500);

    const body = await req.json().catch(() => ({}));
    const phone = normalizePhone(body?.phone_number ?? body?.phone ?? '');
    if (!phone) return json({ error: 'A valid Nigerian phone number is required' }, 400);

    const res = await fetch(`${API_BASE}/nin-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({ phone, consent: true }),
    });

    const text = await res.text();
    let payload: any = null;
    try { payload = JSON.parse(text); } catch { /* non-JSON */ }

    if (!res.ok || !payload || payload.status !== 'success' || !payload.data) {
      console.error('NIN lookup failed', res.status, text.slice(0, 400));
      return json(
        { error: payload?.message || 'No NIN record found for this phone number' },
        res.status === 401 || res.status === 402 ? 500 : 400,
      );
    }

    const d = payload.data;
    const fullName = [d.firstname, d.middlename, d.surname]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return json({
      success: true,
      data: {
        nin: d.nin,
        full_name: fullName,
        phone_number: d.telephoneno ?? phone,
        gender: d.gender ?? null,
        birthdate: d.birthdate ?? null,
        photo: d.photo ?? null,
      },
    });
  } catch (err) {
    console.error('verify-nin-phone error', err);
    return json({ error: 'Failed to verify NIN. Please try again.' }, 500);
  }
});
