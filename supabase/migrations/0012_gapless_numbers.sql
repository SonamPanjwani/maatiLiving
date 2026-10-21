-- Maati Living — Books: gapless PO / PAY / EXP numbers, and ₹ amounts with Indian grouping in error messages.
-- Run in Supabase → SQL Editor after 0011. TAKE A BACKUP FIRST and run on the dev/test project first.
-- Nothing is dropped. The old sequences stay (unused). Existing numbers don't change.
--
-- Why: a sequence hands out its next number even when the save then fails and rolls back, so a refused payment
-- left a gap (PAY-1001 missing). Numbers now come from a counter row that is updated inside the same
-- transaction: if the save fails, the counter rolls back too, so the next saved record gets the same number.
-- Saves of the same kind wait for each other for a moment (row lock) — fine for a small shop.

-- ---------------------------------------------------------------------------
-- 1. Counters (start after the highest number already used, so nothing repeats)
-- ---------------------------------------------------------------------------

create table public.document_counters (
  kind text primary key check (kind in ('purchase', 'payment', 'expense')),
  prefix text not null,
  last_number int not null check (last_number >= 1000)
);

alter table public.document_counters enable row level security;
create policy "Admins read document counters" on public.document_counters for select using (public.is_admin());
revoke insert, update, delete on public.document_counters from anon, authenticated;

insert into public.document_counters (kind, prefix, last_number)
select 'purchase', 'PO-', greatest(1000, coalesce(max(nullif(substring(number from '^PO-(\d+)$'), '')::int), 1000)) from public.purchases
union all
select 'payment', 'PAY-', greatest(1000, coalesce(max(nullif(substring(number from '^PAY-(\d+)$'), '')::int), 1000)) from public.vendor_payments
union all
select 'expense', 'EXP-', greatest(1000, coalesce(max(nullif(substring(number from '^EXP-(\d+)$'), '')::int), 1000)) from public.expenses;

