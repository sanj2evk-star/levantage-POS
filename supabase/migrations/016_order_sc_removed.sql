-- Migration 016: Add service_charge_removed to orders table
-- This persists the SC removal flag so it survives dialog close/reopen

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS service_charge_removed boolean DEFAULT false;
