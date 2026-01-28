-- Create atomic wallet debit function to prevent race conditions
CREATE OR REPLACE FUNCTION public.debit_wallet(
  p_profile_id UUID,
  p_amount DECIMAL
)
RETURNS TABLE(success BOOLEAN, new_balance DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance DECIMAL;
BEGIN
  -- Atomic update with balance check
  UPDATE profiles
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_profile_id
  AND wallet_balance >= p_amount
  RETURNING wallet_balance INTO v_balance;
  
  IF FOUND THEN
    RETURN QUERY SELECT true, v_balance;
  ELSE
    RETURN QUERY SELECT false, 0::DECIMAL;
  END IF;
END;
$$;

-- Create atomic wallet credit function for top-ups and refunds
CREATE OR REPLACE FUNCTION public.credit_wallet(
  p_profile_id UUID,
  p_amount DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance DECIMAL;
BEGIN
  UPDATE profiles
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_profile_id
  RETURNING wallet_balance INTO v_new_balance;
  
  RETURN v_new_balance;
END;
$$;

-- Add CHECK constraint to prevent negative wallet balance
ALTER TABLE profiles
ADD CONSTRAINT wallet_balance_non_negative CHECK (wallet_balance >= 0);