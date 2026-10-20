-- DEMO DATA for testing the Books module on a DEV/TEST project only. Never run on production.
-- Not a migration: lives outside supabase/migrations so it can't be applied by accident with them.
-- Everything is named "DEMO" so it's easy to spot. Phases 2–4 extend this file (purchases, payments, expenses).
--
-- Run in the SQL Editor of the test project. To remove, run the block at the bottom.

do $$
begin
  if exists (select 1 from public.vendors where name like 'DEMO %') then
    raise notice 'Demo vendors already exist — skipping.';
    return;
  end if;

  insert into public.vendors (name, contact_person, phone, city, state, supplies, payment_terms_days, opening_balance_paise, upi_id, notes)
  values
    ('DEMO Molela Potters', 'Ramesh', '9876500001', 'Molela', 'Rajasthan', 'diyas, terracotta', 15, 250000, 'demo.potters@ybl', 'DEMO vendor for testing'),
    ('DEMO Kerala Shell Works', 'Lakshmi', '9876500002', 'Thrissur', 'Kerala', 'coconut shell', 30, 0, null, 'DEMO vendor for testing');

  insert into public.vendor_products (vendor_id, product_id, last_cost_paise, is_preferred)
  select v.id, p.id, (p.price_paise * 45 / 100), true
    from public.vendors v
    join public.products p on (v.name = 'DEMO Molela Potters' and p.slug = 'terracotta-diya-set-of-6')
                           or (v.name = 'DEMO Kerala Shell Works' and p.slug in ('coconut-shell-hanging-planter', 'coconut-shell-agarbatti-stand'))
   on conflict do nothing;
end $$;

-- ---------------------------------------------------------------------------
-- REMOVE DEMO DATA (run separately). Vendors have no delete policy for the app, but the SQL Editor
-- runs as the database owner, so this works here only.
-- ---------------------------------------------------------------------------
-- delete from public.vendor_products where vendor_id in (select id from public.vendors where name like 'DEMO %');
-- delete from public.vendors where name like 'DEMO %';
