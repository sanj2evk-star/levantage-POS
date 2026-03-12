-- 006: Phase 3 — Billing & Payments enhancements

-- ============================================================
-- 1. Extend daily_closings for EOD + Tender Reconciliation
-- ============================================================
ALTER TABLE public.daily_closings
  ADD COLUMN IF NOT EXISTS opening_balance numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_cash numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS denomination_details jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS short_surplus numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_cash numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_refunds numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_total numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partial_outstanding numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================
-- 2. Create refunds table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  reason text NOT NULL,
  refund_mode text NOT NULL CHECK (refund_mode IN ('cash', 'upi', 'card')),
  reference_number text,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_bill_id ON public.refunds(bill_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON public.refunds(created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_performed_by ON public.refunds(performed_by);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view refunds"
  ON public.refunds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can create refunds"
  ON public.refunds FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 3. Add total_refunded to bills
-- ============================================================
ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS total_refunded numeric(10,2) NOT NULL DEFAULT 0;

-- ============================================================
-- 4. Update audit_logs action constraint
-- ============================================================
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'item_cancel',
    'bill_reprint',
    'table_transfer',
    'waiter_reassign',
    'items_added',
    'bill_delete',
    'kot_reprint',
    'order_cancel',
    'discount_override',
    'refund',
    'partial_payment',
    'balance_collected',
    'daily_closing'
  ));

-- ============================================================
-- 5. Add require_payment_ref setting
-- ============================================================
INSERT INTO public.settings (key, value) VALUES ('require_payment_ref', 'false')
ON CONFLICT (key) DO NOTHING;