-- Next number of a kind, e.g. 'PAY-1002'. Only for the security-definer save functions below (no API grant).
create function public._next_number(p_kind text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  v_number text;
begin
  update public.document_counters set last_number = last_number + 1 where kind = p_kind
  returning prefix || last_number into v_number;
  if v_number is null then
    raise exception 'Unknown document kind %', p_kind;
  end if;
  return v_number;
end;
$$;

revoke execute on function public._next_number(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. ₹ in messages with Indian grouping: 601000 paise → "₹6,010", 12345650 → "₹1,23,456.50" (same as formatPrice)
-- ---------------------------------------------------------------------------

create or replace function public._rupees(p_paise bigint)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_abs bigint := abs(p_paise);
  v_whole text := (v_abs / 100)::text;
  v_paise int := (v_abs % 100)::int;
  v_grouped text;
begin
  if length(v_whole) > 3 then
    v_grouped := regexp_replace(left(v_whole, length(v_whole) - 3), '(\d)(?=(\d{2})+$)', '\1,', 'g') || ',' || right(v_whole, 3);
  else
    v_grouped := v_whole;
  end if;
  return case when p_paise < 0 then '−' else '' end || '₹' || v_grouped || case when v_paise <> 0 then '.' || lpad(v_paise::text, 2, '0') else '' end;
end;
$$;

revoke execute on function public._rupees(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Save functions: number assigned inside the transaction (gapless)
-- ---------------------------------------------------------------------------

-- books_save_purchase: as in 0009_purchase_cost_positive.sql, with the number from public._next_number().
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
    values (public._next_number('purchase'), p_vendor_id,
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

-- books_record_payment: as in 0010_books_payments.sql, with the number from public._next_number().
create or replace function public.books_record_payment(p_vendor_id uuid, p_payment jsonb, p_allocations jsonb default null)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_vendor public.vendors;
  v_id uuid;
  v_amount int := nullif(p_payment ->> 'amount_paise', '')::int;
  v_paid_on date := nullif(p_payment ->> 'paid_on', '')::date;
  v_method text := p_payment ->> 'method';
  v_attachments jsonb := coalesce(p_payment -> 'attachments', '[]'::jsonb);
  v_att jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_vendor from public.vendors where id = p_vendor_id for update;  -- one payment per vendor at a time
  if not found then
    raise exception 'Choose a vendor.' using errcode = 'P0001';
  end if;
  if v_vendor.status <> 'active' then
    raise exception '% is archived. Restore the vendor to record a payment.', v_vendor.name using errcode = 'P0001';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > 1000000000 then
    raise exception 'Enter the amount paid (more than ₹0).' using errcode = 'P0001';
  end if;
  if v_paid_on is null then
    raise exception 'Enter the date it was paid.' using errcode = 'P0001';
  end if;
  if v_paid_on > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'The payment date can''t be in the future.' using errcode = 'P0001';
  end if;
  if v_method is null or v_method not in ('upi', 'bank', 'cash', 'other') then
    raise exception 'Choose how it was paid.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_attachments) <> 'array' or jsonb_array_length(v_attachments) > 10 then
    raise exception 'Up to 10 proof files per payment.' using errcode = 'P0001';
  end if;
  for v_att in select * from jsonb_array_elements(v_attachments) loop
    if coalesce(v_att ->> 'publicId', '') !~ '^maati-living/bills/[A-Za-z0-9_/-]+$' then
      raise exception 'A proof file is not from the private upload folder.' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.vendor_payments (number, vendor_id, amount_paise, paid_on, method, reference, notes, attachments)
  values (public._next_number('payment'), v_vendor.id, v_amount, v_paid_on, v_method,
          nullif(btrim(left(p_payment ->> 'reference', 80)), ''), nullif(btrim(p_payment ->> 'notes'), ''), v_attachments)
  returning id into v_id;

  perform public._apply_payment_allocations(v_id, p_allocations);
  return v_id;
end;
$$;

-- books_save_expense: as in 0011_books_expenses.sql, with the number from public._next_number().
create or replace function public.books_save_expense(p_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.expenses;
  v_id uuid := p_id;
  v_spent date := nullif(p_data ->> 'spent_on', '')::date;
  v_recurring boolean := coalesce((p_data ->> 'is_recurring')::boolean, false);
  v_recurrence text := case when v_recurring then p_data ->> 'recurrence' end;
  v_next date := case when v_recurring then nullif(p_data ->> 'next_due_on', '')::date end;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if v_id is not null then
    select * into v from public.expenses where id = v_id for update;
    if not found then
      raise exception 'Expense not found' using errcode = 'P0002';
    end if;
    if v.status <> 'active' then
      raise exception '% is voided and can''t be changed.', v.number using errcode = 'P0001';
    end if;
  end if;
  perform public._check_expense(p_data, v);

  if v_recurring then
    if v_recurrence is null or v_recurrence not in ('monthly', 'yearly') then
      raise exception 'Choose how often it repeats.' using errcode = 'P0001';
    end if;
    if v.recurring_source_id is not null then
      raise exception 'This expense was posted from a repeating one. Change the repeat on the original instead.' using errcode = 'P0001';
    end if;
    v_next := coalesce(v_next, public._next_due(v_spent, v_spent, v_recurrence));
    if v_next <= v_spent then
      raise exception 'The next due date must be after the date spent.' using errcode = 'P0001';
    end if;
  end if;

  if v_id is null then
    insert into public.expenses (number, category_id, amount_paise, spent_on, paid_via)
    values (public._next_number('expense'), (p_data ->> 'category_id')::uuid, (p_data ->> 'amount_paise')::int, v_spent, p_data ->> 'paid_via')
    returning id into v_id;
  end if;

  update public.expenses set
    category_id = (p_data ->> 'category_id')::uuid,
    amount_paise = (p_data ->> 'amount_paise')::int,
    tax_paise = coalesce(nullif(p_data ->> 'tax_paise', '')::int, 0),
    spent_on = v_spent,
    paid_via = p_data ->> 'paid_via',
    vendor_id = nullif(p_data ->> 'vendor_id', '')::uuid,
    description = nullif(btrim(p_data ->> 'description'), ''),
    attachments = coalesce(p_data -> 'attachments', '[]'::jsonb),
    is_recurring = v_recurring,
    recurrence = v_recurrence,
    next_due_on = v_next
  where id = v_id;
  return v_id;
end;
$$;

-- books_confirm_recurring: as in 0011_books_expenses.sql, with the number from public._next_number().
create or replace function public.books_confirm_recurring(p_source_id uuid, p_due_on date, p_data jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.expenses;
  v_id uuid;
  v_first date;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v from public.expenses where id = p_source_id for update;
  if not found or not v.is_recurring or v.status <> 'active' then
    raise exception 'This expense doesn''t repeat any more.' using errcode = 'P0001';
  end if;
  if p_due_on is distinct from v.next_due_on then
    raise exception 'That date has already been confirmed or skipped. Reload the page.' using errcode = 'P0001';
  end if;
  if p_due_on > (now() at time zone 'Asia/Kolkata')::date + 7 then
    raise exception 'It isn''t due yet.' using errcode = 'P0001';
  end if;
  perform public._check_expense(p_data, v);

  insert into public.expenses (number, category_id, amount_paise, tax_paise, spent_on, paid_via, vendor_id, description, attachments, recurring_source_id)
  values (public._next_number('expense'), (p_data ->> 'category_id')::uuid, (p_data ->> 'amount_paise')::int,
          coalesce(nullif(p_data ->> 'tax_paise', '')::int, 0), (p_data ->> 'spent_on')::date, p_data ->> 'paid_via',
          nullif(p_data ->> 'vendor_id', '')::uuid, nullif(btrim(p_data ->> 'description'), ''), coalesce(p_data -> 'attachments', '[]'::jsonb), v.id)
  returning id into v_id;

  -- The series is counted from the template's own date.
  v_first := v.spent_on;
  update public.expenses set next_due_on = public._next_due(v_first, p_due_on, v.recurrence) where id = v.id;
  return v_id;
end;
$$;
