-- Maati Living — Books, Phase 4: expenses, categories, recurring reminders.
-- Run in Supabase → SQL Editor after 0010. TAKE A BACKUP FIRST and run on the dev/test project first.
-- Nothing existing is dropped or rewritten: two new tables, a sequence and new functions.
--
-- Rules
--   * Expenses are written only through the functions below (RAISE on any problem). Active ones can be edited
--     (audit_log keeps before/after); voided ones stay listed with the reason and count nowhere. Never deleted.
--   * Categories: admins add / rename / reorder / archive directly (RLS). Never deleted.
--   * Recurring: an expense marked recurring is the "template". When its next_due_on comes, the dashboard shows a
--     reminder; the admin confirms (posts a new expense, amount editable) or skips. Nothing is posted on its own.
--     Next dates step from the template's first date (31 Jan → 28 Feb → 31 Mar), mirrored in src/lib/books/expenses.js.

-- ---------------------------------------------------------------------------
-- 1. Categories
-- ---------------------------------------------------------------------------

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  sort_order int not null default 0,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index expense_categories_name_idx on public.expense_categories (lower(btrim(name)));

create trigger expense_categories_touch_updated_at before update on public.expense_categories
  for each row execute function public.touch_updated_at();
create trigger expense_categories_audit after insert or update or delete on public.expense_categories
  for each row execute function public.audit_row();

alter table public.expense_categories enable row level security;
create policy "Admins read expense categories" on public.expense_categories for select using (public.is_admin());
create policy "Admins add expense categories" on public.expense_categories for insert with check (public.is_admin());
create policy "Admins edit expense categories" on public.expense_categories for update using (public.is_admin()) with check (public.is_admin());
-- No delete policy: categories are archived, never deleted.

insert into public.expense_categories (name, sort_order) values
  ('Packaging', 10), ('Courier & shipping', 20), ('Ads & marketing', 30), ('Photography', 40),
  ('Website & software', 50), ('Travel', 60), ('Rent', 70), ('Utilities', 80),
  ('Bank & payment charges', 90), ('Miscellaneous', 100);

-- ---------------------------------------------------------------------------
-- 2. Expenses
-- ---------------------------------------------------------------------------

create sequence public.expense_number_seq start 1001;
revoke all on sequence public.expense_number_seq from public, anon, authenticated;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,                                   -- EXP-1001, EXP-1002, …
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),           -- what was paid, tax included
  tax_paise int not null default 0 check (tax_paise >= 0),      -- optional: GST part of the amount
  spent_on date not null,
  paid_via text not null check (paid_via in ('upi', 'bank', 'cash', 'card', 'other')),
  vendor_id uuid references public.vendors (id) on delete restrict,
  description text check (char_length(description) <= 300),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  is_recurring boolean not null default false,
  recurrence text check (recurrence in ('monthly', 'yearly')),
  next_due_on date,
  recurring_source_id uuid references public.expenses (id) on delete restrict,  -- the template this was posted from
  status text not null default 'active' check (status in ('active', 'voided')),
  void_reason text,
  voided_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tax_paise <= amount_paise),
  check (not is_recurring or (recurrence is not null and next_due_on is not null)),
  check (status <> 'voided' or (void_reason is not null and voided_at is not null))
);

create index expenses_spent_on_idx on public.expenses (spent_on desc);
create index expenses_category_idx on public.expenses (category_id, spent_on desc);
create index expenses_due_idx on public.expenses (next_due_on) where is_recurring;
create index expenses_source_idx on public.expenses (recurring_source_id);

create trigger expenses_touch_updated_at before update on public.expenses
  for each row execute function public.touch_updated_at();
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_row();

alter table public.expenses enable row level security;
create policy "Admins read expenses" on public.expenses for select using (public.is_admin());
-- Writes only through the functions below.
revoke insert, update, delete on public.expenses from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Helpers (internal)
-- ---------------------------------------------------------------------------

