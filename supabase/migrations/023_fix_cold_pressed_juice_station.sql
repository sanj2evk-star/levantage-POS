-- 023: Fix Cold Pressed Juice station assignment
-- Cold Pressed Juice items were incorrectly rerouted to 'mocktail' station
-- in migration 020 (reroute_juice_to_bar). They should go to 'cafe' station
-- since the juice bar is deactivated and these items are prepared at the cafe counter.
-- Only Mocktails, Sodas, and Beverages should appear on the bar display.

UPDATE menu_items
SET station = 'cafe'
WHERE category_id IN (
  SELECT id FROM categories WHERE name = 'Cold Pressed Juice'
)
AND station = 'mocktail';
