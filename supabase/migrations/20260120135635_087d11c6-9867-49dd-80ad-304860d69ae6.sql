-- Create enum types
CREATE TYPE public.transaction_type AS ENUM ('airtime', 'data', 'electricity', 'cable_tv', 'internet');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'refunded');
CREATE TYPE public.network_provider AS ENUM ('mtn', 'glo', 'airtel', '9mobile');
CREATE TYPE public.cable_provider AS ENUM ('dstv', 'gotv', 'startimes');
CREATE TYPE public.electricity_provider AS ENUM ('ekedc', 'ikedc', 'aedc', 'phedc', 'kedco', 'ibedc', 'eedc', 'bedc', 'jedc', 'kaedco', 'yedc');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone_number TEXT,
  wallet_balance DECIMAL(12, 2) DEFAULT 0.00,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  total_referral_earnings DECIMAL(12, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Favorite phone numbers
CREATE TABLE public.favorite_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL,
  nickname TEXT,
  network network_provider NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, phone_number)
);

-- Transactions table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type transaction_type NOT NULL,
  status transaction_status DEFAULT 'pending' NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  phone_number TEXT,
  network network_provider,
  data_plan TEXT,
  cable_provider cable_provider,
  cable_smartcard TEXT,
  cable_plan TEXT,
  electricity_provider electricity_provider,
  meter_number TEXT,
  meter_type TEXT,
  token TEXT,
  paystack_reference TEXT UNIQUE,
  paystack_access_code TEXT,
  api_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Referral rewards tracking
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reward_amount DECIMAL(12, 2) NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Favorite numbers policies
CREATE POLICY "Users can view their favorite numbers" ON public.favorite_numbers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert favorite numbers" ON public.favorite_numbers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their favorite numbers" ON public.favorite_numbers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their favorite numbers" ON public.favorite_numbers
  FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view their transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their transactions" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Referral rewards policies
CREATE POLICY "Users can view their referral rewards" ON public.referral_rewards
  FOR SELECT USING (
    referrer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'EAGLE' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate referral code on profile creation
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.referral_code := generate_referral_code();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_profile();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();