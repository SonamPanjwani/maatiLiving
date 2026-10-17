-- Maati Living — Phase 5: admin operations (shipping/tracking, refunds, restock, store settings).
-- Run in Supabase → SQL Editor after 0003.

-- ---------------------------------------------------------------------------
-- Orders: tracking, refunds, restock flag, 'refunded' status
-- ---------------------------------------------------------------------------

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'cancelled', 'shipped', 'delivered', 'refunded'));

alter table public.orders
  add column tracking_courier text,
  add column tracking_number text,
  add column shipped_at timestamptz,
  add column refund_id text,
  add column refund_amount_paise int check (refund_amount_paise >= 0),
  add column refunded_at timestamptz,
  add column restocked boolean not null default false;

-- Puts an order's items back into stock, at most once per order. Admin-only.
create function public.admin_restock_order(p_order_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    return false; -- non-admins: no-op
  end if;

  update public.orders set restocked = true
   where id = p_order_id and not restocked and status in ('cancelled', 'refunded')
   returning id into v_id;
  if v_id is null then
    return false;
  end if;

  update public.products p
     set stock = p.stock + oi.quantity
    from public.order_items oi
   where oi.order_id = v_id and oi.product_id = p.id;
  return true;
end;
$$;

revoke execute on function public.admin_restock_order(uuid) from public, anon;
grant execute on function public.admin_restock_order(uuid) to authenticated; -- is_admin() check inside

-- ---------------------------------------------------------------------------
-- Store settings (key → JSON), e.g. delivery charges
-- ---------------------------------------------------------------------------

create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

alter table public.settings enable row level security;

-- Delivery charges are shown in the cart, so everyone may read settings. Only admins change them.
create policy "Anyone reads settings" on public.settings
  for select using (true);
create policy "Admins manage settings" on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value) values
  ('shipping', '{"defaultPaise": 9900, "freeOverPaise": 99900, "byStatePaise": {}}');
