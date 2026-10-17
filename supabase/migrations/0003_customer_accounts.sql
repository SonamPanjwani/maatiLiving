-- Maati Living — Phase 4: customer accounts.
-- Run in Supabase → SQL Editor after 0002.

-- ---------------------------------------------------------------------------
-- Profile: customers may edit their own name and phone — never their role.
-- ---------------------------------------------------------------------------

alter table public.profiles add column phone text;

-- Column-level privilege is what protects `role`: authenticated users can only UPDATE these two columns.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Saved addresses
-- ---------------------------------------------------------------------------

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index addresses_user_id_idx on public.addresses (user_id);
-- At most one default address per customer.
create unique index addresses_one_default_idx on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;

create policy "Users manage own addresses" on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Orders: customers read their own (linked by user_id)
-- ---------------------------------------------------------------------------

create policy "Customers read own orders" on public.orders
  for select using (user_id = auth.uid());
create policy "Customers read own order items" on public.order_items
  for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Links earlier guest orders to an account by (verified) email. Called by the server with the
-- secret key after confirming the user's email is verified.
create function public.claim_guest_orders(p_user_id uuid, p_email text)
returns int
language sql
security definer set search_path = ''
as $$
  with claimed as (
    update public.orders set user_id = p_user_id
     where user_id is null and lower(email) = lower(p_email)
     returning 1
  )
  select count(*)::int from claimed;
$$;

revoke execute on function public.claim_guest_orders(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_guest_orders(uuid, text) to service_role;
