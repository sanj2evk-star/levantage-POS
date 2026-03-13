-- Migration 010: Complete Menu Sync
-- Matches POS menu to latest Le Vantage website/screenshots (March 2026)
-- Adds missing items, fixes prices, fixes names

-- =============================================
-- 1. CREATE NEW CATEGORIES
-- =============================================
INSERT INTO categories (name, display_order, is_active) VALUES ('Kombucha', 50, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Smokes', 51, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Pour Over', 52, true);

-- =============================================
-- 2. FIX NAME MISMATCHES
-- =============================================

-- Coffee: "Corn" → "Con"
UPDATE menu_items SET name = 'Marocchino Con Nutella'
WHERE name = 'Marocchino Corn Nutella';

-- Coffee: "Marshmallow Cream" → "Marshmallow Fluff"
UPDATE menu_items SET name = 'Hot Chocolate With Marshmallow Fluff'
WHERE name = 'Hot Chocolate With Marshmallow Cream';

-- Cold Brew: "Classic Cold Brew" → "Virgin Cold Brew" + price 295→300
UPDATE menu_items SET name = 'Virgin Cold Brew', price = 300
WHERE name = 'Classic Cold Brew';

-- Cold Brew: "Vanilla Cold Brew" → "Vanilla Bourbon Cold Brew" + price 325→395
UPDATE menu_items SET name = 'Vanilla Bourbon Cold Brew', price = 395
WHERE name = 'Vanilla Cold Brew';

-- Tea: "Chamomile Tea" → "Chamomile Mint" + price 275→395
UPDATE menu_items SET name = 'Chamomile Mint', price = 395
WHERE name = 'Chamomile Tea';

-- Tea: "Darjeeling Tea" → "Darjeeling Green" + price 275→395
UPDATE menu_items SET name = 'Darjeeling Green', price = 395
WHERE name = 'Darjeeling Tea';

-- Veg Mains: "Tofu Steak & Rice Bowl" → "Tofu Broccoli Rice Bowl" + price 525→535
UPDATE menu_items SET name = 'Tofu Broccoli Rice Bowl', price = 535
WHERE name = 'Tofu Steak & Rice Bowl';

-- Veg Mains: "Risotto" → "Risotto Alle Verdure" + price 575→615
UPDATE menu_items SET name = 'Risotto Alle Verdure', price = 615
WHERE name = 'Risotto'
AND category_id = (SELECT id FROM categories WHERE name = 'Veg Mains');

-- Non Veg Mains: "Asian Chicken And Nuts Stir Fry" → "Asian Chicken And Nuts Rice Bowl" + price 635→645
UPDATE menu_items SET name = 'Asian Chicken And Nuts Rice Bowl', price = 645
WHERE name = 'Asian Chicken And Nuts Stir Fry';

-- Desserts: "Cinnamon Twist Bun" → "Cinnamon Roll"
UPDATE menu_items SET name = 'Cinnamon Roll'
WHERE name = 'Cinnamon Twist Bun';

-- Desserts: "Croissant" → "Butter Croissant"
UPDATE menu_items SET name = 'Butter Croissant'
WHERE name = 'Croissant' AND price = 150;

-- Desserts: "Chocolate Cake" → "Chocolate Loaf Cake Slice"
UPDATE menu_items SET name = 'Chocolate Loaf Cake Slice'
WHERE name = 'Chocolate Cake' AND price = 180;

-- Desserts: "Banana Cake" → "Banana & Chocolate Cake Slice"
UPDATE menu_items SET name = 'Banana & Chocolate Cake Slice'
WHERE name = 'Banana Cake' AND price = 180;

-- =============================================
-- 3. FIX PRICE MISMATCHES
-- =============================================

-- Tea: Moroccan Mint 275→395
UPDATE menu_items SET price = 395
WHERE name = 'Moroccan Mint'
AND category_id = (SELECT id FROM categories WHERE name = 'Tea');

-- Tea: Kashmiri Kahwa 345→405
UPDATE menu_items SET price = 405
WHERE name = 'Kashmiri Kahwa';

-- Cold Brew: Hazelnut Cold Brew 325→395
UPDATE menu_items SET price = 395
WHERE name = 'Hazelnut Cold Brew';

-- Coffee/Matcha: Hot Matcha 365→395
UPDATE menu_items SET price = 395
WHERE name = 'Hot Matcha';

-- Coffee/Matcha: Cold Matcha 365→395
UPDATE menu_items SET price = 395
WHERE name = 'Cold Matcha';

-- Veg Mains: Creamy Spinach & Corn Cannelloni 575→555
UPDATE menu_items SET price = 555
WHERE name = 'Creamy Spinach & Corn Cannelloni';

-- Veg Mains: Cottage Cheese Steak 525→575
UPDATE menu_items SET price = 575
WHERE name = 'Cottage Cheese Steak';

-- Veg Mains: Mediterranean Grilled Vegetables 525→595
UPDATE menu_items SET price = 595
WHERE name = 'Mediterranean Grilled Vegetables';

