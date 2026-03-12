-- Levantage Cafe POS - Initial Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =====================================================
-- PROFILES (extends Supabase auth.users)
-- =====================================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'waiter' check (role in ('admin', 'manager', 'accountant', 'cashier', 'waiter')),
  phone text,
  pin text, -- 4-digit PIN for quick login
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================
-- CATEGORIES
-- =====================================================
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================
-- MENU ITEMS
-- =====================================================
create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  description text,
  image_url text,
  is_active boolean not null default true,
  is_veg boolean not null default true,
  station text not null default 'kitchen' check (station in ('kitchen', 'cafe', 'mocktail', 'juice_bar')),
  created_at timestamptz not null default now()
);

-- =====================================================
-- ITEM VARIANTS (e.g., Small, Medium, Large)
-- =====================================================
create table public.item_variants (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,
  price_adjustment numeric(10,2) not null default 0,
  is_active boolean not null default true
);

-- =====================================================
-- ITEM ADDONS (e.g., Extra cheese, Extra shot)
-- =====================================================
create table public.item_addons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  price numeric(10,2) not null default 0,
  category_id uuid references public.categories(id) on delete set null,
  is_active boolean not null default true
);

-- =====================================================
-- TABLES
-- =====================================================
create table public.tables (
  id uuid primary key default uuid_generate_v4(),
  number integer not null,
  section text not null default 'ground_floor' check (section in ('ground_floor', 'first_floor', 'garden')),
  capacity integer not null default 4,
  status text not null default 'available' check (status in ('available', 'occupied', 'reserved')),
  current_order_id uuid,
  created_at timestamptz not null default now(),
  unique(number, section)
);

-- =====================================================
-- ORDERS
-- =====================================================
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  table_id uuid references public.tables(id) on delete set null,
  order_number text not null,
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  order_type text not null default 'dine_in' check (order_type in ('dine_in', 'takeaway')),
  waiter_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add foreign key from tables to orders (circular reference)
alter table public.tables
  add constraint fk_tables_current_order
  foreign key (current_order_id) references public.orders(id) on delete set null;

-- =====================================================
-- ORDER ITEMS
-- =====================================================
create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id),
  variant_id uuid references public.item_variants(id),
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  notes text,
  kot_status text not null default 'pending' check (kot_status in ('pending', 'preparing', 'ready', 'printed')),
  station text not null default 'kitchen' check (station in ('kitchen', 'cafe', 'mocktail', 'juice_bar')),
  is_cancelled boolean not null default false,
  cancel_reason text,
  created_at timestamptz not null default now()
);

-- =====================================================
-- ORDER ITEM ADDONS
-- =====================================================
create table public.order_item_addons (
  id uuid primary key default uuid_generate_v4(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  addon_id uuid not null references public.item_addons(id),
  price numeric(10,2) not null
);

-- =====================================================
-- KOT ENTRIES
-- =====================================================
create table public.kot_entries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  station text not null check (station in ('kitchen', 'cafe', 'mocktail', 'juice_bar')),
  kot_number text not null,
  status text not null default 'pending' check (status in ('pending', 'preparing', 'ready', 'printed')),
  printed_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================
-- BILLS
-- =====================================================
create table public.bills (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  subtotal numeric(10,2) not null default 0,
  gst_percent numeric(5,2) not null default 5,
  gst_amount numeric(10,2) not null default 0,
  service_charge numeric(10,2) not null default 0,
  service_charge_removed boolean not null default false,
  discount_amount numeric(10,2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('percent', 'flat', 'none')),
  total numeric(10,2) not null default 0,
  payment_mode text check (payment_mode in ('cash', 'upi', 'card', 'split')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'partial')),
  bill_number text not null,
  created_at timestamptz not null default now()
);

-- =====================================================
-- PAYMENTS (for split payments)
-- =====================================================
create table public.payments (
  id uuid primary key default uuid_generate_v4(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  mode text not null check (mode in ('cash', 'upi', 'card')),
  amount numeric(10,2) not null,
  reference_number text,
  created_at timestamptz not null default now()
);

-- =====================================================
-- PRINT STATIONS
-- =====================================================
create table public.print_stations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  station_type text not null check (station_type in ('kitchen', 'cafe', 'mocktail', 'juice_bar', 'billing')),
  printer_ip text not null,
  port integer not null default 9100,
  is_active boolean not null default true
);