-- First date after p_after in the series p_start + n months/years (n ≥ 1), counted from the start so month ends
-- don't drift (31 Jan → 28 Feb → 31 Mar). Same as nextDueDate() in src/lib/books/expenses.js.
create function public._next_due(p_start date, p_after date, p_recurrence text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_step interval := case p_recurrence when 'yearly' then interval '1 year' else interval '1 month' end;
  v_n int := 1;
  v_date date;
begin
  loop
    v_date := (p_start + v_n * v_step)::date;
    exit when v_date > p_after;
    v_n := v_n + 1;
  end loop;
  return v_date;
end;
$$;

revoke execute on function public._next_due(date, date, text) from public, anon, authenticated;

-- Validates and normalises the shared expense fields. Raises on anything wrong.
-- p: { category_id, amount_paise, tax_paise, spent_on, paid_via, vendor_id, description, attachments }
create function public._check_expense(p jsonb, p_old public.expenses default null)
returns void
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_amount int := nullif(p ->> 'amount_paise', '')::int;
  v_tax int := coalesce(nullif(p ->> 'tax_paise', '')::int, 0);
  v_spent date := nullif(p ->> 'spent_on', '')::date;
  v_category uuid := nullif(p ->> 'category_id', '')::uuid;
  v_vendor uuid := nullif(p ->> 'vendor_id', '')::uuid;
  v_attachments jsonb := coalesce(p -> 'attachments', '[]'::jsonb);
  v_att jsonb;
begin
  if v_category is null or not exists (select 1 from public.expense_categories where id = v_category
      and (status = 'active' or v_category = p_old.category_id)) then
    raise exception 'Choose a category.' using errcode = 'P0001';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > 1000000000 then
    raise exception 'Enter the amount spent (more than ₹0).' using errcode = 'P0001';
  end if;
  if v_tax < 0 or v_tax > v_amount then
    raise exception 'Tax can''t be more than the amount.' using errcode = 'P0001';
  end if;
  if v_spent is null then
    raise exception 'Enter the date it was spent.' using errcode = 'P0001';
  end if;
  if v_spent > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'The date can''t be in the future.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'paid_via', '') not in ('upi', 'bank', 'cash', 'card', 'other') then
    raise exception 'Choose how it was paid.' using errcode = 'P0001';
  end if;
  if v_vendor is not null and not exists (select 1 from public.vendors where id = v_vendor
      and (status = 'active' or v_vendor = p_old.vendor_id)) then
    raise exception 'Choose an active vendor, or leave it blank.' using errcode = 'P0001';
  end if;
  if char_length(coalesce(p ->> 'description', '')) > 300 then
    raise exception 'The description is too long (300 characters max).' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_attachments) <> 'array' or jsonb_array_length(v_attachments) > 10 then
    raise exception 'Up to 10 receipt files per expense.' using errcode = 'P0001';
  end if;
  for v_att in select * from jsonb_array_elements(v_attachments) loop
    if coalesce(v_att ->> 'publicId', '') !~ '^maati-living/bills/[A-Za-z0-9_/-]+$' then
      raise exception 'A receipt file is not from the private upload folder.' using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

revoke execute on function public._check_expense(jsonb, public.expenses) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Save (create / edit), void, recurring
-- ---------------------------------------------------------------------------
-- p_data: the fields above + { is_recurring, recurrence, next_due_on } (next_due_on blank = one step after spent_on)

create function public.books_save_expense(p_id uuid, p_data jsonb)
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
    values ('EXP-' || nextval('public.expense_number_seq'), (p_data ->> 'category_id')::uuid, (p_data ->> 'amount_paise')::int, v_spent, p_data ->> 'paid_via')
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

create function public.books_void_expense(p_id uuid, p_reason text)
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
  -- Voiding a repeating expense also stops its reminders.
  update public.expenses
     set status = 'voided', void_reason = left(btrim(p_reason), 300), voided_at = now(),
         is_recurring = false, recurrence = null, next_due_on = null
   where id = p_id and status = 'active';
  if not found then
    raise exception 'Only an active expense can be voided.' using errcode = 'P0001';
  end if;
end;
$$;

-- Confirm one due occurrence of a repeating expense: posts a new expense (fields as in books_save_expense; amount
-- and date can differ from the template) and moves the reminder to the next date. p_due_on must be the template's
-- current due date, so a double tap can't post it twice.
create function public.books_confirm_recurring(p_source_id uuid, p_due_on date, p_data jsonb)
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
  values ('EXP-' || nextval('public.expense_number_seq'), (p_data ->> 'category_id')::uuid, (p_data ->> 'amount_paise')::int,
          coalesce(nullif(p_data ->> 'tax_paise', '')::int, 0), (p_data ->> 'spent_on')::date, p_data ->> 'paid_via',
          nullif(p_data ->> 'vendor_id', '')::uuid, nullif(btrim(p_data ->> 'description'), ''), coalesce(p_data -> 'attachments', '[]'::jsonb), v.id)
  returning id into v_id;

  -- The series is counted from the template's own date.
  v_first := v.spent_on;
  update public.expenses set next_due_on = public._next_due(v_first, p_due_on, v.recurrence) where id = v.id;
  return v_id;
end;
$$;

create function public.books_skip_recurring(p_source_id uuid, p_due_on date)
returns date
language plpgsql
security definer set search_path = ''
as $$
declare
  v public.expenses;
  v_next date;
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
  v_next := public._next_due(v.spent_on, p_due_on, v.recurrence);
  update public.expenses set next_due_on = v_next where id = v.id;
  return v_next;
end;
$$;

create function public.books_stop_recurring(p_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update public.expenses set is_recurring = false, recurrence = null, next_due_on = null where id = p_id and is_recurring;
  if not found then
    raise exception 'This expense doesn''t repeat.' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.books_save_expense(uuid, jsonb) from public, anon;
grant execute on function public.books_save_expense(uuid, jsonb) to authenticated;                  -- is_admin() inside
revoke execute on function public.books_void_expense(uuid, text) from public, anon;
grant execute on function public.books_void_expense(uuid, text) to authenticated;
revoke execute on function public.books_confirm_recurring(uuid, date, jsonb) from public, anon;
grant execute on function public.books_confirm_recurring(uuid, date, jsonb) to authenticated;
revoke execute on function public.books_skip_recurring(uuid, date) from public, anon;
grant execute on function public.books_skip_recurring(uuid, date) to authenticated;
revoke execute on function public.books_stop_recurring(uuid) from public, anon;
grant execute on function public.books_stop_recurring(uuid) to authenticated;
