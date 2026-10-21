-- Maati Living — Books, Phase 2 fix: purchase lines must cost more than ₹0.
-- Run in Supabase → SQL Editor after 0008 (backup first; dev/test project first).
-- Replaces one function only. Nothing is dropped; existing purchases (e.g. a cancelled ₹0 one) are left as they are.
-- Free samples aren't purchases: add them with Inventory → Adjust stock → "Sample / gift".

create or replace function public.books_save_purchase(p_id uuid, p_vendor_id uuid, p_header jsonb, p_items jsonb)
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
      if v_cost is null or v_cost <= 0 then
        raise exception 'Cost per piece for % must be more than ₹0. For free samples, use Adjust stock → Sample instead.', (select name from public.products where id = v_product) using errcode = 'P0001';
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
