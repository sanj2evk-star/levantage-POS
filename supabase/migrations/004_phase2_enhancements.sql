-- Phase 2 Enhancements: New audit actions + table transfer support
-- Run this in your Supabase SQL Editor

-- Expand audit_logs action types for new features
alter table public.audit_logs drop constraint if exists audit_logs_action_check;
alter table public.audit_logs add constraint audit_logs_action_check
  check (action in (
    'item_cancel',
    'bill_reprint',
    'table_transfer',
    'waiter_reassign',
    'items_added',
    'bill_delete',
    'kot_reprint',
    'order_cancel'
  ));
