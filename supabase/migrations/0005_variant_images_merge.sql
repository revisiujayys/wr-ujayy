-- Foto per varian + gabungkan produk bernama "Merek | Rasa" menjadi satu produk dengan varian.
alter table public.product_variants add column if not exists image_url text;

-- Cadangan sebelum penggabungan (schema private: tidak terbuka lewat API).
create table if not exists private.products_backup_20261110 as select * from public.products;

do $$
declare
  g record;
  base uuid;
  m record;
  i integer;
begin
  for g in
    select trim(split_part(name, ' | ', 1)) as prefix, category_id, base_price, product_type
    from public.products p
    where name like '% | %'
      and product_type = 'regular'
      and not exists (select 1 from public.product_variants v where v.product_id = p.id)
    group by 1, 2, 3, 4
    having count(*) > 1
  loop
    select id into base
    from public.products
    where name like '% | %' and trim(split_part(name, ' | ', 1)) = g.prefix
      and category_id = g.category_id and base_price = g.base_price and product_type = g.product_type
    order by sort_order, name
    limit 1;

    i := 0;
    for m in
      select * from public.products
      where name like '% | %' and trim(split_part(name, ' | ', 1)) = g.prefix
        and category_id = g.category_id and base_price = g.base_price and product_type = g.product_type
      order by sort_order, name
    loop
      i := i + 1;
      insert into public.product_variants (product_id, name, is_available, sort_order, image_url)
      values (base, trim(substr(m.name, position(' | ' in m.name) + 3)), m.is_available and m.is_active, i, m.image_url);
    end loop;

    delete from public.products
    where id <> base and name like '% | %' and trim(split_part(name, ' | ', 1)) = g.prefix
      and category_id = g.category_id and base_price = g.base_price and product_type = g.product_type;

    update public.products
    set name = g.prefix,
        image_url = (select image_url from public.product_variants where product_id = base order by sort_order limit 1)
    where id = base;
  end loop;
end $$;
