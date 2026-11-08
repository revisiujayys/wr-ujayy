import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { adminClient, clientIp, guardPost, hashKey, json, readBody, withinLimit } from './_lib/server.js';
import {
  OrderError,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  normalizePhone,
  priceOrder,
  type AreaRow,
  type ProductRow,
  type ToppingRow,
} from './_lib/orderLogic.js';

const CLOSED_MESSAGE = 'Maaf, toko sedang tutup 😇';

const optionalText = (max: number) => z.string().trim().max(max).optional();

const Body = z
  .object({
    customerName: z.string().trim().min(1).max(80),
    customerPhone: z
      .string()
      .trim()
      .max(30)
      .transform(normalizePhone)
      .refine((v) => /^628\d{8,12}$/.test(v), 'Nomor WhatsApp tidak valid'),
    fulfillment: z.enum(['delivery', 'pickup']),
    areaId: z.string().uuid().optional(),
    address: optionalText(300),
    rtRw: optionalText(20),
    landmark: optionalText(200),
    note: optionalText(300),
    paymentMethod: z.enum(['cod', 'qris_transfer']),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          variantId: z.string().uuid().optional(),
          quantity: z.number().int().min(1).max(99),
          noodleStyle: z.enum(['kuah', 'goreng']).optional(),
          toppingIds: z.array(z.string().uuid()).max(10).optional(),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === 'delivery') {
      if (!v.areaId) ctx.addIssue({ code: 'custom', path: ['areaId'], message: 'Pilih desa' });
      if (!v.address || v.address.length < 5) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'Alamat lengkap wajib diisi' });
      }
    }
  });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardPost(req, res)) return;

  try {
    const admin = adminClient();

    if (!(await withinLimit(admin, 'order-ip:' + hashKey(clientIp(req)), 8, 600))) {
      return json(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' });
    }

    const parsed = Body.safeParse(readBody(req));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json(res, 400, {
        error: 'Data pesanan belum lengkap atau tidak valid',
        field: issue?.path.join('.') ?? null,
        detail: issue?.message ?? null,
      });
    }
    const input = parsed.data;

    if (!(await withinLimit(admin, 'order-phone:' + hashKey(input.customerPhone), 5, 3600))) {
      return json(res, 429, { error: 'Terlalu banyak pesanan dari nomor ini. Coba lagi nanti.' });
    }

    const { data: settings, error: settingsError } = await admin
      .from('store_settings')
      .select('is_open, whatsapp_number')
      .eq('id', 1)
      .single();
    if (settingsError) throw settingsError;
    if (!settings.is_open) return json(res, 403, { error: CLOSED_MESSAGE });

    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const { data: productRows, error: productError } = await admin
      .from('products')
      .select('id, name, base_price, product_type, is_active, is_available, product_variants(id, name, is_available)')
      .in('id', productIds);
    if (productError) throw productError;

    const toppingIds = [...new Set(input.items.flatMap((i) => i.toppingIds ?? []))];
    let toppingRows: ToppingRow[] = [];
    if (toppingIds.length > 0) {
      const { data, error } = await admin
        .from('toppings')
        .select('id, name, price, is_available')
        .in('id', toppingIds);
      if (error) throw error;
      toppingRows = data as ToppingRow[];
    }

    let area: AreaRow | null = null;
    if (input.fulfillment === 'delivery' && input.areaId) {
      const { data, error } = await admin
        .from('delivery_areas')
        .select('id, name, min_order, delivery_fee, is_active')
        .eq('id', input.areaId)
        .maybeSingle();
      if (error) throw error;
      area = (data as AreaRow | null) ?? null;
    }

    const priced = priceOrder(
      input,
      new Map((productRows as ProductRow[]).map((p) => [p.id, p])),
      new Map(toppingRows.map((t) => [t.id, t])),
      area,
    );

    const isDelivery = input.fulfillment === 'delivery';
    const address = isDelivery ? input.address || null : null;
    const rtRw = isDelivery ? input.rtRw || null : null;
    const landmark = isDelivery ? input.landmark || null : null;
    const note = input.note || null;

    const { data: created, error: createError } = await admin
      .rpc('create_order', {
        p_order: {
          customer_name: input.customerName,
          customer_phone: input.customerPhone,
          fulfillment: input.fulfillment,
          area_id: priced.area?.id ?? null,
          area_name: priced.area?.name ?? null,
          address,
          rt_rw: rtRw,
          landmark,
          note,
          payment_method: input.paymentMethod,
          subtotal: priced.subtotal,
          delivery_fee: priced.deliveryFee,
          total: priced.total,
        },
        p_items: priced.items,
      })
      .single<{ out_id: string; out_order_number: string }>();
    if (createError) throw createError;

    const message = buildWhatsAppMessage({
      orderNumber: created.out_order_number,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      fulfillment: input.fulfillment,
      areaName: priced.area?.name ?? null,
      address,
      rtRw,
      landmark,
      note,
      paymentMethod: input.paymentMethod,
      items: priced.items,
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
    });

    return json(res, 201, {
      orderNumber: created.out_order_number,
      subtotal: priced.subtotal,
      deliveryFee: priced.deliveryFee,
      total: priced.total,
      paymentMethod: input.paymentMethod,
      whatsappUrl: buildWhatsAppUrl(settings.whatsapp_number, message),
    });
  } catch (error) {
    if (error instanceof OrderError) return json(res, error.status, { error: error.message });
    // Jangan mencatat data pelanggan; cukup jenis error.
    console.error('order failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}
