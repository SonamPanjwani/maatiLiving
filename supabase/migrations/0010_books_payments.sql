-- Maati Living — Books, Phase 3: vendor payments, allocation to bills, payables.
-- Run in Supabase → SQL Editor after 0009. TAKE A BACKUP FIRST and run on the dev/test project first.
-- Nothing existing is dropped or rewritten: two new tables, new functions, and two guard triggers.
--
-- Rules
--   * A payment is written only through the functions below (one transaction each, RAISE on any problem).
--   * Allocation: a payment covers one or more open items of its vendor — the opening balance (purchase_id null)
--     and payable purchases (received / partly received / billed, not cancelled). Never more than an item's
--     balance, never more than the payment. Whatever isn't allocated is an advance with the vendor.
--   * Auto-allocation (when no allocation is given): opening balance first, then bills oldest first by
--     (bill date, else order date), then created_at. Mirrored in src/lib/books/payments.js (a DB test compares).
--   * Voiding keeps the payment and its allocations for the record; only active payments count anywhere.
--   * Vendor balance = opening balance + payable purchase totals − active payments.
--   * Guards: a purchase that has payments allocated can't be cancelled, lose its bill / payable status, or drop
--     below the amount paid; a vendor's opening balance can't drop below what's been paid against it.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create sequence public.payment_number_seq start 1001;
revoke all on sequence public.payment_number_seq from public, anon, authenticated;

create table public.vendor_payments (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                        -- PAY-1001, PAY-1002, …
  vendor_id uuid not null references public.vendors (id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),
  paid_on date not null,
  method text not null check (method in ('upi', 'bank', 'cash', 'other')),
  reference text check (char_length(reference) <= 80),  -- UTR / cheque no. etc.
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'voided' or (void_reason is not null and voided_at is not null))
);

create index vendor_payments_vendor_idx on public.vendor_payments (vendor_id, paid_on desc);
create index vendor_payments_paid_on_idx on public.vendor_payments (paid_on desc);

create table public.vendor_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.vendor_payments (id) on delete restrict,
  purchase_id uuid references public.purchases (id) on delete restrict,   -- null = the vendor's opening balance
  amount_paise int not null check (amount_paise > 0),
  created_at timestamptz not null default now()
);

create unique index vendor_payment_allocations_bill_idx on public.vendor_payment_allocations (payment_id, purchase_id) where purchase_id is not null;
create unique index vendor_payment_allocations_opening_idx on public.vendor_payment_allocations (payment_id) where purchase_id is null;
create index vendor_payment_allocations_purchase_idx on public.vendor_payment_allocations (purchase_id);

create trigger vendor_payments_touch_updated_at before update on public.vendor_payments
  for each row execute function public.touch_updated_at();
create trigger vendor_payments_audit after insert or update or delete on public.vendor_payments
  for each row execute function public.audit_row();
create trigger vendor_payment_allocations_audit after insert or update or delete on public.vendor_payment_allocations
  for each row execute function public.audit_row();

alter table public.vendor_payments enable row level security;
alter table public.vendor_payment_allocations enable row level security;
create policy "Admins read vendor payments" on public.vendor_payments for select using (public.is_admin());
create policy "Admins read payment allocations" on public.vendor_payment_allocations for select using (public.is_admin());
-- Writes only through the functions below.
revoke insert, update, delete on public.vendor_payments, public.vendor_payment_allocations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helpers (internal)
-- ---------------------------------------------------------------------------

