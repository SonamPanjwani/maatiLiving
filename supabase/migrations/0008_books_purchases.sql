-- Maati Living — Books, Phase 2: purchases (purchase order + bill), receiving stock, landed + weighted average cost.
-- Run in Supabase → SQL Editor after 0007. TAKE A BACKUP FIRST and run on the dev/test project first.
-- Nothing existing is dropped or rewritten; books_set_cost_price is replaced with a stricter version (cost > 0).
--
-- Rules
--   * Purchases and their lines are written only through the functions below (one transaction each, RAISE on
--     any problem so nothing half-saves). The API can read them (admins) but not insert/update/delete directly.
--   * Once anything has been received, a purchase can't be cancelled and its lines / amounts can't change;
--     corrections go through Adjust stock plus a note on the purchase. Bill details, notes and files stay editable.
--   * Receiving: stock up (purchase_receipt movement), landed unit cost = unit cost with the purchase's
--     shipping minus discount spread by line value, product cost = weighted average (first receipt sets it
--     when the cost isn't known yet), vendor's last cost updated.
--   * Receiving more than ordered is allowed only when the admin confirmed it (p_allow_over); the bill
--     then counts the pieces actually received for that line.

-- ---------------------------------------------------------------------------
-- 1. Cost price must be more than ₹0 (blank/null still clears it)
-- ---------------------------------------------------------------------------

create or replace function public.books_set_cost_price(p_product_id uuid, p_cost_paise int)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_cost_paise is not null and p_cost_paise <= 0 then
    raise exception 'Cost price must be more than ₹0. Leave it blank if you don''t know it yet.' using errcode = 'P0001';
  end if;
  update public.products set cost_price_paise = p_cost_paise where id = p_product_id;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

create sequence public.purchase_number_seq start 1001;
revoke all on sequence public.purchase_number_seq from public, anon, authenticated;

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                       -- PO-1001, PO-1002, …
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  order_date date not null default ((now() at time zone 'Asia/Kolkata')::date),
  expected_date date,
  bill_number text check (char_length(bill_number) <= 60),
  bill_date date,
  bill_attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(bill_attachments) = 'array'),
  subtotal_paise int not null default 0 check (subtotal_paise >= 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  shipping_paise int not null default 0 check (shipping_paise >= 0),   -- freight we paid on this purchase
  tax_paise int not null default 0 check (tax_paise >= 0),             -- optional, for future GST
  total_paise int not null default 0,
  due_date date,                                                       -- bill date + vendor's payment terms (editable)
  notes text check (char_length(notes) <= 2000),
  ordered_at timestamptz,
  received_at timestamptz,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_paise <= subtotal_paise),
  check (total_paise = subtotal_paise - discount_paise + shipping_paise + tax_paise),
  check (status <> 'cancelled' or cancelled_reason is not null)
);

create index purchases_status_idx on public.purchases (status, order_date desc);
create index purchases_vendor_idx on public.purchases (vendor_id, order_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  qty_ordered int not null check (qty_ordered > 0),
  qty_received int not null default 0 check (qty_received >= 0),
  unit_cost_paise int not null check (unit_cost_paise >= 0),
  tax_rate numeric(5, 2) check (tax_rate between 0 and 100),          -- optional, informational
  line_total_paise int not null,                                       -- billed qty × unit cost
  landed_unit_cost_paise int check (landed_unit_cost_paise >= 0),      -- set when received
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_id, product_id),
  -- Billed qty is what was ordered, or what was received if more arrived (and the admin accepted it).
  check (line_total_paise = greatest(qty_ordered, qty_received) * unit_cost_paise)
);

create index purchase_items_product_idx on public.purchase_items (product_id);

create trigger purchases_touch_updated_at before update on public.purchases
  for each row execute function public.touch_updated_at();
create trigger purchase_items_touch_updated_at before update on public.purchase_items
  for each row execute function public.touch_updated_at();
create trigger purchases_audit after insert or update or delete on public.purchases
  for each row execute function public.audit_row();
