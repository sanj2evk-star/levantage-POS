-- Audit Logs - Track item cancellations and bill reprints
-- Run this in your Supabase SQL Editor

create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null check (action in ('item_cancel', 'bill_reprint')),
  order_id uuid references public.orders(id) on delete set null,
  bill_id uuid references public.bills(id) on delete set null,
  performed_by uuid references auth.users on delete set null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Index for efficient querying
create index idx_audit_logs_action on public.audit_logs(action);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- RLS policies
alter table public.audit_logs enable row level security;

create policy "Allow authenticated users to insert audit logs"
  on public.audit_logs for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to read audit logs"
  on public.audit_logs for select
  to authenticated
  using (true);
