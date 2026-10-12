-- Starter catalogue (mirrors src/data/*). Optional — run after the migration, then edit in /admin.

insert into public.categories (slug, name, description, image_public_id, image_alt, sort_order) values
  ('diyas', 'Diyas', 'Hand-thrown terracotta diyas for festivals, puja and quiet evenings.', 'maati-living/categories/diyas', 'Terracotta diyas glowing in the evening', 1),
  ('coconut-shell', 'Coconut shell', 'Planters, stands and everyday pieces shaped from discarded coconut shells.', 'maati-living/categories/coconut-shell', 'Polished coconut shell products on a wooden table', 2);

insert into public.products (slug, name, category_id, price_paise, stock, short_description, sourcing_note, materials, artisan, region, care, is_featured, sku) values
  ('terracotta-diya-set-of-6', 'Terracotta Diya Set of 6', (select id from public.categories where slug = 'diyas'), 45000, 40,
   'Hand-thrown clay diyas for Diwali, puja or a quiet evening glow.', 'Wheel-thrown by potters in Rajasthan',
   array['Natural terracotta clay', 'Cotton wick'], 'Family pottery workshop', 'Molela, Rajasthan',
   'Wipe clean with a dry cloth. Soak in water for a few minutes before first use so the clay absorbs less oil.', true, 'ML-DIY-001'),
  ('coconut-shell-hanging-planter', 'Coconut Shell Hanging Planter', (select id from public.categories where slug = 'coconut-shell'), 54900, 25,
   'A polished half-shell planter on jute rope, for small greens and succulents.', 'Shaped from discarded shells in Kerala',
   array['Upcycled coconut shell', 'Jute rope', 'Natural lacquer finish'], 'Women-led coconut craft collective', 'Thrissur, Kerala',
   'Keep out of standing water; wipe the outside with a damp cloth. Re-oil with coconut oil if it looks dry.', true, 'ML-CSP-002'),
  ('coconut-shell-agarbatti-stand', 'Coconut Shell Agarbatti Stand', (select id from public.categories where slug = 'coconut-shell'), 29900, 30,
   'A hand-carved stand that holds incense upright and catches the ash.', 'Hand carved by coconut-shell artisans',
   array['Upcycled coconut shell', 'Natural lacquer finish'], 'Independent shell carver', 'Kozhikode, Kerala',
   'Empty ash after each use and wipe with a dry cloth.', true, 'ML-CSA-003');
