-- Migration 012: Add FSSAI license number setting for bill printing
INSERT INTO public.settings (key, value) VALUES ('fssai_number', '13621011002089')
ON CONFLICT (key) DO NOTHING;
