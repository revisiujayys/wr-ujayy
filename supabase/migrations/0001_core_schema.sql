-- Wr. Ujayy — Tahap 1: skema inti, RLS, data awal wilayah pengiriman
-- Prinsip: semua tabel RLS ON. Pelanggan (anon) hanya bisa MEMBACA katalog.
-- Pesanan, kunjungan, dan rate limit ditulis HANYA oleh server (service role).

create schema if not exists private;

-- ---------------------------------------------------------------
-- Admin (hanya satu akun). Username dipetakan ke user Supabase Auth
-- di sisi server; tidak ada pendaftaran publik.
-- ---------------------------------------------------------------
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.-]{3,32}$'),
  created_at timestamptz not null default now()
);
create unique index admin_users_single_row on public.admin_users ((true));
alter table public.admin_users enable row level security;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users where user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create policy admin_users_select on public.admin_users
  for select to authenticated using (private.is_admin());

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end $$;

-- ---------------------------------------------------------------
-- Katalog
-- ---------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  description text,
  base_price integer not null check (base_price >= 0),   -- satu harga utama untuk semua varian
  image_url text,
  product_type text not null default 'regular' check (product_type in ('regular', 'noodle')),
  is_active boolean not null default true,     -- false = disembunyikan dari pelanggan
  is_available boolean not null default true,  -- toggle ON/OFF; OFF = tampil dengan label Habis
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  unique (product_id, name)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.toppings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price integer not null check (price >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------
-- Pengiriman & pengaturan toko
-- ---------------------------------------------------------------
create table public.delivery_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  min_order integer not null check (min_order >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  is_open boolean not null default false,      -- Buka/Tutup manual oleh admin
  whatsapp_number text,                        -- diisi admin, tidak diisi sembarang
  address text,
  maps_url text,
  open_time time not null default '10:00',     -- informasi tampilan saja
  close_time time not null default '21:00',
  updated_at timestamptz not null default now()
);
create trigger store_settings_touch before update on public.store_settings
  for each row execute function private.touch_updated_at();

-- Data pembayaran hanya untuk admin (dikirim manual lewat WhatsApp).
create table public.payment_settings (
  id smallint primary key default 1 check (id = 1),
  qris_image_url text,
  bank_name text,
  account_number text,
  account_holder text,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger payment_settings_touch before update on public.payment_settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------
-- Pesanan (ditulis server saja)
-- ---------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'UJ-' || to_char(now() at time zone 'Asia/Jakarta', 'YYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 4, '0')
  ),
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  customer_phone text not null check (char_length(customer_phone) between 8 and 20),
  fulfillment text not null check (fulfillment in ('delivery', 'pickup')),
  area_id uuid references public.delivery_areas(id) on delete set null,
  area_name text,                               -- salinan nama desa saat checkout
  address text check (char_length(address) <= 300),
  rt_rw text check (char_length(rt_rw) <= 20),
  landmark text check (char_length(landmark) <= 200),
  note text check (char_length(note) <= 300),
  payment_method text not null check (payment_method in ('cod', 'qris_transfer')),
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null default 0 check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  is_paid boolean not null default false,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (total = subtotal + delivery_fee),
  check (fulfillment = 'pickup' or (area_id is not null and address is not null))
);
create index orders_created_idx on public.orders (created_at desc);
create index orders_paid_idx on public.orders (paid_at) where is_paid;

create function private.set_paid_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.is_paid and not old.is_paid then
    new.paid_at := now();
  elsif not new.is_paid then
    new.paid_at := null;
  end if;
  return new;
end $$;
create trigger orders_paid_at before update on public.orders
  for each row execute function private.set_paid_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,                   -- salinan saat checkout
  variant_name text,
  noodle_style text check (noodle_style in ('kuah', 'goreng')),
  unit_price integer not null check (unit_price >= 0),
  toppings jsonb not null default '[]'::jsonb,  -- [{name, price}] salinan saat checkout
  toppings_total integer not null default 0 check (toppings_total >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total integer not null check (line_total >= 0)
);
create index order_items_order_idx on public.order_items (order_id);

-- Persiapan tahap kedua (WhatsApp Business Cloud API resmi). Belum dipakai.
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  wa_message_id text,
  status text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index whatsapp_messages_order_idx on public.whatsapp_messages (order_id);

-- ---------------------------------------------------------------
-- Keuangan & statistik
-- ---------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  amount integer not null check (amount > 0),
  expense_date date not null default ((now() at time zone 'Asia/Jakarta')::date),
  created_at timestamptz not null default now()
);

