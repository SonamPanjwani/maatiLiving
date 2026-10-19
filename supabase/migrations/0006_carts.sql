-- Maati Living — saved carts for signed-in customers (synced across devices).
-- Run in Supabase → SQL Editor after 0005. Guests keep their cart in the browser.
--
-- items is a convenience copy ([{ productId, slug, name, price, imagePublicId, maxQuantity, quantity }]).
-- It is never trusted for money: checkout re-prices every line from the products table.

create table public.carts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  updated_at timestamptz not null default now()
);

create trigger carts_touch_updated_at
  before update on public.carts
  for each row execute function public.touch_updated_at();

alter table public.carts enable row level security;

create policy "Users manage own cart" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