create trigger purchase_items_audit after insert or update or delete on public.purchase_items
  for each row execute function public.audit_row();

alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
create policy "Admins read purchases" on public.purchases for select using (public.is_admin());
create policy "Admins read purchase items" on public.purchase_items for select using (public.is_admin());
-- Writes only through the functions below.
revoke insert, update, delete on public.purchases, public.purchase_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Costing helpers (pure; mirrored in src/lib/books/purchases.js and unit-tested)
-- ---------------------------------------------------------------------------

-- Landed unit cost: the purchase's shipping minus discount is spread across lines in proportion to line value,
-- so each piece carries the same share per rupee. With a zero-value purchase it's spread per piece instead.
create function public._landed_unit_cost(p_unit_cost int, p_subtotal int, p_shipping int, p_discount int, p_total_qty int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_subtotal > 0 then round(p_unit_cost::numeric * (p_subtotal + p_shipping - p_discount) / p_subtotal)::int
    when p_total_qty > 0 then greatest(round(p_unit_cost + (p_shipping - p_discount)::numeric / p_total_qty), 0)::int
    else p_unit_cost
  end
$$;

-- Weighted average cost after receiving p_qty pieces at p_landed. Unknown (null) old cost counts as the
-- incoming landed cost, so the first receipt sets the cost.
create function public._weighted_cost(p_old_stock int, p_old_cost int, p_qty int, p_landed int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_old_cost is null or p_old_stock <= 0 then p_landed
    else round((p_old_stock::numeric * p_old_cost + p_qty::numeric * p_landed) / (p_old_stock + p_qty))::int
  end
$$;

-- Recompute a purchase's subtotal and total from its lines, optionally setting new discount / shipping / tax
-- (null = keep) in the same statement so the row's checks always see consistent numbers.
create function public._purchase_recalc(p_purchase_id uuid, p_discount int default null, p_shipping int default null, p_tax int default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_subtotal int;
  v public.purchases;
begin
  select * into v from public.purchases where id = p_purchase_id;
  select coalesce(sum(line_total_paise), 0) into v_subtotal from public.purchase_items where purchase_id = p_purchase_id;
  if coalesce(p_discount, v.discount_paise) > v_subtotal then
    raise exception 'The discount can''t be more than the items total.' using errcode = 'P0001';
  end if;
  update public.purchases
     set subtotal_paise = v_subtotal,
         discount_paise = coalesce(p_discount, v.discount_paise),
         shipping_paise = coalesce(p_shipping, v.shipping_paise),
         tax_paise = coalesce(p_tax, v.tax_paise),
         total_paise = v_subtotal - coalesce(p_discount, v.discount_paise) + coalesce(p_shipping, v.shipping_paise) + coalesce(p_tax, v.tax_paise)
   where id = p_purchase_id;
end;
$$;

revoke execute on function public._landed_unit_cost(int, int, int, int, int) from public, anon, authenticated;
revoke execute on function public._weighted_cost(int, int, int, int) from public, anon, authenticated;
revoke execute on function public._purchase_recalc(uuid, int, int, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Save a purchase (create or edit) — header + lines in one transaction
-- ---------------------------------------------------------------------------
-- p_header: { order_date, expected_date, bill_number, bill_date, due_date, discount_paise, shipping_paise,
--             tax_paise, notes, bill_attachments, mark_ordered }  (dates as YYYY-MM-DD, amounts in paise)
-- p_items:  [{ product_id, qty, unit_cost_paise, tax_rate }] — or null to keep the lines (bill/notes-only edit).

create function public.books_save_purchase(p_id uuid, p_vendor_id uuid, p_header jsonb, p_items jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.purchases;
  v_id uuid := p_id;
  v_terms int;
  v_locked boolean := false;
  v_item jsonb;
  v_qty int;
  v_cost int;
  v_rate numeric;
  v_product uuid;
  v_seen uuid[] := '{}';
  v_sort int := 0;
  v_bill_date date := nullif(p_header ->> 'bill_date', '')::date;
  v_attachments jsonb := coalesce(p_header -> 'bill_attachments', '[]'::jsonb);
  v_att jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  -- Attachments: Cloudinary files in the private bills folder only.
  if jsonb_typeof(v_attachments) <> 'array' or jsonb_array_length(v_attachments) > 20 then
    raise exception 'Up to 20 bill files per purchase.' using errcode = 'P0001';
  end if;
  for v_att in select * from jsonb_array_elements(v_attachments) loop
    if coalesce(v_att ->> 'publicId', '') !~ '^maati-living/bills/[A-Za-z0-9_/-]+$' then
      raise exception 'A bill file is not from the bills upload folder.' using errcode = 'P0001';
    end if;
  end loop;

  if v_id is not null then
    select * into v from public.purchases where id = v_id for update;
    if not found then
      raise exception 'Purchase not found' using errcode = 'P0002';
    end if;
    if v.status = 'cancelled' then
      raise exception 'This purchase is cancelled and can''t be changed.' using errcode = 'P0001';
    end if;
    v_locked := v.status in ('partially_received', 'received')
      or exists (select 1 from public.purchase_items where purchase_id = v_id and qty_received > 0);
    if v_locked then
      if p_items is not null then
        raise exception 'Items can''t be edited after stock has been received. Use Adjust stock and add a note.' using errcode = 'P0001';
      end if;
      if p_vendor_id is distinct from v.vendor_id
         or coalesce((p_header ->> 'discount_paise')::int, v.discount_paise) <> v.discount_paise
         or coalesce((p_header ->> 'shipping_paise')::int, v.shipping_paise) <> v.shipping_paise
         or coalesce((p_header ->> 'tax_paise')::int, v.tax_paise) <> v.tax_paise then
        raise exception 'Vendor and amounts are locked once stock has been received.' using errcode = 'P0001';
      end if;
    elsif p_items is null then
      raise exception 'Add at least one item.' using errcode = 'P0001';
    end if;
  elsif p_items is null then
    raise exception 'Add at least one item.' using errcode = 'P0001';
  end if;

  select payment_terms_days into v_terms from public.vendors
   where id = p_vendor_id and (status = 'active' or p_vendor_id = v.vendor_id);
  if v_terms is null then
    raise exception 'Choose an active vendor.' using errcode = 'P0001';
  end if;

  if coalesce((p_header ->> 'discount_paise')::int, 0) < 0 or coalesce((p_header ->> 'shipping_paise')::int, 0) < 0
     or coalesce((p_header ->> 'tax_paise')::int, 0) < 0 then
    raise exception 'Amounts can''t be negative.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into public.purchases (number, vendor_id, order_date)
    values ('PO-' || nextval('public.purchase_number_seq'), p_vendor_id,
            coalesce(nullif(p_header ->> 'order_date', '')::date, (now() at time zone 'Asia/Kolkata')::date))
    returning id into v_id;
  end if;

  update public.purchases set
    vendor_id = p_vendor_id,
    order_date = coalesce(nullif(p_header ->> 'order_date', '')::date, order_date),
    expected_date = nullif(p_header ->> 'expected_date', '')::date,
    bill_number = nullif(btrim(p_header ->> 'bill_number'), ''),
    bill_date = v_bill_date,
    due_date = coalesce(nullif(p_header ->> 'due_date', '')::date, v_bill_date + v_terms),
    notes = nullif(btrim(p_header ->> 'notes'), ''),
    bill_attachments = v_attachments,
    status = case when status = 'draft' and coalesce((p_header ->> 'mark_ordered')::boolean, false) then 'ordered' else status end,
    ordered_at = case when status = 'draft' and coalesce((p_header ->> 'mark_ordered')::boolean, false) then now() else ordered_at end
  where id = v_id;

  if p_items is not null then
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'Add at least one item.' using errcode = 'P0001';
    end if;
    if jsonb_array_length(p_items) > 200 then
      raise exception 'Up to 200 items per purchase.' using errcode = 'P0001';
    end if;
    delete from public.purchase_items where purchase_id = v_id;  -- nothing received yet, so lines are free to replace
    for v_item in select * from jsonb_array_elements(p_items) loop
      v_product := (v_item ->> 'product_id')::uuid;
      v_qty := (v_item ->> 'qty')::int;
      v_cost := (v_item ->> 'unit_cost_paise')::int;
      v_rate := nullif(v_item ->> 'tax_rate', '')::numeric;
      if v_product is null or not exists (select 1 from public.products where id = v_product) then
        raise exception 'An item''s product no longer exists.' using errcode = 'P0001';
      end if;
      if v_product = any (v_seen) then
        raise exception '% is in the list twice — combine them into one line.', (select name from public.products where id = v_product) using errcode = 'P0001';
      end if;
      v_seen := v_seen || v_product;
      if v_qty is null or v_qty <= 0 or v_qty > 100000 then
        raise exception 'Quantity for % must be a whole number above 0.', (select name from public.products where id = v_product) using errcode = 'P0001';
      end if;
      if v_cost is null or v_cost < 0 then
        raise exception 'Enter the cost per piece for %.', (select name from public.products where id = v_product) using errcode = 'P0001';
      end if;
      insert into public.purchase_items (purchase_id, product_id, qty_ordered, unit_cost_paise, tax_rate, line_total_paise, sort_order)
      values (v_id, v_product, v_qty, v_cost, v_rate, v_qty * v_cost, v_sort);
      v_sort := v_sort + 1;
    end loop;
  end if;

  perform public._purchase_recalc(v_id, (p_header ->> 'discount_paise')::int, (p_header ->> 'shipping_paise')::int, (p_header ->> 'tax_paise')::int);
  return v_id;
end;
$$;

revoke execute on function public.books_save_purchase(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.books_save_purchase(uuid, uuid, jsonb, jsonb) to authenticated; -- is_admin() inside

-- ---------------------------------------------------------------------------
-- 5. Status changes
-- ---------------------------------------------------------------------------

create function public.books_mark_purchase_ordered(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update public.purchases set status = 'ordered', ordered_at = now() where id = p_id and status = 'draft';
  if not found then
    raise exception 'Only a draft can be marked as ordered.' using errcode = 'P0001';
  end if;
end;
$$;

create function public.books_cancel_purchase(p_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.purchases;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a short reason for cancelling.' using errcode = 'P0001';
  end if;
  select * into v from public.purchases where id = p_id for update;
  if not found then
    raise exception 'Purchase not found' using errcode = 'P0002';
  end if;
  if v.status not in ('draft', 'ordered') or exists (select 1 from public.purchase_items where purchase_id = p_id and qty_received > 0) then
    raise exception 'Stock has already been received on this purchase, so it can''t be cancelled. Use Adjust stock and add a note.' using errcode = 'P0001';
  end if;
  update public.purchases set status = 'cancelled', cancelled_at = now(), cancelled_reason = btrim(p_reason) where id = p_id;
end;
$$;

revoke execute on function public.books_mark_purchase_ordered(uuid) from public, anon;
grant execute on function public.books_mark_purchase_ordered(uuid) to authenticated;
revoke execute on function public.books_cancel_purchase(uuid, text) from public, anon;
grant execute on function public.books_cancel_purchase(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Receive items
-- ---------------------------------------------------------------------------
-- p_lines: [{ item_id, qty }] — qty pieces arriving now per line (0 / missing = none for that line).

create function public.books_receive_purchase(p_id uuid, p_lines jsonb, p_note text default null, p_allow_over boolean default false)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.purchases;
  v_line jsonb;
  v_item public.purchase_items;
  v_qty int;
  v_any boolean := false;
  v_seen uuid[] := '{}';
  v_total_qty int;
  v_landed int;
  v_stock int;
  v_cost int;
  v_status text;
  r record;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v from public.purchases where id = p_id for update;
  if not found then
    raise exception 'Purchase not found' using errcode = 'P0002';
  end if;
  if v.status not in ('draft', 'ordered', 'partially_received') then
    raise exception 'This purchase is % — nothing left to receive.', replace(v.status, '_', ' ') using errcode = 'P0001';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'Enter the quantities received.' using errcode = 'P0001';
  end if;

  -- Pass 1: validate and record received quantities (billed qty grows if more arrived than ordered).
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce(nullif(v_line ->> 'qty', '')::int, 0);
    continue when v_qty = 0;
    if v_qty < 0 or v_qty > 100000 then
      raise exception 'Received quantities must be whole numbers, 0 or more.' using errcode = 'P0001';
    end if;
    select * into v_item from public.purchase_items where id = (v_line ->> 'item_id')::uuid and purchase_id = p_id for update;
    if not found then
      raise exception 'An item doesn''t belong to this purchase.' using errcode = 'P0001';
    end if;
    if v_item.id = any (v_seen) then
      raise exception 'An item is listed twice.' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_item.id;
    if v_item.qty_received + v_qty > v_item.qty_ordered and not coalesce(p_allow_over, false) then
      raise exception 'More than ordered for % (ordered %, receiving % in total). Confirm the extra pieces to continue.',
        (select name from public.products where id = v_item.product_id), v_item.qty_ordered, v_item.qty_received + v_qty
        using errcode = 'P0001', hint = 'over_receive';
    end if;
    update public.purchase_items
       set qty_received = qty_received + v_qty,
           line_total_paise = greatest(qty_ordered, qty_received + v_qty) * unit_cost_paise
     where id = v_item.id;
    v_any := true;
  end loop;
  if not v_any then
    raise exception 'Enter how many pieces arrived for at least one item.' using errcode = 'P0001';
  end if;

  perform public._purchase_recalc(p_id);
  select * into v from public.purchases where id = p_id;
  select coalesce(sum(greatest(qty_ordered, qty_received)), 0) into v_total_qty from public.purchase_items where purchase_id = p_id;

  -- Pass 2: stock in at landed cost, weighted average cost, vendor's last price.
  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := coalesce(nullif(v_line ->> 'qty', '')::int, 0);
    continue when v_qty = 0;
    select * into v_item from public.purchase_items where id = (v_line ->> 'item_id')::uuid;
    v_landed := public._landed_unit_cost(v_item.unit_cost_paise, v.subtotal_paise, v.shipping_paise, v.discount_paise, v_total_qty);

    select stock, cost_price_paise into v_stock, v_cost from public.products where id = v_item.product_id for update;
    update public.products set cost_price_paise = public._weighted_cost(v_stock, v_cost, v_qty, v_landed) where id = v_item.product_id;
    perform public._stock_move(v_item.product_id, v_qty, 'purchase_receipt', 'purchase', p_id, v_landed,
      coalesce(nullif(btrim(p_note), ''), 'Received on ' || v.number));
    update public.purchase_items set landed_unit_cost_paise = v_landed where id = v_item.id;

    insert into public.vendor_products (vendor_id, product_id, last_cost_paise)
    values (v.vendor_id, v_item.product_id, v_item.unit_cost_paise)
    on conflict (vendor_id, product_id) do update set last_cost_paise = excluded.last_cost_paise;
  end loop;

  v_status := case
    when not exists (select 1 from public.purchase_items where purchase_id = p_id and qty_received < qty_ordered) then 'received'
    else 'partially_received'
  end;
  update public.purchases
     set status = v_status,
         ordered_at = coalesce(ordered_at, now()),
         received_at = case when v_status = 'received' then now() else received_at end
   where id = p_id;
  return v_status;
end;
$$;

revoke execute on function public.books_receive_purchase(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.books_receive_purchase(uuid, jsonb, text, boolean) to authenticated; -- is_admin() inside
