-- Migration 017: Add item_transfer audit action
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'item_cancel','nc_payment','bill_reprint','discount_override','sc_removal',
    'day_close','refund','partial_payment','balance_collected','table_transfer',
    'daily_closing','item_transfer'
  ));
