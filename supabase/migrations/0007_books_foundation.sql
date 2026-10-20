-- Maati Living — Books, Phase 1: stock ledger, cost price, vendors, audit log.
-- Run in Supabase → SQL Editor after 0006. TAKE A BACKUP FIRST and run on the dev/test project first.
--
-- Principles
--   * stock_movements is the single source of truth for every stock change. products.stock can only
--     change inside the approved functions below (a guard trigger blocks any other UPDATE of stock).
--   * Every money/stock function is one transaction: it either fully succeeds or RAISEs and rolls back.
--   * Admin-only everything (is_admin()), checked inside each function as well as by RLS.
--   * audit_log records who/what/before/after for every change to Books tables.

-- ---------------------------------------------------------------------------
-- 1. New columns (nothing dropped or rewritten)
-- ---------------------------------------------------------------------------

alter table public.products
  add column cost_price_paise int check (cost_price_paise >= 0),          -- weighted average cost; null = not set
  add column low_stock_threshold int check (low_stock_threshold >= 0);    -- null = shop default (5)

alter table public.order_items
  add column unit_cost_paise int check (unit_cost_paise >= 0);            -- cost snapshot when the order is paid

-- ---------------------------------------------------------------------------
-- 2. Audit log (written by trigger; readable by admins only)
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,                 -- auth.uid() of the admin; null only for system writes (payment gateway/webhook)
  actor_kind text not null,      -- 'user' | 'system'
  entity text not null,          -- table name
  entity_id text,
  action text not null,          -- insert | update | delete
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id, created_at desc);

alter table public.audit_log enable row level security;
create policy "Admins read audit log" on public.audit_log for select using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

