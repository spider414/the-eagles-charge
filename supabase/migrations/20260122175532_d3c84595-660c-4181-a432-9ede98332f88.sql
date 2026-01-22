-- Add columns to profiles table for Paystack DVA (Dedicated Virtual Account)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
ADD COLUMN IF NOT EXISTS dva_account_number TEXT,
ADD COLUMN IF NOT EXISTS dva_account_name TEXT,
ADD COLUMN IF NOT EXISTS dva_bank_name TEXT;