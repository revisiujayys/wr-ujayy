-- Wr. Ujayy — Tahap 3b: bucket foto produk + fungsi laporan untuk admin.

-- ---------------------------------------------------------------
-- Storage: foto produk & QRIS. Baca publik lewat URL; tulis hanya admin.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy product_images_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'product-images' and private.is_admin());
create policy product_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.is_admin());
create policy product_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.is_admin())
  with check (bucket_id = 'product-images' and private.is_admin());
create policy product_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.is_admin());

-- ---------------------------------------------------------------
-- Laporan keuangan. Hari dihitung dalam WIB (Asia/Jakarta).
-- Omzet = total pesanan yang SUDAH DIBAYAR, dihitung menurut tanggal dibayar.
-- ---------------------------------------------------------------
create function public.admin_finance()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  d0 timestamptz := v_today::timestamp at time zone 'Asia/Jakarta';
  d7 timestamptz := (v_today - 6)::timestamp at time zone 'Asia/Jakarta';
  m0 timestamptz := date_trunc('month', v_today::timestamp) at time zone 'Asia/Jakarta';
  m0_date date := date_trunc('month', v_today::timestamp)::date;
  o jsonb;
  e jsonb;
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'revenue_today',   coalesce(sum(total) filter (where is_paid and paid_at >= d0), 0),
    'revenue_7d',      coalesce(sum(total) filter (where is_paid and paid_at >= d7), 0),
    'revenue_month',   coalesce(sum(total) filter (where is_paid and paid_at >= m0), 0),
    'paid_today',      count(*) filter (where is_paid and paid_at >= d0),
    'paid_7d',         count(*) filter (where is_paid and paid_at >= d7),
    'paid_month',      count(*) filter (where is_paid and paid_at >= m0),
    'orders_total',    count(*),
    'orders_unpaid',   count(*) filter (where not is_paid)
  ) into o from public.orders;

  select jsonb_build_object(
    'expense_today',   coalesce(sum(amount) filter (where expense_date >= v_today), 0),
    'expense_7d',      coalesce(sum(amount) filter (where expense_date >= v_today - 6), 0),
    'expense_month',   coalesce(sum(amount) filter (where expense_date >= m0_date), 0)
  ) into e from public.expenses;

  return o || e;
end;
$$;
revoke all on function public.admin_finance() from public, anon;
grant execute on function public.admin_finance() to authenticated;

-- ---------------------------------------------------------------
-- Statistik kunjungan.
-- pageviews = jumlah halaman dibuka; unique = pengunjung berbeda (UUID acak);
-- visits = kombinasi pengunjung-hari (satu orang datang di hari berbeda dihitung berbeda).
-- ---------------------------------------------------------------
create function public.admin_visits()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  d0 timestamptz := v_today::timestamp at time zone 'Asia/Jakarta';
  d7 timestamptz := (v_today - 6)::timestamp at time zone 'Asia/Jakarta';
  m0 timestamptz := date_trunc('month', v_today::timestamp) at time zone 'Asia/Jakarta';
begin
  if not private.is_admin() then
    raise exception 'forbidden';
  end if;

  return (
    select jsonb_build_object(
      'pageviews_today',  count(*) filter (where created_at >= d0),
      'pageviews_7d',     count(*) filter (where created_at >= d7),
      'pageviews_month',  count(*) filter (where created_at >= m0),
      'pageviews_total',  count(*),
      'unique_today',     count(distinct visitor_id) filter (where created_at >= d0),
      'unique_7d',        count(distinct visitor_id) filter (where created_at >= d7),
      'unique_month',     count(distinct visitor_id) filter (where created_at >= m0),
      'unique_total',     count(distinct visitor_id),
      'visits_today',     count(distinct visitor_id::text || ((created_at at time zone 'Asia/Jakarta')::date)::text) filter (where created_at >= d0),
      'visits_7d',        count(distinct visitor_id::text || ((created_at at time zone 'Asia/Jakarta')::date)::text) filter (where created_at >= d7),
      'visits_month',     count(distinct visitor_id::text || ((created_at at time zone 'Asia/Jakarta')::date)::text) filter (where created_at >= m0),
      'visits_total',     count(distinct visitor_id::text || ((created_at at time zone 'Asia/Jakarta')::date)::text)
    )
    from public.site_visits
  );
end;
$$;
revoke all on function public.admin_visits() from public, anon;
grant execute on function public.admin_visits() to authenticated;
