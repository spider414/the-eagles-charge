-- The Eagles Charge — full public schema bootstrap for a self-hosted / own Supabase project.
-- Run this in the SQL editor of YOUR Supabase project (once, in order).

create extension if not exists pgcrypto with schema extensions;

-- ============ ENUM TYPES ============
do $$ begin
  create type public.app_role as enum ('admin','moderator','user');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.network_provider as enum ('mtn','glo','airtel','9mobile');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.cable_provider as enum ('dstv','gotv','startimes');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.electricity_provider as enum ('ekedc','ikedc','aedc','phedc','kedco','ibedc','eedc','bedc','jedc','kaedco','yedc');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_status as enum ('pending','processing','completed','failed','refunded');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.transaction_type as enum ('airtime','data','electricity','cable_tv','internet','wallet_topup','verification','exam_pin');
exception when duplicate_object then null; end $$;

-- ============ SHARED FUNCTIONS ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.generate_referral_code()
returns text language plpgsql set search_path to 'public' as $$
declare code text; exists_already boolean;
begin
  loop
    code := 'EAGLE' || upper(substring(md5(random()::text) from 1 for 6));
    select exists(select 1 from profiles where referral_code = code) into exists_already;
    if not exists_already then return code; end if;
  end loop;
end; $$;

create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin new.referral_code := generate_referral_code(); return new; end; $$;

create or replace function public.set_unsubscribe_token()
returns trigger language plpgsql set search_path to 'public','extensions' as $$
begin
  if new.unsubscribe_token is null then
    new.unsubscribe_token := encode(digest(gen_random_uuid()::text || clock_timestamp()::text,'sha256'),'hex');
  end if;
  return new;
end; $$;

-- ============ PROFILES ============
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone_number text,
  wallet_balance numeric default 0.00,
  referral_code text unique,
  referred_by uuid references public.profiles(id),
  total_referral_earnings numeric default 0.00,
  paystack_customer_code text,
  dva_account_number text,
  dva_account_name text,
  dva_bank_name text,
  security_question text,
  security_answer text,
  phone_verified boolean default false,
  deletion_scheduled_at timestamptz,
  deletion_reason text,
  avatar_url text,
  payment_email_locked boolean default false,
  nin_verified boolean default false,
  nin_number text,
  nin_full_name text,
  contact_email text,
  email_marketing_opt_in boolean not null default true,
  email_promotions_opt_in boolean not null default true,
  email_product_updates_opt_in boolean not null default true,
  unsubscribe_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_balance_non_negative check (wallet_balance >= 0)
);
create index if not exists idx_profiles_deletion_scheduled on public.profiles (deletion_scheduled_at) where deletion_scheduled_at is not null;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = user_id);
create trigger on_profile_created before insert on public.profiles for each row execute function public.handle_new_profile();
create trigger profiles_set_unsubscribe_token before insert on public.profiles for each row execute function public.set_unsubscribe_token();
create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

