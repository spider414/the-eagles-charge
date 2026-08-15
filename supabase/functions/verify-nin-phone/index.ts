import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const intl = '234' + phone.slice(1);
    // The provider is picky about the field name / phone format, so try the
    // documented variants before giving up.
    const variants: Record<string, unknown>[] = [
      { phone_number: phone },
      { number: phone },
      { phone: phone },
      { phone_number: intl },
      { number: intl },
    ];

    let res: Response | null = null;
    let text = '';
    let payload: any = null;

    for (const v of variants) {
      res = await fetch(`${API_BASE}/nin-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ ...v, consent: true }),
      });
      text = await res.text();
      payload = null;
      try { payload = JSON.parse(text); } catch { /* non-JSON */ }
      if (res.ok && payload?.status === 'success' && payload?.data) break;
      console.error('NIN lookup attempt failed', JSON.stringify(v), res.status, text.slice(0, 300));
      // Auth/credit problems won't be fixed by another variant.
      if (res.status === 401 || res.status === 402 || res.status === 403) break;
    }

    if (!res || !res.ok || !payload || payload.status !== 'success' || !payload.data) {
      return json(
        {
          success: false,
          error:
            res && (res.status === 401 || res.status === 402 || res.status === 403)
              ? 'NIN verification service is unavailable right now. Please continue and verify later.'
              : 'No NIN record is linked to this phone number. Please check the number or try another one.',
        },
        200,
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
