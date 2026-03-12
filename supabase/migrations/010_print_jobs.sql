-- Print jobs queue for cloud-to-LAN printing
create table if not exists public.print_jobs (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('kot', 'bill', 'open_drawer', 'test')),
  printer_ip text not null,
  printer_port int not null default 9100,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'printing', 'printed', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

-- Index for proxy to find pending jobs quickly
create index idx_print_jobs_status on public.print_jobs(status) where status = 'pending';
create index idx_print_jobs_created_at on public.print_jobs(created_at desc);

-- RLS
alter table public.print_jobs enable row level security;

create policy "Authenticated users can insert print jobs"
  on public.print_jobs for insert to authenticated with check (true);

create policy "Authenticated users can read print jobs"
  on public.print_jobs for select to authenticated using (true);

create policy "Authenticated users can update print jobs"
  on public.print_jobs for update to authenticated using (true);

create policy "Authenticated users can delete print jobs"
  on public.print_jobs for delete to authenticated using (true);

-- Also allow anon key access (print proxy uses anon key)
create policy "Anon can read print jobs"
  on public.print_jobs for select to anon using (true);

create policy "Anon can update print jobs"
  on public.print_jobs for update to anon using (true);

create policy "Anon can delete print jobs"
  on public.print_jobs for delete to anon using (true);

-- Enable realtime for this table
alter publication supabase_realtime add table public.print_jobs;
