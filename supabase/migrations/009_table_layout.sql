-- Migration 009: Table layout redesign to match Petpooja sections
-- Sections: coffee (C), ground_floor (G), ground_box (GB), first_floor (F), first_box (FB)

-- 1. Clear all existing test data first (order matters due to FK constraints)
-- Must delete before altering constraint, since existing rows may violate new CHECK
DELETE FROM public.refunds;
DELETE FROM public.payments;
DELETE FROM public.bills;
DELETE FROM public.kot_entries;
DELETE FROM public.order_items;
DELETE FROM public.audit_logs;
DELETE FROM public.orders;
DELETE FROM public.tables;

-- 2. Update section CHECK constraint to support 5 section values
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_section_check;
ALTER TABLE public.tables ADD CONSTRAINT tables_section_check
  CHECK (section IN ('coffee', 'ground_floor', 'ground_box', 'first_floor', 'first_box'));

-- 3. Insert tables matching Petpooja layout

-- Coffee Section: C1–C20
INSERT INTO public.tables (number, section, capacity, status)
SELECT n, 'coffee', 4, 'available'
FROM generate_series(1, 20) AS n;

-- Ground Floor: G1–G20
INSERT INTO public.tables (number, section, capacity, status)
SELECT n, 'ground_floor', 4, 'available'
FROM generate_series(1, 20) AS n;

-- Ground Floor Box: GB1–GB8
INSERT INTO public.tables (number, section, capacity, status)
SELECT n, 'ground_box', 6, 'available'
FROM generate_series(1, 8) AS n;

-- First Floor: F1–F20
INSERT INTO public.tables (number, section, capacity, status)
SELECT n, 'first_floor', 4, 'available'
FROM generate_series(1, 20) AS n;

-- First Floor Box: FB1–FB10
INSERT INTO public.tables (number, section, capacity, status)
SELECT n, 'first_box', 6, 'available'
FROM generate_series(1, 10) AS n;

-- Total: 20 + 20 + 8 + 20 + 10 = 78 tables
