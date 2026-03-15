-- Reroute Cold Pressed Juice items from cafe → mocktail (bar display).
-- These were originally juice_bar, rerouted to cafe in migration 008.
-- Now they should appear on the bar tablet display instead.
UPDATE public.menu_items
SET station = 'mocktail'
WHERE category_id = (SELECT id FROM public.categories WHERE name = 'Cold Pressed Juice');