-- "₹1500" / "₹1500.50" for error messages.
create function public._rupees(p_paise bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select '₹' || case when p_paise % 100 = 0 then (p_paise / 100)::text else to_char(p_paise / 100.0, 'FM999999999990.00') end
$$;

-- Same rule as isPayable() in src/lib/books/purchases.js.
create function public._purchase_is_payable(p_status text, p_bill_number text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status <> 'cancelled' and (p_status in ('partially_received', 'received') or p_bill_number is not null)
$$;

-- Paid so far on a purchase (active payments only), optionally leaving one payment out.
create function public._purchase_paid(p_purchase_id uuid, p_except_payment uuid default null)
returns bigint
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(sum(a.amount_paise), 0)::bigint
    from public.vendor_payment_allocations a
    join public.vendor_payments p on p.id = a.payment_id
   where a.purchase_id = p_purchase_id and p.status = 'active' and p.id is distinct from p_except_payment
$$;

-- Paid so far against a vendor's opening balance (active payments only), optionally leaving one payment out.
create function public._opening_paid(p_vendor_id uuid, p_except_payment uuid default null)
returns bigint
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(sum(a.amount_paise), 0)::bigint
    from public.vendor_payment_allocations a
    join public.vendor_payments p on p.id = a.payment_id
   where a.purchase_id is null and p.vendor_id = p_vendor_id and p.status = 'active' and p.id is distinct from p_except_payment
$$;

-- Write a payment's allocations (the caller has removed any old ones and locked the vendor row).
-- p_allocations: [{ purchase_id (null = opening balance), amount_paise }], or null = auto, oldest first.
create function public._apply_payment_allocations(p_payment_id uuid, p_allocations jsonb)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_pay public.vendor_payments;
  v_vendor public.vendors;
  v_left bigint;
  v_balance bigint;
  v_take bigint;
  v_line jsonb;
  v_amount int;
  v_purchase uuid;
  v_seen text[] := '{}';
  v_key text;
  r record;
begin
  select * into v_pay from public.vendor_payments where id = p_payment_id;
  select * into v_vendor from public.vendors where id = v_pay.vendor_id;
  v_left := v_pay.amount_paise;

  if p_allocations is null then
    -- Opening balance first.
    v_balance := greatest(v_vendor.opening_balance_paise, 0) - public._opening_paid(v_vendor.id, p_payment_id);
    if v_balance > 0 and v_left > 0 then
      v_take := least(v_left, v_balance);
      insert into public.vendor_payment_allocations (payment_id, purchase_id, amount_paise) values (p_payment_id, null, v_take);
      v_left := v_left - v_take;
    end if;
    -- Then bills, oldest first.
    for r in
      select id, total_paise from public.purchases
       where vendor_id = v_vendor.id and public._purchase_is_payable(status, bill_number)
       order by coalesce(bill_date, order_date), created_at
       for update
    loop
      exit when v_left <= 0;
      v_balance := r.total_paise - public._purchase_paid(r.id, p_payment_id);
      continue when v_balance <= 0;
      v_take := least(v_left, v_balance);
      insert into public.vendor_payment_allocations (payment_id, purchase_id, amount_paise) values (p_payment_id, r.id, v_take);
      v_left := v_left - v_take;
    end loop;
    return;
  end if;

  if jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'The allocation couldn''t be read. Please try again.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_allocations) > 200 then
    raise exception 'Up to 200 bills per payment.' using errcode = 'P0001';
  end if;

  for v_line in select * from jsonb_array_elements(p_allocations) loop
    v_amount := coalesce(nullif(v_line ->> 'amount_paise', '')::int, 0);
    continue when v_amount = 0;
    if v_amount < 0 then
      raise exception 'Allocated amounts must be more than ₹0.' using errcode = 'P0001';
    end if;
    v_purchase := nullif(v_line ->> 'purchase_id', '')::uuid;
    v_key := coalesce(v_purchase::text, 'opening');
    if v_key = any (v_seen) then
      raise exception 'A bill is listed twice in the allocation.' using errcode = 'P0001';
    end if;
    v_seen := v_seen || v_key;

    if v_purchase is null then
      v_balance := greatest(v_vendor.opening_balance_paise, 0) - public._opening_paid(v_vendor.id, p_payment_id);
      if v_amount > v_balance then
        raise exception 'Only % of the opening balance is still to pay.', public._rupees(greatest(v_balance, 0)) using errcode = 'P0001';
      end if;
    else
      select * into r from public.purchases where id = v_purchase and vendor_id = v_vendor.id for update;
      if not found then
        raise exception 'A bill in the allocation isn''t from this vendor.' using errcode = 'P0001';
      end if;
      if not public._purchase_is_payable(r.status, r.bill_number) then
        raise exception '% isn''t a bill yet (nothing received and no bill number), so it can''t be paid against.', r.number using errcode = 'P0001';
      end if;
      v_balance := r.total_paise - public._purchase_paid(v_purchase, p_payment_id);
      if v_amount > v_balance then
        raise exception 'Only % is still to pay on %.', public._rupees(greatest(v_balance, 0)), r.number using errcode = 'P0001';
      end if;
    end if;

    if v_amount > v_left then
      raise exception 'The allocation adds up to more than the payment (%).', public._rupees(v_pay.amount_paise) using errcode = 'P0001';
    end if;
    insert into public.vendor_payment_allocations (payment_id, purchase_id, amount_paise) values (p_payment_id, v_purchase, v_amount);
    v_left := v_left - v_amount;
  end loop;
end;
$$;

revoke execute on function public._rupees(bigint) from public, anon, authenticated;
revoke execute on function public._purchase_is_payable(text, text) from public, anon, authenticated;
revoke execute on function public._purchase_paid(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._opening_paid(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._apply_payment_allocations(uuid, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Record, re-allocate, void
-- ---------------------------------------------------------------------------
-- p_payment: { amount_paise, paid_on (YYYY-MM-DD), method, reference, notes, attachments }

create function public.books_record_payment(p_vendor_id uuid, p_payment jsonb, p_allocations jsonb default null)
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
  values ('PAY-' || nextval('public.payment_number_seq'), v_vendor.id, v_amount, v_paid_on, v_method,
          nullif(btrim(left(p_payment ->> 'reference', 80)), ''), nullif(btrim(p_payment ->> 'notes'), ''), v_attachments)
  returning id into v_id;

  perform public._apply_payment_allocations(v_id, p_allocations);
  return v_id;
end;
$$;

-- Change which bills a payment covers (e.g. apply an advance to a bill that came later).
create function public.books_set_payment_allocations(p_payment_id uuid, p_allocations jsonb default null)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.vendor_payments;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v from public.vendor_payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v.status <> 'active' then
    raise exception '% is voided and can''t be changed.', v.number using errcode = 'P0001';
  end if;
  perform 1 from public.vendors where id = v.vendor_id for update;
  delete from public.vendor_payment_allocations where payment_id = p_payment_id;
  perform public._apply_payment_allocations(p_payment_id, p_allocations);
end;
$$;

create function public.books_void_payment(p_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Please give a short reason for voiding.' using errcode = 'P0001';
  end if;
  update public.vendor_payments set status = 'voided', void_reason = left(btrim(p_reason), 300), voided_at = now()
   where id = p_id and status = 'active';
  if not found then
    raise exception 'Only an active payment can be voided.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.books_record_payment(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.books_record_payment(uuid, jsonb, jsonb) to authenticated;            -- is_admin() inside
revoke execute on function public.books_set_payment_allocations(uuid, jsonb) from public, anon;
grant execute on function public.books_set_payment_allocations(uuid, jsonb) to authenticated;          -- is_admin() inside
revoke execute on function public.books_void_payment(uuid, text) from public, anon;
grant execute on function public.books_void_payment(uuid, text) to authenticated;                      -- is_admin() inside

-- ---------------------------------------------------------------------------
-- 4. Guards: paid bills and paid opening balances stay consistent
-- ---------------------------------------------------------------------------

create function public.purchases_guard_payments()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_paid bigint := public._purchase_paid(new.id);
begin
  if v_paid > 0 then
    if new.status = 'cancelled' then
      raise exception '% of payments is allocated to %. Void the payment or move it to another bill first.', public._rupees(v_paid), new.number using errcode = 'P0001';
    end if;
    if not public._purchase_is_payable(new.status, new.bill_number) then
      raise exception '% has payments against it, so it needs its bill number.', new.number using errcode = 'P0001';
    end if;
    if new.total_paise < v_paid then
      raise exception 'The total of % can''t go below what''s already been paid (%).', new.number, public._rupees(v_paid) using errcode = 'P0001';
    end if;
  end if;
  return null;
end;
$$;

create trigger purchases_guard_payments after update of status, bill_number, total_paise on public.purchases
  for each row execute function public.purchases_guard_payments();

create function public.vendors_guard_opening_paid()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_paid bigint := public._opening_paid(new.id);
begin
  if v_paid > greatest(new.opening_balance_paise, 0) then
    raise exception 'Payments of % are allocated to the opening balance, so it can''t be less than that.', public._rupees(v_paid) using errcode = 'P0001';
  end if;
  return null;
end;
$$;

create trigger vendors_guard_opening_paid after update of opening_balance_paise on public.vendors
  for each row execute function public.vendors_guard_opening_paid();
