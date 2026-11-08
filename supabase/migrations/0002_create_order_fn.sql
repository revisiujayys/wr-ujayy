-- Wr. Ujayy — Tahap 2: simpan pesanan + item dalam satu transaksi.
-- Hanya service role (server) yang boleh memanggilnya. Server sudah menghitung
-- ulang semua harga dari database; fungsi ini menjadi lapisan pemeriksa terakhir.

create function public.create_order(p_order jsonb, p_items jsonb)
returns table (out_id uuid, out_order_number text)
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
  v_number text;
  v_items_sum integer;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'order must have items';
  end if;

  select coalesce(sum((i->>'line_total')::integer), 0)
    into v_items_sum
    from jsonb_array_elements(p_items) as i;

  if v_items_sum <> (p_order->>'subtotal')::integer then
    raise exception 'subtotal mismatch';
  end if;

  insert into public.orders (
    customer_name, customer_phone, fulfillment, area_id, area_name,
    address, rt_rw, landmark, note, payment_method,
    subtotal, delivery_fee, total
  ) values (
    p_order->>'customer_name',
    p_order->>'customer_phone',
    p_order->>'fulfillment',
    (p_order->>'area_id')::uuid,
    p_order->>'area_name',
    p_order->>'address',
    p_order->>'rt_rw',
    p_order->>'landmark',
    p_order->>'note',
    p_order->>'payment_method',
    (p_order->>'subtotal')::integer,
    (p_order->>'delivery_fee')::integer,
    (p_order->>'total')::integer
  )
  returning id, order_number into v_id, v_number;

  insert into public.order_items (
    order_id, product_id, product_name, variant_name, noodle_style,
    unit_price, toppings, toppings_total, quantity, line_total
  )
  select
    v_id,
    (i->>'product_id')::uuid,
    i->>'product_name',
    i->>'variant_name',
    i->>'noodle_style',
    (i->>'unit_price')::integer,
    coalesce(i->'toppings', '[]'::jsonb),
    (i->>'toppings_total')::integer,
    (i->>'quantity')::integer,
    (i->>'line_total')::integer
  from jsonb_array_elements(p_items) as i;

  return query select v_id, v_number;
end;
$$;

revoke all on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;
