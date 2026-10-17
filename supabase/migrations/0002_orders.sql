-- Maati Living — Phase 3: orders and order items.
-- Run in Supabase → SQL Editor after 0001.
--
-- Guest checkout writes orders with the server-only secret key (bypasses RLS), so there are
-- deliberately no anon/customer policies here. Customers see their order through a
-- server-rendered page keyed by order number + access token.

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ML' || nextval('public.order_number_seq')),
  access_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null, -- linked in Phase 4 (accounts)
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'cancelled', 'shipped', 'delivered')),
  customer_name text not null,
  email text not null,
  phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  notes text,
  subtotal_paise int not null check (subtotal_paise >= 0),
  shipping_paise int not null check (shipping_paise >= 0),
  total_paise int not null check (total_paise >= 0),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Snapshot of each line at purchase time; survives product edits and deletes.
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_slug text,
  image_public_id text,
  unit_price_paise int not null check (unit_price_paise >= 0),
  quantity int not null check (quantity > 0)
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_status_idx on public.orders (status);
create index order_items_order_id_idx on public.order_items (order_id);

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Admins read orders" on public.orders
  for select using (public.is_admin());
create policy "Admins update orders" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins read order items" on public.order_items
  for select using (public.is_admin());

-- Marks an order paid and takes its items out of stock, exactly once.
-- Called only by the server after verifying Razorpay's signature (checkout or webhook).
create function public.mark_order_paid(p_razorpay_order_id text, p_payment_id text)
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
    -- Already paid (e.g. webhook and browser both confirmed) or unknown order.
    return query select o.id, false from public.orders o where o.razorpay_order_id = p_razorpay_order_id;
    return;
  end if;

  update public.products p
     set stock = greatest(p.stock - oi.quantity, 0)
    from public.order_items oi
   where oi.order_id = v_id and oi.product_id = p.id;

  return query select v_id, true;
end;
$$;

revoke execute on function public.mark_order_paid(text, text) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text) to service_role;
