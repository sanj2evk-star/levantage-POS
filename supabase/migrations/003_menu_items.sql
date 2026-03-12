-- Levantage Cafe Menu Import
-- Generated from PetPooja data (March 2026)
-- Excludes all alcoholic beverages

-- Step 1: Clean existing menu data (cascade through orders)
TRUNCATE item_variants, menu_items, categories CASCADE;

-- Step 2: Insert categories
INSERT INTO categories (name, display_order, is_active) VALUES ('Soup', 1, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Salad', 2, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Sandwich', 3, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Burgers', 4, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Short Bites', 5, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Pizza', 6, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Pasta', 7, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Non Veg Mains', 8, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Veg Mains', 9, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Breakfast', 10, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Coffee', 11, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Cold Brew Coffee', 12, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Tea', 13, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Pop Tea', 14, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Milkshake', 15, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Mocktail', 16, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Beverages', 17, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Soda', 18, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Cold Pressed Juice', 19, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Desserts', 20, true);
INSERT INTO categories (name, display_order, is_active) VALUES ('Extras', 21, true);

-- Step 3: Insert menu items

-- Soup (13 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Mushroom Cappuccino', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Mushroom Cappuccino', 395, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Pepper Corn', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Pepper Corn', 395, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Tomato Fennel', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Tomato Fennel', 395, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Cream Of Broccoli', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Cream Of Broccoli', 395, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Tomato Corn Tortilla', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Tomato Corn Tortilla', 395, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chowder Leek Potato Soup', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mushroom Cappuccino', 345, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Sea Food Soup', 425, (SELECT id FROM categories WHERE name='Soup'), 'kitchen', true);

-- Salad (11 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Caesar Salad', 415, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Caesar Salad', 465, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Watermelon Feta Salad', 425, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Apple Walnut With Honey Mustard', 425, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Arabic Fattoush Feta With Toasted Pita', 455, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mediterranean Salad', 455, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('House Special Salad', 455, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Tuna Salad', 485, (SELECT id FROM categories WHERE name='Salad'), 'kitchen', true);

-- Sandwich (14 items - deduped)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veggie Grilled Sandwich', 475, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Panini Caprese Sandwich', 475, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Avocado Halloumi Sandwich', 525, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Moroccan Chicken Sandwich', 545, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken And Pepperoni Sandwich', 545, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Grilled Chicken Sandwich', 545, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('BLT Sandwich', 545, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Italian Tuna Sandwich', 525, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Creamy Spinach & Corn Sandwich', 495, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pulled Chicken BBQ Sandwich', 565, (SELECT id FROM categories WHERE name='Sandwich'), 'kitchen', true);

-- Burgers (13 items - deduped, excl party packages)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veggie Lovers Burger', 515, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cottage Cheese Chilli Bean Burger', 525, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Black Bean Halloumi Burger', 515, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Crispy Fried Chicken Burger', 565, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Hot & Spicy Burger', 565, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Smoked Grilled Chicken Sriracha Burger', 575, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken BBQ Bacon Burger', 575, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Fish Burger', 625, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Burger', 625, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Classic Ham Burger', 645, (SELECT id FROM categories WHERE name='Burgers'), 'kitchen', true);

-- Short Bites (41 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Bocconcini Tomato Bruschetta', 405, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheese Rolls', 465, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Onion Rings', 415, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Garlic Loaf', 395, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Garlic Loaf With Cheese', 415, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mushroom Picante With Buns', 485, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Baked Nachos', 465, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheese Baked Nachos With Chicken', 495, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheese Baked Nachos With Minced Mutton', 545, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('French Fries', 415, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Potato Wedges', 415, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Peri Peri Babycorn Fritters', 435, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spinach And Feta Mini Rolls', 435, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hummus With Pita And Lavash', 475, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Falafel Pita Pockets With Hummus Tabbouleh Salad', 495, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Quesadilla Veg', 485, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Quesadilla Non Veg', 515, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('BBQ Chicken Fingers', 525, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Popcorn', 525, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Peri Peri Shrimp Popcorn', 595, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Stir Fried Chicken And Veggies', 565, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Olive Parcel With BBQ Sauce', 475, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spicy Moroccan Chicken Kebab', 480, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Gyros With Hummus', 615, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Fish And Chips', 625, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Crunchy Fried Korean Chicken Wings', 575, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('BBQ Chicken Wings', 575, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Crispy Peri Peri Chicken Wings', 575, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Jamaican Chicken Skewers', 575, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Chops', 825, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Nuggets', 525, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mini Sliders Veg', 435, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mini Sliders Chicken', 465, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Garlic & Chilli Prawns', 625, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Turkish Alinazik Kebab', 520, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Roasted Butternut Pumpkin Soup', 345, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Stuffed Chicken Breast', 575, (SELECT id FROM categories WHERE name='Short Bites'), 'kitchen', true);

-- Pizza (15 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Margarita', 595, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Florentine', 645, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Ortolana Peri Peri Pizza', 645, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spinach Egg Pizza', 655, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Polo Ala Siciliana', 705, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Peri Peri Chicken', 725, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza With Smoked Chicken And Pickle Onion', 745, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Roma', 725, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Chicken Meat Ball', 735, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Formaggio', 645, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Mediterranean', 655, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Pesto Burrata', 825, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pizza Chorizo Jalapeno', 755, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Smoked Scamorza Cheese With Bacon', 755, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pork Pepperoni', 765, (SELECT id FROM categories WHERE name='Pizza'), 'kitchen', true);

-- Pasta (22 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Arrabbiata', 575, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Arrabbiata', 625, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Seafood Arrabbiata', 720, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Alfredo', 575, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Alfredo', 625, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Seafood Alfredo', 720, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Aglio E Olio', 575, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Aglio E Olio', 625, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Seafood Aglio E Olio', 720, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Creamy Pesto', 560, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Creamy Pesto', 615, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Seafood Creamy Pesto', 720, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Creamy Spinach', 585, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Creamy Spinach', 635, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Seafood Creamy Spinach', 720, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Goulash With Pasta', 750, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Ravioli', 595, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Ravioli', 650, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spaghetti Bacon', 645, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spinach Fettuccine', 595, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Beetroot Chicken Ravioli', 600, (SELECT id FROM categories WHERE name='Pasta'), 'kitchen', true);

-- Non Veg Mains (35 items - excl zero price)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Teriyaki Chicken Skewers With Garlic Butter Rice', 695, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Grilled Chicken Breast', 615, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Breast With Parmesan Cheese', 665, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Herb Butter Sole', 725, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Nasi Goreng', 645, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Prawn Nasi Goreng', 745, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pork Ribs With JD Barbeque Sauce', 795, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Grilled Jumbo Prawn', 825, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Grilled Chilli Lemon Prawn', 825, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Oriental Crab Meat With Pine Nuts And Rice', 775, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pollo Alla Funghi', 695, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Risotto Marinara', 775, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Chermoula With Saffron Rice', 695, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Shank', 825, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Roasted Turkey Roll', 850, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Red Wine Roasted Lamb', 650, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hainanese Chicken', 550, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Fish Papilote', 550, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Tagine', 775, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Tagine', 715, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Skewers With Jasmine Rice', 925, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chefs Spl Mutton Haleem', 520, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lamb Shank Shorba', 580, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Roasted Seabass', 725, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pan Seared Fish And Mashed Peas Rice Bowl', 745, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Asian Chicken And Nuts Stir Fry', 635, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Beer Garlic Chicken Noodle Stir Fry', 615, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Stuffed Chicken Breast', 575, (SELECT id FROM categories WHERE name='Non Veg Mains'), 'kitchen', true);

-- Veg Mains (8 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Creamy Spinach & Corn Cannelloni', 575, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Tofu Steak & Rice Bowl', 525, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cottage Cheese Steak', 525, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Risotto', 575, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mediterranean Grilled Vegetables', 525, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Nasi Goreng', 575, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Asian Tofu And Nuts Stir Fry', 575, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Veg Noodle Stir Fry', 525, (SELECT id FROM categories WHERE name='Veg Mains'), 'kitchen', true);

-- Breakfast (47 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Eggs To Order', 250, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Omelette', 270, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spanish Omelette', 330, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Shakshuka', 425, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Turkish Poached Egg', 330, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Herbed Baked Egg', 340, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('English Breakfast', 595, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Croissant Sandwich', 395, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Avocado Toast', 290, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pancake', 250, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Farmer Omelette', 325, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheese Omelette', 325, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spinach & Corn Omelette', 295, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Spanish Frittata', 325, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chicken Kheema & Broccoli', 375, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Avocado & Egg Open Sandwich', 425, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Italian Caprese Croissant', 470, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheesy Melty Sandwich', 400, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Egg & Mortadella Sandwich', 495, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Burrata Open Sandwich', 450, (SELECT id FROM categories WHERE name='Breakfast'), 'kitchen', true);

-- Coffee (36 items - excl alcohol: Irish Coffee, Baileys/Rum/Kahlua Hot Chocolate, zero price)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Espresso', 245, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Doppio', 275, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Caffe Americano', 245, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cold Caffe Americano', 245, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Cappuccino', 265, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cold Cappuccino', 265, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Latte', 265, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cold Latte', 265, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Caffe Mocha', 275, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Marocchino Corn Nutella', 325, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Flat White', 265, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Frappe Coffee', 325, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Choco Frappe', 345, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Chai Latte', 375, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cold Chai Latte', 375, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Affogato', 325, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Chocolate With Whipped Cream', 345, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Chocolate With Marshmallow Cream', 395, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Grande (Upgrade)', 70, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Rose Cappuccino', 299, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Rose Latte', 299, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Vanilla Syrup (Add-on)', 30, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hazelnut Syrup (Add-on)', 30, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Caramel Syrup (Add-on)', 30, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Vanilla Ice Cream Scoop', 60, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Moroccan Mint Tea', 320, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pour Over Hot', 275, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pour Over Cold', 475, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Aeropress', 260, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Oreo Caramel Banana Shake', 450, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cold Matcha', 365, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hot Matcha', 365, (SELECT id FROM categories WHERE name='Coffee'), 'cafe', true);

-- Cold Brew Coffee (5 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Nitro Cold Brew', 325, (SELECT id FROM categories WHERE name='Cold Brew Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Vanilla Cold Brew', 325, (SELECT id FROM categories WHERE name='Cold Brew Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hazelnut Cold Brew', 325, (SELECT id FROM categories WHERE name='Cold Brew Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Classic Cold Brew', 295, (SELECT id FROM categories WHERE name='Cold Brew Coffee'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Orange Cold Brew', 325, (SELECT id FROM categories WHERE name='Cold Brew Coffee'), 'cafe', true);

-- Tea (17 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Love Matcha', 365, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Matcha Tiramisu Latte', 375, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cranberry Matcha Iced', 345, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Matcha Latte', 365, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('English Breakfast Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Earl Grey', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Green Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chamomile Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Peppermint Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Darjeeling Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Rose Tea', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Moroccan Mint', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Kashmiri Kahwa', 345, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Authentic Moroccan Mint Tea', 450, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Masala Chai', 175, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cutting Chai', 99, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lemon Ginger Honey', 275, (SELECT id FROM categories WHERE name='Tea'), 'cafe', true);

-- Pop Tea (2 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pop Tea Strawberry', 345, (SELECT id FROM categories WHERE name='Pop Tea'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pop Tea Peach', 345, (SELECT id FROM categories WHERE name='Pop Tea'), 'cafe', true);

-- Milkshake (7 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Peanut Butter And Jelly', 395, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Oreo Cookie And Cream', 385, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Strawberry And Cream', 375, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Belgium Dark Chocolate', 425, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Toasted Marshmallow Smores', 415, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Love Shake', 450, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Lotus Biscoff Shake', 425, (SELECT id FROM categories WHERE name='Milkshake'), 'cafe', true);

-- Mocktail (23 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Summer Peach', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Tangy Strawberry', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Kiwi Punch', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Virgin Cucumber Martini', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Orange Twist', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Revitaliser', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Mango Smoothie', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Reloaded', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Banana And Orange Smoothie', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Ginger Julep', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Iced Tea', 475, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Virgin Mojito', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Virgin Pinacolada', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Virgin Mary', 305, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Caramel Apple Mocktail', 450, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Orange & Rosemary Fizz', 450, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pomegranate Mojito', 350, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Virgin Hot Toddy', 425, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Persian Rose', 450, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Apple Loves Caramel', 450, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Strawberry Basil Loveaid', 450, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Fresh Juice', 250, (SELECT id FROM categories WHERE name='Mocktail'), 'mocktail', true);

-- Beverages (Mixes Beverages - 22 items, renamed to Beverages)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hoegaarden Zero', 175, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Budweiser Zero', 175, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Coke', 200, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Diet Coke', 200, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Thumbs Up', 200, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Sprite', 200, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Tonic Water', 225, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Ginger Ale', 225, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Soda', 200, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Coconut Water', 120, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Red Bull', 375, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Canned Juice', 225, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Bisleri Water Bottle', 50, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Sparkling Perrier', 300, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('San Pellegrino', 300, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Acqua Panna', 575, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Water Bottle 500ml', 50, (SELECT id FROM categories WHERE name='Beverages'), 'mocktail', true);

-- Soda (6 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Green Apple Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Fresh Lemon Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Strawberry Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Peach Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Watermelon Mint Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cucumber Mint Soda', 370, (SELECT id FROM categories WHERE name='Soda'), 'mocktail', true);

-- Cold Pressed Juice (7 items)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Greens', 350, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Sweet Greens', 350, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Reds', 320, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Sweet Reds', 320, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Ambers', 320, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Pinks', 320, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Yellows', 320, (SELECT id FROM categories WHERE name='Cold Pressed Juice'), 'juice_bar', true);

-- Desserts (41 items - deduped, excl zero price)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Brownie With Espresso And Ice Cream', 415, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Banoffee Pie', 425, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cheese Cake', 415, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Tiramisu', 475, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Dutch Baby Pancake With Chocolate', 335, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Dutch Baby Pancake With Caramel Apple', 335, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Ferrero Cheese Cake', 325, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Red Velvet Tiramisu', 370, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Plum Cake', 425, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Gooey Cream Cake', 415, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Red Velvet Heart Cake', 300, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Strawberry Love Vanilla Cake', 300, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Creme Brulee', 425, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Baklava With Ice Cream', 350, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Apricot Compote With Custard Cream', 380, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Kahlua Chocolate Mousse', 475, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Basque Cheese Cake', 450, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cinnamon Twist Bun', 250, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Croissant', 150, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chocolate Chunky Cookie', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Walnut Raisin Cookie', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Brownie Marshmallow Cookie', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Blueberry Custard Croissant', 275, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Custard Croissant', 240, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Almond Croissant', 260, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Chocolate Cake', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Banana Cake', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Carrot Cake', 180, (SELECT id FROM categories WHERE name='Desserts'), 'cafe', true);

-- Extras (12 items - excl zero price)
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Extra Vegetables', 60, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Extra Loaf', 50, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Extra Mash Potato', 60, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Extra Bacon', 120, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Extra Chicken Breast', 100, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Cocktail Mixing', 100, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Vanilla (Add-on)', 30, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Caramel (Add-on)', 30, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Hazelnut (Add-on)', 30, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
INSERT INTO menu_items (name, price, category_id, station, is_active) VALUES ('Boiled Chicken', 150, (SELECT id FROM categories WHERE name='Extras'), 'kitchen', true);