-- Non Veg Mains: Stuffed Chicken Breast 575→635
UPDATE menu_items SET price = 635
WHERE name = 'Stuffed Chicken Breast'
AND category_id = (SELECT id FROM categories WHERE name = 'Non Veg Mains');

-- Short Bites: Jamaican Chicken Skewers 575→545
UPDATE menu_items SET price = 545
WHERE name = 'Jamaican Chicken Skewers';

-- =============================================
-- 4. ADD MISSING ITEMS — KOMBUCHA (14 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Kombucha'), 'The Original', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Ginger Lemon', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Lemon Mint', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Apple Cinnamon', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Ginger Honey', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Blueberry Rose', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Apricot Cinnamon', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Pineapple', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Jamun', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Spicy Imli', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Kokam', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Pomegranate', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Original Ginger Ale', 400, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Kombucha'), 'Hibiscus Ginger Ale', 400, true, true, 'cafe');

-- =============================================
-- 5. ADD MISSING ITEMS — POUR OVER (8 items: 4 origins × 2 sizes)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Shyira Rwanda (300ml)', 440, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Shyira Rwanda (600ml)', 680, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Gachatha AA Kenya (300ml)', 440, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Gachatha AA Kenya (600ml)', 680, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Nilgiris Coonoor (300ml)', 320, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Nilgiris Coonoor (600ml)', 520, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Gundikhan Natural Baba Budangiri (300ml)', 320, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Pour Over'), 'Gundikhan Natural Baba Budangiri (600ml)', 520, true, true, 'cafe');

-- =============================================
-- 6. ADD MISSING ITEMS — SMOKES (5 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Smokes'), 'Gold Flake Kings', 650, true, true, 'mocktail'),
((SELECT id FROM categories WHERE name = 'Smokes'), 'Gold Flake Lights', 650, true, true, 'mocktail'),
((SELECT id FROM categories WHERE name = 'Smokes'), 'Marlboro Advance', 650, true, true, 'mocktail'),
((SELECT id FROM categories WHERE name = 'Smokes'), 'Classic Milds', 650, true, true, 'mocktail'),
((SELECT id FROM categories WHERE name = 'Smokes'), 'Classic Ice Burst', 650, true, true, 'mocktail');

-- =============================================
-- 7. ADD MISSING ITEMS — SHORT BITES (6 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Chicken Ham & Cheese Rolls', 535, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Buffalo Chicken Wings', 575, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Chilly Garlic Chicken Wings', 575, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Leeki & Cajun Prawns', 675, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Prawn Tempura', 675, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Short Bites'), 'Cognac Garlic Prawns', 675, true, false, 'kitchen');

-- =============================================
-- 8. ADD MISSING ITEMS — NON VEG MAINS (6 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Roasted Lemon Chicken', 625, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Mustard Grilled Chicken', 625, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Burnt Garlic Chicken Shashlik With Rice', 645, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Herb Garlic Tenderloin Steak', 845, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Pan Fried Tenderloin', 845, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Non Veg Mains'), 'Pan Seared Chipotle Tenderloin With Broccoli', 865, true, false, 'kitchen');

-- =============================================
-- 9. ADD MISSING ITEMS — COFFEE (1 item)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Coffee'), 'Irish Coffee', 395, true, true, 'cafe');

-- =============================================
-- 10. ADD MISSING ITEMS — COLD BREW (2 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Cold Brew Coffee'), 'Cold Brew With Home Made Coconut Milk', 325, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Cold Brew Coffee'), 'Vietnamese Iced Coffee', 345, true, true, 'cafe');

-- =============================================
-- 11. ADD MISSING ITEMS — TEA (4 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Tea'), 'Lavender Flower', 395, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Tea'), 'Blooming Tea', 405, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Tea'), 'Hibiscus', 395, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Tea'), 'Berry Fruit', 395, true, true, 'cafe');

-- =============================================
-- 12. ADD MISSING ITEMS — DESSERTS/BAKES (10 items)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Desserts'), 'French Vanilla Madeleine (2pc)', 100, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Chocolate Croissant', 240, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Raspberry Custard Croissant', 275, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Vanilla & Chocolate Cake Slice', 180, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Lemon Cake Slice', 180, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Hojicha & Vanilla Cake Slice', 200, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Banoffee Tart', 230, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Blueberry Tart', 280, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Chocolate Tart', 230, true, true, 'cafe'),
((SELECT id FROM categories WHERE name = 'Desserts'), 'Lemon Tart', 230, true, true, 'cafe');

-- =============================================
-- 13. ADD MISSING ITEMS — PASTA (3 Spinach Fettuccine variants)
-- =============================================
INSERT INTO menu_items (category_id, name, price, is_active, is_veg, station) VALUES
((SELECT id FROM categories WHERE name = 'Pasta'), 'Chicken Spinach Fettuccine', 645, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Pasta'), 'Bacon Spinach Fettuccine', 665, true, false, 'kitchen'),
((SELECT id FROM categories WHERE name = 'Pasta'), 'Cajun Shrimp Spinach Fettuccine', 695, true, false, 'kitchen');
