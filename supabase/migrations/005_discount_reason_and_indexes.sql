-- 005: Discount reason column + performance indexes

-- Task 6: Add discount_reason to bills
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount_reason text;

-- Task 6: Add cashier discount threshold setting
INSERT INTO public.settings (key, value) VALUES ('cashier_discount_max_percent', '10')
ON CONFLICT (key) DO NOTHING;

-- Task 6: Add 'discount_override' to audit_logs action types
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
    'discount_override'
  ));

-- Task 8: Performance indexes (missing from 001)
CREATE INDEX IF NOT EXISTS idx_orders_waiter_id ON public.orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_order_items_station ON public.order_items(station);
CREATE INDEX IF NOT EXISTS idx_bills_payment_mode ON public.bills(payment_mode);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON public.order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_tables_section ON public.tables(section);
CREATE INDEX IF NOT EXISTS idx_bills_payment_status ON public.bills(payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_is_cancelled ON public.order_items(is_cancelled);