-- ============ USER ROLES + has_role ============
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can view their own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Deny user INSERT on user_roles" on public.user_roles for insert to authenticated with check (false);
create policy "Deny user UPDATE on user_roles" on public.user_roles for update to authenticated using (false);
create policy "Deny user DELETE on user_roles" on public.user_roles for delete to authenticated using (false);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- ============ WALLET FUNCTIONS ============
create or replace function public.credit_wallet(p_profile_id uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
declare v_new_balance decimal;
begin
  update profiles set wallet_balance = wallet_balance + p_amount
  where id = p_profile_id returning wallet_balance into v_new_balance;
  return v_new_balance;
end; $$;

create or replace function public.debit_wallet(p_profile_id uuid, p_amount numeric)
returns table(success boolean, new_balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare v_balance decimal;
begin
  update profiles set wallet_balance = wallet_balance - p_amount
  where id = p_profile_id and wallet_balance >= p_amount
  returning wallet_balance into v_balance;
  if found then return query select true, v_balance;
  else return query select false, 0::decimal; end if;
end; $$;

-- ============ TRANSACTIONS ============
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type public.transaction_type not null,
  status public.transaction_status not null default 'pending',
  amount numeric not null,
  phone_number text,
  network public.network_provider,
  data_plan text,
  cable_provider public.cable_provider,
  cable_smartcard text,
  cable_plan text,
  electricity_provider public.electricity_provider,
  meter_number text,
  meter_type text,
  token text,
  paystack_reference text unique,
  paystack_access_code text,
  api_response jsonb,
  balance_before numeric,
  balance_after numeric,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "Users can view their transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Users can insert transactions" on public.transactions for insert with check (auth.uid() = user_id);
create policy "Users can update their transactions" on public.transactions for update using (auth.uid() = user_id);
create trigger update_transactions_updated_at before update on public.transactions for each row execute function public.update_updated_at_column();

-- ============ REFERRAL REWARDS ============
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  reward_amount numeric not null,
  transaction_id uuid references public.transactions(id),
  created_at timestamptz not null default now()
);
grant select on public.referral_rewards to authenticated;
grant all on public.referral_rewards to service_role;
alter table public.referral_rewards enable row level security;
create policy "Users can view their referral rewards" on public.referral_rewards for select
  using (referrer_id in (select id from public.profiles where user_id = auth.uid()));
create policy "Deny user INSERT on referral_rewards" on public.referral_rewards for insert to authenticated with check (false);
create policy "Deny user UPDATE on referral_rewards" on public.referral_rewards for update to authenticated using (false);
create policy "Deny user DELETE on referral_rewards" on public.referral_rewards for delete to authenticated using (false);

-- ============ FAVORITE NUMBERS ============
create table if not exists public.favorite_numbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null,
  nickname text,
  network public.network_provider not null,
  created_at timestamptz not null default now(),
  unique (user_id, phone_number)
);
grant select, insert, update, delete on public.favorite_numbers to authenticated;
grant all on public.favorite_numbers to service_role;
alter table public.favorite_numbers enable row level security;
create policy "Users can view their favorite numbers" on public.favorite_numbers for select using (auth.uid() = user_id);
create policy "Users can insert favorite numbers" on public.favorite_numbers for insert with check (auth.uid() = user_id);
create policy "Users can update their favorite numbers" on public.favorite_numbers for update using (auth.uid() = user_id);
create policy "Users can delete their favorite numbers" on public.favorite_numbers for delete using (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  type text not null default 'general',
  data jsonb default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id on public.notifications (user_id, created_at desc);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users can view their own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update their own notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Users can delete their own notifications" on public.notifications for delete using (auth.uid() = user_id);

-- ============ PUSH SUBSCRIPTIONS ============
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;
create policy "Users can manage their push subscriptions" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ OTP VERIFICATIONS (service_role only) ============
create table if not exists public.otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  otp_code text not null,
  purpose text not null check (purpose in ('signup','password_reset')),
  expires_at timestamptz not null,
  verified boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_otp_phone_purpose on public.otp_verifications (phone_number, purpose);
grant all on public.otp_verifications to service_role;
alter table public.otp_verifications enable row level security;
create policy "Block all user access to OTP table" on public.otp_verifications for all to authenticated using (false);

create or replace function public.cleanup_expired_otps()
returns void language plpgsql security definer set search_path to 'public' as $$
begin delete from public.otp_verifications where expires_at < now(); end; $$;

-- ============ RATE LIMIT (service_role only) ============
create table if not exists public.rate_limit_attempts (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  endpoint text not null,
  attempt_count integer not null default 1,
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_rate_limit_identifier_endpoint on public.rate_limit_attempts (identifier, endpoint);
create index if not exists idx_rate_limit_locked_until on public.rate_limit_attempts (locked_until) where locked_until is not null;
grant all on public.rate_limit_attempts to service_role;
alter table public.rate_limit_attempts enable row level security;
create policy "Block all user access to rate limit table" on public.rate_limit_attempts for all using (false);
create trigger update_rate_limit_attempts_updated_at before update on public.rate_limit_attempts for each row execute function public.update_updated_at_column();

-- ============ EMAIL SETTINGS / TEMPLATES / LOG ============
create table if not exists public.email_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text not null default 'The Eagles Charge',
  logo_url text,
  logo_emoji text default '🦅',
  primary_color text not null default '#16a34a',
  dark_color text not null default '#0f172a',
  header_tagline text default '',
  footer_text text default '',
  support_email text not null default 'support@harmicglobal.com',
  from_address text not null default 'The Eagles Charge <noreply@harmicglobal.com>',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.email_settings to authenticated;
grant all on public.email_settings to service_role;
alter table public.email_settings enable row level security;
create policy "Anyone signed-in can read email settings" on public.email_settings for select to authenticated using (true);
create policy "Admins insert email settings" on public.email_settings for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "Admins update email settings" on public.email_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger email_settings_updated_at before update on public.email_settings for each row execute function public.update_updated_at_column();

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  subject text not null,
  intro text not null default '',
  outro text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.email_templates to authenticated;
grant all on public.email_templates to service_role;
alter table public.email_templates enable row level security;
create policy "Anyone signed-in can read email templates" on public.email_templates for select to authenticated using (true);
create policy "Admins insert email templates" on public.email_templates for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "Admins update email templates" on public.email_templates for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create trigger email_templates_updated_at before update on public.email_templates for each row execute function public.update_updated_at_column();

create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  recipient_email text not null,
  subject text,
  reference text,
  status text not null,
  skipped_reason text,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_send_log_created_at on public.email_send_log (created_at desc);
create index if not exists idx_email_send_log_recipient on public.email_send_log (recipient_email);
create index if not exists idx_email_send_log_reference on public.email_send_log (reference);
create index if not exists idx_email_send_log_type on public.email_send_log (template_type);
grant select on public.email_send_log to authenticated;
grant all on public.email_send_log to service_role;
alter table public.email_send_log enable row level security;
create policy "Admins can read email send log" on public.email_send_log for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) values ('avatars','avatars',true)
on conflict (id) do nothing;
create policy "Avatar images are publicly accessible" on storage.objects for select using (bucket_id = 'avatars');
create policy "Users can upload their own avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update their own avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
