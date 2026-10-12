-- Maati Living — Phase 1 + 2 schema: profiles/roles and the product catalogue.
-- Run once in Supabase → SQL Editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Profiles + roles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer' check (role in ('admin', 'customer')),
  created_at timestamptz not null default now()
);

-- Every new auth user gets a profile with role 'customer'. Admins are promoted by hand (see docs/SETUP.md).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer so policies can call it without recursing through profiles RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;

-- No insert/update/delete policies: roles can only be changed from the SQL editor.
create policy "Users read own profile" on public.profiles
  for select using (id = auth.uid());
create policy "Admins read all profiles" on public.profiles
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  parent_id uuid references public.categories (id) on delete set null,
  image_public_id text,
  image_alt text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category_id uuid references public.categories (id) on delete restrict,
  price_paise int not null check (price_paise >= 0),
  stock int not null default 0 check (stock >= 0),
  short_description text,
  sourcing_note text,
  materials text[] not null default '{}',
  artisan text,
  region text,
  care text,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sku text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  public_id text not null,
  alt text not null default '',
  sort_order int not null default 0
);

create index products_category_id_idx on public.products (category_id);
create index product_images_product_id_idx on public.product_images (product_id, sort_order);

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- Public (anon + signed-in) can read the catalogue; hidden products only by admins.
create policy "Anyone reads categories" on public.categories
  for select using (true);
create policy "Anyone reads available products" on public.products
  for select using (is_available or public.is_admin());
create policy "Anyone reads images of available products" on public.product_images
  for select using (
    exists (select 1 from public.products p where p.id = product_id and (p.is_available or public.is_admin()))
  );

-- Only admins write.
create policy "Admins manage categories" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage products" on public.products
  for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage product images" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());
