-- DEMO DATA for testing the Books module on a DEV/TEST project only. Never run on production.
-- Not a migration: lives outside supabase/migrations so it can't be applied by accident with them.
-- Everything is named "DEMO" so it's easy to spot. Phase 2 added purchases; Phases 3–4 add payments and expenses.
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

-- Phase 2: three DEMO purchases (needs 0008) — one draft, two ordered — so you can try Receive items.
-- Inserted directly (the SQL Editor runs as the database owner); the app itself only writes through the functions.
do $$
declare
  v_potters uuid := (select id from public.vendors where name = 'DEMO Molela Potters');
  v_shells uuid := (select id from public.vendors where name = 'DEMO Kerala Shell Works');
  v_id uuid;
begin
  if v_potters is null or v_shells is null then
    raise notice 'Run the demo vendors block first.';
    return;
  end if;
  if exists (select 1 from public.purchases where notes like 'DEMO%') then
    raise notice 'Demo purchases already exist — skipping.';
    return;
  end if;

  -- 1. Ordered from the potters, bill already in, with freight.
  insert into public.purchases (number, vendor_id, status, order_date, expected_date, bill_number, bill_date, due_date, ordered_at, notes)
  values ('PO-' || nextval('public.purchase_number_seq'), v_potters, 'ordered', current_date - 6, current_date + 2, 'DEMO-INV-17', current_date - 5, current_date + 10, now(), 'DEMO purchase for testing')
  returning id into v_id;
  insert into public.purchase_items (purchase_id, product_id, qty_ordered, unit_cost_paise, line_total_paise, sort_order)
  select v_id, id, 20, 18000, 20 * 18000, 0 from public.products where slug = 'terracotta-diya-set-of-6';
  perform public._purchase_recalc(v_id, 0, 30000, 0);

  -- 2. Ordered from the shell artisans, two products, small discount.
  insert into public.purchases (number, vendor_id, status, order_date, expected_date, ordered_at, notes)
  values ('PO-' || nextval('public.purchase_number_seq'), v_shells, 'ordered', current_date - 3, current_date + 7, now(), 'DEMO purchase for testing')
  returning id into v_id;
  insert into public.purchase_items (purchase_id, product_id, qty_ordered, unit_cost_paise, line_total_paise, sort_order)
  select v_id, id, qty, cost, qty * cost, sort from (values ('coconut-shell-hanging-planter', 12, 24050, 0), ('coconut-shell-agarbatti-stand', 15, 9000, 1)) as l(slug, qty, cost, sort)
  join public.products p on p.slug = l.slug;
  perform public._purchase_recalc(v_id, 5000, 12000, 0);

  -- 3. A draft not sent yet.
  insert into public.purchases (number, vendor_id, notes)
  values ('PO-' || nextval('public.purchase_number_seq'), v_potters, 'DEMO draft for testing')
  returning id into v_id;
  insert into public.purchase_items (purchase_id, product_id, qty_ordered, unit_cost_paise, line_total_paise, sort_order)
  select v_id, id, 30, 17500, 30 * 17500, 0 from public.products where slug = 'terracotta-diya-set-of-6';
  perform public._purchase_recalc(v_id);
end $$;

-- ---------------------------------------------------------------------------
-- REMOVE DEMO DATA (run separately). Vendors have no delete policy for the app, but the SQL Editor
-- runs as the database owner, so this works here only.
-- ---------------------------------------------------------------------------
-- Purchases first. If you RECEIVED a demo purchase, its stock stayed: use Adjust stock on those products to take
-- it back out (reason "recount", note "demo removed") before or after deleting — the stock history keeps both rows.
-- delete from public.purchase_items where purchase_id in (select id from public.purchases where notes like 'DEMO%');
-- delete from public.purchases where notes like 'DEMO%';
-- delete from public.vendor_products where vendor_id in (select id from public.vendors where name like 'DEMO %');
-- delete from public.vendors where name like 'DEMO %';
