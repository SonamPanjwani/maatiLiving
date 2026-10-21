-- DEMO DATA for testing the Books module on a DEV/TEST project only. Never run on production.
-- Not a migration: lives outside supabase/migrations so it can't be applied by accident with them.
-- Everything is named "DEMO" so it's easy to spot. Phase 4 will add expenses here.
--
-- HOW TO RUN: SQL Editor → New query → paste this whole file → Run. Safe to run again: it only adds what's
-- missing. The results panel then lists every DEMO vendor and purchase — if it's empty, something stopped it
-- and the error is shown instead. To remove the demo data, run the block at the bottom.
-- Needs migrations 0007, 0008 and 0010. Inserted directly (the SQL Editor runs as the database owner); the app
-- itself only writes purchases through the Books functions.

do $$
declare
  v_potters uuid;
  v_shells uuid;
  v_id uuid;
begin
  if to_regclass('public.vendors') is null or to_regclass('public.purchases') is null or to_regclass('public.vendor_payments') is null then
    raise exception 'Run migrations 0007, 0008 and 0010 first, then this file.';
  end if;

  -- Vendors (created if missing)
  insert into public.vendors (name, contact_person, phone, city, state, supplies, payment_terms_days, opening_balance_paise, upi_id, notes)
  select 'DEMO Molela Potters', 'Ramesh', '9876500001', 'Molela', 'Rajasthan', 'diyas, terracotta', 15, 250000, 'demo.potters@ybl', 'DEMO vendor for testing'
  where not exists (select 1 from public.vendors where name = 'DEMO Molela Potters');
  insert into public.vendors (name, contact_person, phone, city, state, supplies, payment_terms_days, opening_balance_paise, notes)
  select 'DEMO Kerala Shell Works', 'Lakshmi', '9876500002', 'Thrissur', 'Kerala', 'coconut shell', 30, 0, 'DEMO vendor for testing'
  where not exists (select 1 from public.vendors where name = 'DEMO Kerala Shell Works');
  v_potters := (select id from public.vendors where name = 'DEMO Molela Potters');
  v_shells := (select id from public.vendors where name = 'DEMO Kerala Shell Works');

  -- Products they supply (preferred only where the product has no preferred vendor yet)
  insert into public.vendor_products (vendor_id, product_id, last_cost_paise, is_preferred)
  select v.id, p.id, p.price_paise * 45 / 100,
         not exists (select 1 from public.vendor_products vp where vp.product_id = p.id and vp.is_preferred)
    from public.vendors v
    join public.products p on (v.id = v_potters and p.slug = 'terracotta-diya-set-of-6')
                           or (v.id = v_shells and p.slug in ('coconut-shell-hanging-planter', 'coconut-shell-agarbatti-stand'))
  on conflict (vendor_id, product_id) do nothing;

  if exists (select 1 from public.purchases where notes like 'DEMO%') then
    return; -- demo purchases already there
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
  select v_id, p.id, l.qty, l.cost, l.qty * l.cost, l.sort
    from (values ('coconut-shell-hanging-planter', 12, 24050, 0), ('coconut-shell-agarbatti-stand', 15, 9000, 1)) as l(slug, qty, cost, sort)
    join public.products p on p.slug = l.slug;
  perform public._purchase_recalc(v_id, 5000, 12000, 0);

  -- 3. A draft not sent yet.
  insert into public.purchases (number, vendor_id, notes)
  values ('PO-' || nextval('public.purchase_number_seq'), v_potters, 'DEMO draft for testing')
  returning id into v_id;
  insert into public.purchase_items (purchase_id, product_id, qty_ordered, unit_cost_paise, line_total_paise, sort_order)
  select v_id, id, 30, 17500, 30 * 17500, 0 from public.products where slug = 'terracotta-diya-set-of-6';
  perform public._purchase_recalc(v_id);

  -- Lines need these three products (they're in the starter catalogue). Without them, stop with a clear error.
  if exists (select 1 from public.purchases p where p.notes like 'DEMO%' and not exists (select 1 from public.purchase_items i where i.purchase_id = p.id)) then
    raise exception 'Demo purchases need the starter products terracotta-diya-set-of-6, coconut-shell-hanging-planter and coconut-shell-agarbatti-stand.';
  end if;
end $$;

-- Payments. One to the potters (auto-allocated: opening balance first, then the billed purchase),
-- one to the shell artisans with no bill yet (so it stays as an advance).
do $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.vendor_payments where notes like 'DEMO%') then
    return;
  end if;
  insert into public.vendor_payments (number, vendor_id, amount_paise, paid_on, method, reference, notes)
  select 'PAY-' || nextval('public.payment_number_seq'), id, 300000, current_date - 2, 'upi', 'DEMO-UTR-1', 'DEMO payment for testing'
    from public.vendors where name = 'DEMO Molela Potters'
  returning id into v_id;
  if v_id is not null then perform public._apply_payment_allocations(v_id, null); end if;
  insert into public.vendor_payments (number, vendor_id, amount_paise, paid_on, method, notes)
  select 'PAY-' || nextval('public.payment_number_seq'), id, 100000, current_date - 1, 'cash', 'DEMO advance for testing'
    from public.vendors where name = 'DEMO Kerala Shell Works';
end $$;

-- What's there now (shown in the results panel).
select 'vendor' as kind, name as demo, status, null::text as total
  from public.vendors where name like 'DEMO %'
union all
select 'purchase', p.number || ' · ' || v.name, p.status, '₹' || (p.total_paise / 100.0)::numeric(12, 2)
  from public.purchases p join public.vendors v on v.id = p.vendor_id where p.notes like 'DEMO%'
union all
select 'payment', p.number || ' · ' || v.name, p.status, '₹' || (p.amount_paise / 100.0)::numeric(12, 2)
  from public.vendor_payments p join public.vendors v on v.id = p.vendor_id where p.notes like 'DEMO%'
order by 1 desc, 2;

-- ---------------------------------------------------------------------------
-- REMOVE DEMO DATA (run separately). Vendors and purchases have no delete rights in the app, but the SQL
-- Editor runs as the database owner, so this works here only.
-- If you RECEIVED a demo purchase, its stock stayed: use Adjust stock on those products to take it back out
-- (reason "recount", note "demo removed") — the stock history keeps both rows.
-- ---------------------------------------------------------------------------
-- delete from public.vendor_payment_allocations where payment_id in (select id from public.vendor_payments where notes like 'DEMO%');
-- delete from public.vendor_payments where notes like 'DEMO%';
-- delete from public.purchase_items where purchase_id in (select id from public.purchases where notes like 'DEMO%');
-- delete from public.purchases where notes like 'DEMO%';
-- delete from public.vendor_products where vendor_id in (select id from public.vendors where name like 'DEMO %');
-- delete from public.vendors where name like 'DEMO %';
