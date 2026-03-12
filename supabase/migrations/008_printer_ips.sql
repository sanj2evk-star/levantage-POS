-- =====================================================
-- 008: Update printer IPs to match actual cafe setup
-- =====================================================

-- Billing / Cashier printer
update public.print_stations
set printer_ip = '192.168.1.200', name = 'Cashier Billing Printer'
where station_type = 'billing';

-- Kitchen printer (food, bakes, desserts)
update public.print_stations
set printer_ip = '192.168.1.160', name = 'Kitchen Printer'
where station_type = 'kitchen';

-- Cafe Counter / Coffee printer
update public.print_stations
set printer_ip = '192.168.1.216', name = 'Coffee Counter Printer'
where station_type = 'cafe';

-- Mocktail / Bar printer (mocktails, soft drinks, water bottles)
update public.print_stations
set printer_ip = '192.168.1.229', name = 'Bar Printer'
where station_type = 'mocktail';

-- Deactivate juice_bar station (no printer assigned)
update public.print_stations
set is_active = false
where station_type = 'juice_bar';

-- Reroute any juice_bar menu items to cafe (coffee printer)
update public.menu_items
set station = 'cafe'
where station = 'juice_bar';
