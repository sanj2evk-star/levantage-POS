-- Migration 014: Add 'zomato' to payment_mode constraints
-- Allows settling bills with Zomato payment mode

-- Update bills.payment_mode CHECK constraint to include 'zomato'
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_payment_mode_check;
ALTER TABLE public.bills ADD CONSTRAINT bills_payment_mode_check
  CHECK (payment_mode IS NULL OR payment_mode IN ('cash', 'upi', 'card', 'split', 'nc', 'zomato'));

-- Update payments.mode CHECK constraint to include 'zomato'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_mode_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_mode_check
  CHECK (mode IN ('cash', 'upi', 'card', 'nc', 'zomato'));