-- =====================================================
-- SETTINGS
-- =====================================================
create table public.settings (
  key text primary key,
  value text not null
);

-- =====================================================
-- DAILY CLOSINGS
-- =====================================================
create table public.daily_closings (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  total_sales numeric(10,2) not null default 0,
  total_orders integer not null default 0,
  cash_total numeric(10,2) not null default 0,
  upi_total numeric(10,2) not null default 0,
  card_total numeric(10,2) not null default 0,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =====================================================
-- INDEXES
-- =====================================================
create index idx_menu_items_category on public.menu_items(category_id);
create index idx_menu_items_station on public.menu_items(station);
create index idx_orders_table on public.orders(table_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at);
create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_kot_status on public.order_items(kot_status);
create index idx_kot_entries_order on public.kot_entries(order_id);
create index idx_kot_entries_station on public.kot_entries(station);
create index idx_bills_order on public.bills(order_id);
create index idx_bills_created on public.bills(created_at);
create index idx_payments_bill on public.payments(bill_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.item_variants enable row level security;
alter table public.item_addons enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_addons enable row level security;
alter table public.kot_entries enable row level security;
alter table public.bills enable row level security;
alter table public.payments enable row level security;
alter table public.print_stations enable row level security;
alter table public.settings enable row level security;
alter table public.daily_closings enable row level security;

-- Helper functions (SECURITY DEFINER to avoid RLS recursion on profiles)
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = user_id and role = 'admin');
$$;

create or replace function public.is_admin_or_manager(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = user_id and role in ('admin', 'manager'));
$$;

-- Policies: Allow authenticated users to read all data
-- Admin can do everything, manager can manage menu/tables/reports
-- Cashier/waiter have restricted write access

-- Profiles
create policy "Users can view all profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Admins can manage profiles" on public.profiles for all to authenticated using (
  public.is_admin(auth.uid())
);

-- Categories (read for all, write for admin/manager)
create policy "Anyone can view active categories" on public.categories for select using (true);
create policy "Admin or manager can manage categories" on public.categories for all to authenticated using (
  public.is_admin_or_manager(auth.uid())
);

-- Menu Items (read for all, write for admin/manager)
create policy "Anyone can view menu items" on public.menu_items for select using (true);
create policy "Admin or manager can manage menu items" on public.menu_items for all to authenticated using (
  public.is_admin_or_manager(auth.uid())
);

-- Item Variants (read for all, write for admin/manager)
create policy "Anyone can view variants" on public.item_variants for select using (true);
create policy "Admin or manager can manage variants" on public.item_variants for all to authenticated using (
  public.is_admin_or_manager(auth.uid())
);

-- Item Addons (read for all, write for admin/manager)
create policy "Anyone can view addons" on public.item_addons for select using (true);
create policy "Admin or manager can manage addons" on public.item_addons for all to authenticated using (
  public.is_admin_or_manager(auth.uid())
);

-- Tables (read for all, update for all staff, full manage for admin/manager)
create policy "Authenticated can view tables" on public.tables for select to authenticated using (true);
create policy "Staff can update table status" on public.tables for update to authenticated using (true);
create policy "Admin or manager can manage tables" on public.tables for all to authenticated using (
  public.is_admin_or_manager(auth.uid())
);

-- Orders
create policy "Authenticated can view orders" on public.orders for select to authenticated using (true);
create policy "Staff can create orders" on public.orders for insert to authenticated with check (true);
create policy "Staff can update orders" on public.orders for update to authenticated using (true);

-- Order Items
create policy "Authenticated can view order items" on public.order_items for select to authenticated using (true);
create policy "Staff can create order items" on public.order_items for insert to authenticated with check (true);
create policy "Staff can update order items" on public.order_items for update to authenticated using (true);

-- Order Item Addons
create policy "Authenticated can view order item addons" on public.order_item_addons for select to authenticated using (true);
create policy "Staff can create order item addons" on public.order_item_addons for insert to authenticated with check (true);

-- KOT Entries
create policy "Authenticated can view KOTs" on public.kot_entries for select to authenticated using (true);
create policy "Staff can create KOTs" on public.kot_entries for insert to authenticated with check (true);
create policy "Staff can update KOTs" on public.kot_entries for update to authenticated using (true);

-- Bills
create policy "Authenticated can view bills" on public.bills for select to authenticated using (true);
create policy "Cashiers can create bills" on public.bills for insert to authenticated with check (true);
create policy "Cashiers can update bills" on public.bills for update to authenticated using (true);

-- Payments
create policy "Authenticated can view payments" on public.payments for select to authenticated using (true);
create policy "Cashiers can create payments" on public.payments for insert to authenticated with check (true);

-- Print Stations
create policy "Authenticated can view print stations" on public.print_stations for select to authenticated using (true);
create policy "Admins can manage print stations" on public.print_stations for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Settings
create policy "Authenticated can view settings" on public.settings for select to authenticated using (true);
create policy "Anyone can view settings for menu" on public.settings for select using (true);
create policy "Admins can manage settings" on public.settings for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Daily Closings
create policy "Authenticated can view closings" on public.daily_closings for select to authenticated using (true);
create policy "Cashiers can create closings" on public.daily_closings for insert to authenticated with check (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), 'waiter');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Generate order number (e.g., ORD-20260309-001)
create or replace function public.generate_order_number()
returns text as $$
declare
  today_count integer;
  today_str text;