create function public.audit_row()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, actor_kind, entity, entity_id, action, before, after)
  values (
    v_actor,
    case when v_actor is null then 'system' else 'user' end,
    tg_table_name,
    v_row ->> 'id',
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Stock ledger
-- ---------------------------------------------------------------------------

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict, -- history keeps the product
  qty_change int not null check (qty_change <> 0),
  reason text not null check (reason in ('opening_stock', 'purchase_receipt', 'order_paid', 'order_cancel_restock', 'manual_adjustment')),
  adjustment_reason text check (adjustment_reason in ('damaged', 'lost', 'sample', 'recount', 'other')),
  ref_type text check (ref_type in ('order', 'purchase', 'adjustment')),
  ref_id uuid,
  unit_cost_paise int check (unit_cost_paise >= 0),
  stock_after int not null check (stock_after >= 0),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (reason <> 'manual_adjustment' or adjustment_reason is not null)
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_ref_idx on public.stock_movements (ref_type, ref_id);

alter table public.stock_movements enable row level security;
create policy "Admins read stock movements" on public.stock_movements for select using (public.is_admin());
-- Immutable from the API: only the functions below write it.
revoke insert, update, delete on public.stock_movements from anon, authenticated;

create trigger stock_movements_audit after insert on public.stock_movements
  for each row execute function public.audit_row();

-- Guard: products.stock may only change inside an approved function (which sets maati.stock_write).
create function public.guard_stock_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stock is distinct from old.stock and coalesce(current_setting('maati.stock_write', true), '') <> 'on' then
    raise exception 'Stock can only change through a stock movement (use Adjust stock).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger products_guard_stock before update on public.products
  for each row execute function public.guard_stock_update();

-- New product created with initial stock → opening_stock movement, in the same transaction.
create function public.products_opening_stock()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.stock_movements (product_id, qty_change, reason, unit_cost_paise, stock_after, note)
    values (new.id, new.stock, 'opening_stock', new.cost_price_paise, new.stock, 'Initial stock when the product was created');
  end if;
  return null;
end;
$$;

create trigger products_opening_stock after insert on public.products
  for each row execute function public.products_opening_stock();

-- Products: audit cost / stock / price / visibility changes.
create trigger products_audit after update of stock, cost_price_paise, price_paise, low_stock_threshold, is_available on public.products
  for each row execute function public.audit_row();

-- Internal: change one product's stock and record the movement. Raises (rolls back the caller) if it would go
-- negative. Not callable from the API (no grant); used only by the security-definer functions below.
create function public._stock_move(
  p_product_id uuid, p_qty int, p_reason text, p_ref_type text, p_ref_id uuid,
  p_unit_cost int default null, p_note text default null, p_adjustment_reason text default null
)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  v_stock int;
begin
  if p_qty = 0 then
    return (select stock from public.products where id = p_product_id);
  end if;
  select stock into v_stock from public.products where id = p_product_id for update;
  if v_stock is null then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  if v_stock + p_qty < 0 then
    raise exception 'Not enough stock: % in stock, change of % would go below zero', v_stock, p_qty using errcode = 'P0001';
  end if;
  perform set_config('maati.stock_write', 'on', true);
  update public.products set stock = v_stock + p_qty where id = p_product_id;
  perform set_config('maati.stock_write', 'off', true);
  insert into public.stock_movements (product_id, qty_change, reason, adjustment_reason, ref_type, ref_id, unit_cost_paise, stock_after, note)
  values (p_product_id, p_qty, p_reason, p_adjustment_reason, p_ref_type, p_ref_id, p_unit_cost, v_stock + p_qty, p_note);
  return v_stock + p_qty;
end;
$$;

revoke execute on function public._stock_move(uuid, int, text, text, uuid, int, text, text) from public, anon, authenticated;

-- Backfill: one opening_stock movement per product that has stock today (cost unknown → null).
insert into public.stock_movements (product_id, qty_change, reason, unit_cost_paise, stock_after, note, created_by)
select id, stock, 'opening_stock', cost_price_paise, stock, 'Opening stock when the stock ledger started', null
from public.products
where stock > 0;

-- ---------------------------------------------------------------------------
-- 4. Existing order flows, now recording movements + cost snapshot (same stock behaviour)
-- ---------------------------------------------------------------------------

-- Internal: take an order's items out of stock exactly like before (never below zero: an oversold
-- line takes what's left), record movements, and snapshot each line's unit cost.
create function public._order_stock_out(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_stock int;
  v_take int;
begin
  for r in
    select oi.id as item_id, oi.product_id, oi.quantity, p.cost_price_paise
      from public.order_items oi
      join public.products p on p.id = oi.product_id
     where oi.order_id = p_order_id
     order by oi.id
  loop
    update public.order_items set unit_cost_paise = r.cost_price_paise where id = r.item_id;
    select stock into v_stock from public.products where id = r.product_id for update;
    v_take := least(r.quantity, v_stock);
    if v_take > 0 then
      perform public._stock_move(r.product_id, -v_take, 'order_paid', 'order', p_order_id, r.cost_price_paise,
        case when v_take < r.quantity then format('Oversold: ordered %s, only %s in stock', r.quantity, v_take) end);
    end if;
  end loop;
end;
$$;

revoke execute on function public._order_stock_out(uuid) from public, anon, authenticated;

create or replace function public.mark_order_paid(p_razorpay_order_id text, p_payment_id text)
returns table (order_id uuid, newly_paid boolean)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  update public.orders
     set status = 'paid', razorpay_payment_id = p_payment_id, paid_at = now()
   where razorpay_order_id = p_razorpay_order_id and status in ('pending', 'failed')
   returning id into v_id;

  if v_id is null then
    return query select o.id, false from public.orders o where o.razorpay_order_id = p_razorpay_order_id;
    return;
  end if;

  perform public._order_stock_out(v_id);
  return query select v_id, true;
end;
$$;

revoke execute on function public.mark_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text) to service_role;

create or replace function public.admin_confirm_manual_payment(p_order_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.orders
     set status = 'paid', paid_at = now()
   where id = p_order_id and payment_method = 'upi_manual' and status = 'pending'
   returning id into v_id;
  if v_id is null then
    return false; -- already confirmed / not an unpaid UPI order: nothing was written
  end if;

  perform public._order_stock_out(v_id);
  return true;
end;
$$;

create or replace function public.admin_restock_order(p_order_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  update public.orders set restocked = true
   where id = p_order_id and not restocked and status in ('cancelled', 'refunded') and paid_at is not null
   returning id into v_id;
  if v_id is null then
    return false; -- already restocked / not eligible: nothing was written
  end if;

  for r in select product_id, sum(quantity)::int as qty from public.order_items where order_id = v_id and product_id is not null group by product_id loop
    perform public._stock_move(r.product_id, r.qty, 'order_cancel_restock', 'order', v_id, null, null);
  end loop;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Manual stock adjustment and cost price (admin)
-- ---------------------------------------------------------------------------

create function public.books_adjust_stock(p_product_id uuid, p_qty_change int, p_reason text, p_note text default null)
returns int
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_qty_change is null or p_qty_change = 0 then
    raise exception 'Enter how many to add or remove (not 0).' using errcode = 'P0001';
  end if;
  if p_reason not in ('damaged', 'lost', 'sample', 'recount', 'other') then
    raise exception 'Choose a reason for the adjustment.' using errcode = 'P0001';
  end if;
  if p_reason = 'other' and coalesce(btrim(p_note), '') = '' then
    raise exception 'Add a note explaining the adjustment.' using errcode = 'P0001';
  end if;
  return public._stock_move(p_product_id, p_qty_change, 'manual_adjustment', 'adjustment', null,
    (select cost_price_paise from public.products where id = p_product_id), nullif(btrim(p_note), ''), p_reason);
end;
$$;

revoke execute on function public.books_adjust_stock(uuid, int, text, text) from public, anon;
grant execute on function public.books_adjust_stock(uuid, int, text, text) to authenticated; -- is_admin() inside

create function public.books_set_cost_price(p_product_id uuid, p_cost_paise int)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_cost_paise is not null and p_cost_paise < 0 then
    raise exception 'Cost price can''t be negative.' using errcode = 'P0001';
  end if;
  update public.products set cost_price_paise = p_cost_paise where id = p_product_id;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.books_set_cost_price(uuid, int) from public, anon;
grant execute on function public.books_set_cost_price(uuid, int) to authenticated; -- is_admin() inside

-- ---------------------------------------------------------------------------
-- 6. Vendors
-- ---------------------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  contact_person text,
  phone text check (phone ~ '^[6-9][0-9]{9}$'),
  whatsapp text check (whatsapp ~ '^[6-9][0-9]{9}$'),
  email text,
  city text,
  state text,
  address text,
  gstin text check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  pan text check (pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  upi_id text,
  bank_account_name text,
  bank_account_number text check (bank_account_number ~ '^[0-9]{9,18}$'),
  bank_ifsc text check (bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  supplies text,                       -- free tags, e.g. "diyas, coconut shell"
  notes text,
  rating int check (rating between 1 and 5),
  payment_terms_days int not null default 0 check (payment_terms_days between 0 and 365),
  opening_balance_paise int not null default 0,   -- what we owed them on day one (negative = advance)
  status text not null default 'active' check (status in ('active', 'archived')),
  archived_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendors_status_idx on public.vendors (status, name);

create trigger vendors_touch_updated_at before update on public.vendors
  for each row execute function public.touch_updated_at();
create trigger vendors_audit after insert or update or delete on public.vendors
  for each row execute function public.audit_row();

alter table public.vendors enable row level security;
create policy "Admins read vendors" on public.vendors for select using (public.is_admin());
create policy "Admins add vendors" on public.vendors for insert with check (public.is_admin());
create policy "Admins edit vendors" on public.vendors for update using (public.is_admin()) with check (public.is_admin());
-- No delete policy: vendors are archived, never deleted.

create table public.vendor_products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  vendor_sku text,
  last_cost_paise int check (last_cost_paise >= 0),
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, product_id)
);

create unique index vendor_products_one_preferred_idx on public.vendor_products (product_id) where is_preferred;

create trigger vendor_products_touch_updated_at before update on public.vendor_products
  for each row execute function public.touch_updated_at();
create trigger vendor_products_audit after insert or update or delete on public.vendor_products
  for each row execute function public.audit_row();

alter table public.vendor_products enable row level security;
create policy "Admins manage vendor products" on public.vendor_products
  for all using (public.is_admin()) with check (public.is_admin());

-- Make a vendor the preferred supplier of a product (clears the previous one) in one step.
create function public.books_set_preferred_vendor(p_vendor_id uuid, p_product_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update public.vendor_products set is_preferred = false where product_id = p_product_id and is_preferred and vendor_id <> p_vendor_id;
  update public.vendor_products set is_preferred = true where product_id = p_product_id and vendor_id = p_vendor_id;
  if not found then
    raise exception 'This vendor doesn''t supply that product yet.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.books_set_preferred_vendor(uuid, uuid) from public, anon;
grant execute on function public.books_set_preferred_vendor(uuid, uuid) to authenticated; -- is_admin() inside
