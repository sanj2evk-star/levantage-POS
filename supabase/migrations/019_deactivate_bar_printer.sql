-- Deactivate bar/mocktail printer (replaced by tablet bar display).
-- KOT entries still created in DB for the bar display to consume.
-- printKOT() silently returns false when is_active = false.
UPDATE public.print_stations
SET is_active = false
WHERE station_type = 'mocktail';
