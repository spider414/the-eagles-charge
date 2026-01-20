-- Add wallet_topup to transaction_type enum
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'wallet_topup';