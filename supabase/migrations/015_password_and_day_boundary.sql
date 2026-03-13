-- Migration 015: Password protection fix + business day boundary setting

-- 1. Seed security_pin for fresh installs (existing DBs already have it via admin UI)
INSERT INTO public.settings (key, value) VALUES ('security_pin', '1234')
ON CONFLICT (key) DO NOTHING;

-- 2. Add business day boundary hour setting (default 3 AM)
-- Orders between midnight and this hour count as previous business day
INSERT INTO public.settings (key, value) VALUES ('day_boundary_hour', '3')
ON CONFLICT (key) DO NOTHING;

-- 3. Update audit_logs action constraint to include new actions (sc_removal, day_close)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN ('item_cancel','nc_payment','bill_reprint','discount_override','sc_removal','day_close','refund'));