-- Tanpa IP/user-agent. visitor_id = UUID acak dari browser, bukan data pribadi.
create table public.site_visits (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  path text not null check (char_length(path) <= 200),
  created_at timestamptz not null default now()
);
create index site_visits_created_idx on public.site_visits (created_at);

-- ---------------------------------------------------------------
-- Rate limiting (dipanggil server dengan service role)
-- ---------------------------------------------------------------
create table private.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into private.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_limit;
end $$;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.product_variants  enable row level security;
alter table public.toppings          enable row level security;
alter table public.delivery_areas    enable row level security;
alter table public.store_settings    enable row level security;
alter table public.payment_settings  enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.expenses          enable row level security;
alter table public.site_visits       enable row level security;

-- Baca publik (katalog saja)
create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);
create policy products_public_read on public.products
  for select to anon, authenticated using (is_active);
create policy variants_public_read on public.product_variants
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy toppings_public_read on public.toppings
  for select to anon, authenticated using (true);
create policy delivery_areas_public_read on public.delivery_areas
  for select to anon, authenticated using (is_active);
create policy store_settings_public_read on public.store_settings
  for select to anon, authenticated using (true);

-- Admin: kelola penuh tabel konfigurasi & keuangan manual
do $$
declare t text;
begin
  foreach t in array array[
    'categories','products','product_variants','toppings',
    'delivery_areas','store_settings','payment_settings','expenses'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (private.is_admin()) with check (private.is_admin())',
      t || '_admin_all', t);
  end loop;
end $$;

-- Admin: pesanan hanya baca, tandai dibayar, hapus. Tidak ada insert dari browser.
create policy orders_admin_select on public.orders
  for select to authenticated using (private.is_admin());
create policy orders_admin_update on public.orders
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy orders_admin_delete on public.orders
  for delete to authenticated using (private.is_admin());

create policy order_items_admin_select on public.order_items
  for select to authenticated using (private.is_admin());
create policy whatsapp_messages_admin_select on public.whatsapp_messages
  for select to authenticated using (private.is_admin());
create policy site_visits_admin_select on public.site_visits
  for select to authenticated using (private.is_admin());

-- Pertahanan berlapis: cabut akses tabel sensitif dari anon,
-- dan batasi admin hanya boleh mengubah kolom status bayar pada pesanan.
revoke all on public.orders, public.order_items, public.whatsapp_messages,
              public.expenses, public.site_visits, public.payment_settings,
              public.admin_users
  from anon;
revoke update on public.orders from authenticated;
grant update (is_paid) on public.orders to authenticated;
revoke insert, update, delete on public.order_items, public.whatsapp_messages,
              public.site_visits, public.admin_users
  from authenticated;

-- ---------------------------------------------------------------
-- Data awal (hanya data yang Anda berikan)
-- ---------------------------------------------------------------
insert into public.store_settings (id) values (1);
insert into public.payment_settings (id) values (1);

insert into public.categories (name, sort_order) values
  ('Minuman Es', 1),
  ('Mie Rebus/Goreng', 2),
  ('Makanan & Jajanan', 3);

insert into public.delivery_areas (name, min_order, delivery_fee, sort_order) values
  ('Kebulen',          10000,     0,  1),
  ('Pilangsari',       15000,  8000,  2),
  ('Sukalila',         15000,  8000,  3),
  ('Lohbener',         15000,  8000,  4),
  ('Lohbener Lor',     15000,  8000,  5),
  ('Krasak',           15000,  8000,  6),
  ('Kalimati',         15000,  8000,  7),
  ('Jatisawit Lor',    15000,  8000,  8),
  ('Jatisawit',        15000,  8000,  9),
  ('Malang Semirang',  15000,  8000, 10),
  ('Jatibarang',       15000,  5000, 11),
  ('Jatibarang Baru',  15000,  5000, 12),
  ('Bulak',            15000,  5000, 13),
  ('Bulak Lor',        15000,  5000, 14),
  ('Pawidean',         15000,  5000, 15);
