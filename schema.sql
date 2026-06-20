-- ============================================================
-- KAIZOU PEN — Supabase schema
-- Run this in: Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- ------------------------------------------------------------
-- 1. PRODUCTS TABLE
-- ------------------------------------------------------------
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  spec         text,
  description  text,
  price        integer not null default 0,
  tag          text,            -- BESTSELLER, NEW, LIMITED, etc.
  cap_color    text,            -- CSS color or gradient for the pen cap visual
  images       text[] default '{}',  -- array of image URLs (multi-photo support)
  sort_order   integer default 0,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- Public can READ active products. Only logged-in admin can WRITE.
-- ------------------------------------------------------------
alter table public.products enable row level security;

drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products for select
  using (is_active = true);

drop policy if exists "auth users can do anything" on public.products;
create policy "auth users can do anything"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- 3. ORDERS TABLE
-- ------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  contact         text not null,           -- phone number or telegram handle
  address         text not null,
  shipping_method text not null,           -- 'Virak Buntham', 'J&T', or other
  items           jsonb not null,          -- [{ id, name, price, qty }, ...]
  subtotal        integer not null,
  notes           text,
  status          text not null default 'pending',  -- pending / confirmed / shipped / delivered / cancelled
  created_at      timestamptz default now()
);

alter table public.orders enable row level security;

-- Customers (anonymous) can place an order.
drop policy if exists "anyone can place an order" on public.orders;
create policy "anyone can place an order"
  on public.orders for insert
  with check (true);

-- Only logged-in admin can view / update / delete orders.
drop policy if exists "auth read orders" on public.orders;
create policy "auth read orders"
  on public.orders for select to authenticated
  using (true);

drop policy if exists "auth update orders" on public.orders;
create policy "auth update orders"
  on public.orders for update to authenticated
  using (true) with check (true);

drop policy if exists "auth delete orders" on public.orders;
create policy "auth delete orders"
  on public.orders for delete to authenticated
  using (true);

-- ------------------------------------------------------------
-- 4. SITE CONTENT (editable text snippets for header, footer, etc.)
-- ------------------------------------------------------------
create table if not exists public.site_content (
  key        text primary key,            -- e.g. 'hero.badge', 'footer.email'
  value      text not null,
  updated_at timestamptz default now()
);

drop trigger if exists trg_content_updated on public.site_content;
create trigger trg_content_updated
  before update on public.site_content
  for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

-- Anyone can read.
drop policy if exists "public read site content" on public.site_content;
create policy "public read site content"
  on public.site_content for select
  using (true);

-- Only logged-in admin can write.
drop policy if exists "auth write site content" on public.site_content;
create policy "auth write site content"
  on public.site_content for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 4b. DYNAMIC TEXT BLOCKS (admin-inserted inline anywhere on page)
-- Each block is anchored AFTER an existing data-edit-key element.
-- ------------------------------------------------------------
create table if not exists public.dynamic_blocks (
  id          uuid primary key default gen_random_uuid(),
  anchor_key  text not null,           -- data-edit-key of the element this sits below
  sort_order  integer not null default 0,
  content     text not null default '',-- sanitized HTML
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists dynamic_blocks_anchor_idx
  on public.dynamic_blocks (anchor_key, sort_order);

drop trigger if exists trg_dyn_blocks_updated on public.dynamic_blocks;
create trigger trg_dyn_blocks_updated
  before update on public.dynamic_blocks
  for each row execute function public.set_updated_at();

alter table public.dynamic_blocks enable row level security;

drop policy if exists "public read active dyn blocks" on public.dynamic_blocks;
create policy "public read active dyn blocks"
  on public.dynamic_blocks for select
  using (is_active = true);

drop policy if exists "auth manage dyn blocks" on public.dynamic_blocks;
create policy "auth manage dyn blocks"
  on public.dynamic_blocks for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 5. HOMEPAGE CUSTOM BLOCKS (admin-defined content sections)
-- ------------------------------------------------------------
create table if not exists public.homepage_blocks (
  id          uuid primary key default gen_random_uuid(),
  heading     text,
  body        text,           -- sanitized HTML
  cta_label   text,
  cta_url     text,
  image_url   text,
  sort_order  integer default 0,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

drop trigger if exists trg_blocks_updated on public.homepage_blocks;
create trigger trg_blocks_updated
  before update on public.homepage_blocks
  for each row execute function public.set_updated_at();

alter table public.homepage_blocks enable row level security;

drop policy if exists "public read active blocks" on public.homepage_blocks;
create policy "public read active blocks"
  on public.homepage_blocks for select
  using (is_active = true);

drop policy if exists "auth can manage blocks" on public.homepage_blocks;
create policy "auth can manage blocks"
  on public.homepage_blocks for all to authenticated
  using (true) with check (true);

-- ------------------------------------------------------------
-- 6. STORAGE BUCKET FOR PRODUCT IMAGES
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Anyone can VIEW images (bucket is public).
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- Only logged-in admin can UPLOAD / DELETE images.
drop policy if exists "auth upload product images" on storage.objects;
create policy "auth upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "auth delete product images" on storage.objects;
create policy "auth delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- ------------------------------------------------------------
-- 7. SEED DATA (optional — comment out if you want to start empty)
-- ------------------------------------------------------------
insert into public.products (name, spec, description, price, tag, cap_color, sort_order)
values
  ('KZ-01 Classic', '18g · aluminum body · silicone grip',
   'The pen that started it all. Balanced, forgiving, beginner-friendly.',
   32, 'BESTSELLER', 'linear-gradient(180deg, #00ffd1, #00b894)', 1),
  ('KZ Sleek', '15g · low-friction · charge-tuned',
   'Lightweight build engineered for smooth charge loops.',
   36, 'NEW', 'linear-gradient(180deg, #6e5cff, #4a3fc7)', 2),
  ('KZ Heavy', '28g · brass core · sonic-tuned',
   'Built for raw speed. The pen serious sonic spinners ask for.',
   42, 'PRO', 'linear-gradient(180deg, #ff2e93, #c01874)', 3),
  ('KZ Neon', '17g · glow inserts · LED cap',
   'Limited edition with embedded LEDs. Spins in the dark.',
   52, 'LIMITED', 'linear-gradient(180deg, #f0ff00, #c4d100)', 4),
  ('KZ Shadow', '19g · matte black · stealth edition',
   'All black everything. Matte coating, blackened tip.',
   39, null, 'linear-gradient(180deg, #2a2a34, #0a0a14)', 5),
  ('KZ Chrome', '20g · mirror finish · titanium tip',
   'Polished mirror chrome body with a titanium tip for durability.',
   56, 'PREMIUM', 'linear-gradient(180deg, #e8e8ec, #b8b8c0)', 6)
on conflict do nothing;
