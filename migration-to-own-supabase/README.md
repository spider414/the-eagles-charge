# Moving The Eagles Charge to your own Supabase project

Everything below is ready to run. Do the steps in order.

## 0. Important: disconnecting Lovable Cloud
Disconnecting Cloud is **irreversible** — the current database, storage, and edge
functions are permanently deleted. Export anything you still need first
(Cloud → Advanced settings → Export data). A workspace admin performs the
disconnect at **Cloud tab → Advanced → Disconnect**, then you connect your own
Supabase project from the Supabase integration.

## 1. Create / prepare your Supabase project
Enable **Email** auth. This app signs users in with phone numbers mapped to
`<number>@eagles.local`, so leave "Confirm email" **OFF** for that provider.

## 2. Run the SQL
In your project's SQL editor run, in order:
1. `01_schema.sql` — enums, tables, RLS, grants, triggers, wallet functions, avatars bucket
2. `02_seed.sql` — default email branding + templates

Then make yourself admin using the commented statement at the bottom of `02_seed.sql`
(after you have created your account in the new project).

## 3. Frontend environment variables
Set these to your new project's values (`.env` at project root):
```
VITE_SUPABASE_URL="https://<your-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<your anon/publishable key>"
VITE_SUPABASE_PROJECT_ID="<your-ref>"
```
No other frontend code changes are needed — the app only imports
`@/integrations/supabase/client`.

## 4. Edge functions
Deploy every folder in `supabase/functions/`:
```
cleanup-deleted-accounts  email-unsubscribe  get-security-question  internet-plans
paystack-payment  paystack-webhook  reset-password  send-email  send-notification
send-otp  support-chat  verify-internet  verify-meter  verify-otp  verify-smartcard
vtu-service
```
```bash
supabase link --project-ref <your-ref>
supabase functions deploy --no-verify-jwt
```
`supabase/config.toml` already lists the `verify_jwt = false` functions — update
`project_id` in it to your new ref.

## 5. Function secrets to set in the new project
`supabase secrets set NAME=value` (SUPABASE_URL / SUPABASE_ANON_KEY /
SUPABASE_SERVICE_ROLE_KEY are injected automatically):

| Secret | Used by |
|---|---|
| PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY | paystack-payment, paystack-webhook |
| CHEAPDATAHUB_API_KEY, CHEAPDATAHUB2_API_KEY | vtu-service |
| VTPASS_API_KEY, VTPASS_PUBLIC_KEY | verify-meter, verify-smartcard, verify-internet, internet-plans |
| TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER | send-otp |
| TERMII_API_KEY | send-otp fallback |
| RESEND_API_KEY | send-email |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY | send-notification (web push) |
| LOVABLE_API_KEY *(or your own AI key)* | support-chat — Lovable AI Gateway is **not** available off Cloud; swap to your own provider key |

## 6. Third-party dashboards to update
- **Paystack** webhook URL → `https://<your-ref>.supabase.co/functions/v1/paystack-webhook`
- **Resend** — keep `noreply@harmicglobal.com` verified on the new setup
- **Unsubscribe link** in emails → `https://<your-ref>.supabase.co/functions/v1/email-unsubscribe`

## 7. Data migration (existing users/wallets)
Existing `auth.users` cannot be moved by SQL alone. Either start fresh, or export
users via the Supabase Auth admin API and re-import with matching UUIDs **before**
importing `profiles` / `transactions` CSVs (FKs point at `auth.users.id`).
Import order: `auth.users` → `profiles` → `transactions` → `referral_rewards` →
`favorite_numbers` / `notifications` / `push_subscriptions` / `user_roles`.

## 8. Regenerate types
`supabase gen types typescript --linked > src/integrations/supabase/types.ts`
