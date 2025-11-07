-- Seed shared category templates

CREATE UNIQUE INDEX IF NOT EXISTS category_templates_unique_name
  ON public.category_templates (lower(name));

INSERT INTO public.category_templates (id, name, description)
VALUES
  (uuid_generate_v4(), 'Vegetables & Fruits', 'Use for fresh produce: leafy greens, root vegetables, herbs, and seasonal fruits.'),
  (uuid_generate_v4(), 'Dairy & Breakfast', 'Milk, yogurt, butter, eggs, cereals, spreads, and other morning essentials.'),
  (uuid_generate_v4(), 'Munchies', 'Packaged snacks such as chips, namkeen, popcorn, nachos, and trail mixes.'),
  (uuid_generate_v4(), 'Cold Drinks & Juices', 'Soft drinks, flavored water, energy drinks, and packaged fruit juices.'),
  (uuid_generate_v4(), 'Instant & Frozen Food', 'Ready-to-cook noodles, pastas, gravies, frozen parathas, fries, and meals.'),
  (uuid_generate_v4(), 'Tea, Coffee & Milk Drinks', 'Tea leaves, coffee beans or mixes, powdered drinks, creamers, and flavored milk.'),
  (uuid_generate_v4(), 'Bakery & Biscuits', 'Fresh bakery goods, breads, buns, cakes, rusks, cookies, and biscuits.'),
  (uuid_generate_v4(), 'Sweet Tooth', 'Chocolates, candies, mithai, desserts, and other confectionery items.'),
  (uuid_generate_v4(), 'Atta, Rice & Dal', 'Core staples: wheat flour, multigrain atta, rice varieties, lentils, and pulses.'),
  (uuid_generate_v4(), 'Dry Fruits, Masala & Oil', 'Nuts, seeds, whole spices, masala mixes, edible oils, and ghee.'),
  (uuid_generate_v4(), 'Sauces & Spreads', 'Ketchup, mayonnaise, mustard, chutneys, sandwich spreads, and dips.'),
  (uuid_generate_v4(), 'Chicken, Meat & Fish', 'Fresh or frozen poultry, mutton, seafood, and processed meat products.'),
  (uuid_generate_v4(), 'Paan Corner', 'Betel leaves, supari, mouth fresheners, sweet paan fillings, and accessories.'),
  (uuid_generate_v4(), 'Organic & Premium', 'Certified organic groceries, gourmet imports, specialty health and wellness items.'),
  (uuid_generate_v4(), 'Baby Care', 'Infant nutrition, diapers, wipes, toiletries, and baby health essentials.'),
  (uuid_generate_v4(), 'Pharma & Wellness', 'OTC medicines, supplements, first-aid, diagnostic kits, and health monitors.'),
  (uuid_generate_v4(), 'Cleaning Essentials', 'Household cleaners, detergents, dishwash, disinfectants, and mops.'),
  (uuid_generate_v4(), 'Home Furnishing & Decor', 'Bedsheets, quilts, towels, storage, decor accents, candles, and organisers.'),
  (uuid_generate_v4(), 'Personal Care', 'Bath, body, haircare, grooming, deodorants, and daily hygiene products.'),
  (uuid_generate_v4(), 'Pet Care', 'Cat and dog food, treats, vitamins, grooming tools, toys, and litter essentials.')
ON CONFLICT (lower(name)) DO UPDATE
SET description = EXCLUDED.description,
    updated_at = timezone('utc'::TEXT, now());


