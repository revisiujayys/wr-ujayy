-- Tema harian: pemetaan hari (0=Minggu … 6=Sabtu) ke id tema, diatur admin.
alter table public.store_settings add column if not exists day_themes jsonb;

-- Total pengunjung unik (hanya angka agregat; tanpa data pribadi). Boleh dibaca publik.
create or replace function public.visitor_total()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct visitor_id) from public.site_visits;
$$;

revoke all on function public.visitor_total() from public;
grant execute on function public.visitor_total() to anon, authenticated;