begin
  today_str := to_char(now(), 'YYYYMMDD');
  select count(*) + 1 into today_count
  from public.orders
  where created_at::date = current_date;
  return 'ORD-' || today_str || '-' || lpad(today_count::text, 3, '0');
end;
$$ language plpgsql;

-- Generate bill number (e.g., BILL-20260309-001)
create or replace function public.generate_bill_number()
returns text as $$
declare
  today_count integer;
  today_str text;
begin
  today_str := to_char(now(), 'YYYYMMDD');
  select count(*) + 1 into today_count
  from public.bills
  where created_at::date = current_date;
  return 'BILL-' || today_str || '-' || lpad(today_count::text, 3, '0');
end;
$$ language plpgsql;

-- Generate KOT number (e.g., KOT-K-001)
create or replace function public.generate_kot_number(p_station text)
returns text as $$
declare
  today_count integer;
  station_prefix text;
begin
  station_prefix := case p_station
    when 'kitchen' then 'K'
    when 'cafe' then 'C'
    when 'mocktail' then 'M'
    when 'juice_bar' then 'J'
    else 'X'
  end;
  select count(*) + 1 into today_count
  from public.kot_entries
  where created_at::date = current_date and station = p_station;
  return 'KOT-' || station_prefix || '-' || lpad(today_count::text, 3, '0');
end;
$$ language plpgsql;

-- Update updated_at on orders
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.update_updated_at();

-- =====================================================
-- SEED DATA: Default Settings
-- =====================================================
insert into public.settings (key, value) values
  ('cafe_name', 'Levantage Cafe'),
  ('cafe_address', ''),
  ('cafe_phone', ''),
  ('gst_number', ''),
  ('gst_percent', '5'),
  ('service_charge_percent', '10'),
  ('currency_symbol', '₹')
on conflict (key) do nothing;

-- =====================================================
-- SEED DATA: Default Print Stations
-- =====================================================
insert into public.print_stations (name, station_type, printer_ip, port) values
  ('Cashier Printer', 'billing', '192.168.1.100', 9100),
  ('Cafe Counter Printer', 'cafe', '192.168.1.101', 9100),
  ('Mocktail Counter Printer', 'mocktail', '192.168.1.102', 9100),
  ('Juice Bar Printer', 'juice_bar', '192.168.1.103', 9100),
  ('Kitchen Printer', 'kitchen', '192.168.1.104', 9100);

-- =====================================================
-- REALTIME
-- =====================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.kot_entries;
alter publication supabase_realtime add table public.tables;
