// Logika harga & pesan WhatsApp. Murni (tanpa database/jaringan) agar mudah diuji.
// Semua angka dihitung ulang di sini dari data database; nilai harga dari browser tidak dipakai.

export type NoodleStyle = 'kuah' | 'goreng';

export type ProductRow = {
  id: string;
  name: string;
  base_price: number;
  product_type: 'regular' | 'noodle';
  is_active: boolean;
  is_available: boolean;
  product_variants: { id: string; name: string; is_available: boolean }[] | null;
};

export type ToppingRow = { id: string; name: string; price: number; is_available: boolean };

export type AreaRow = {
  id: string;
  name: string;
  min_order: number;
  delivery_fee: number;
  is_active: boolean;
};

export type OrderInput = {
  fulfillment: 'delivery' | 'pickup';
  items: {
    productId: string;
    variantId?: string;
    quantity: number;
    noodleStyle?: NoodleStyle;
    toppingIds?: string[];
  }[];
};

export type PricedItem = {
  product_id: string;
  product_name: string;
  variant_name: string | null;
  noodle_style: NoodleStyle | null;
  unit_price: number;
  toppings: { name: string; price: number }[];
  toppings_total: number; // per 1 porsi
  quantity: number;
  line_total: number; // (unit_price + toppings_total) * quantity
};

export type PricedOrder = {
  items: PricedItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  area: AreaRow | null;
};

export class OrderError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

export function rupiah(n: number): string {
  return 'Rp' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function priceOrder(
  input: OrderInput,
  products: Map<string, ProductRow>,
  toppings: Map<string, ToppingRow>,
  area: AreaRow | null,
): PricedOrder {
  const items: PricedItem[] = [];

  for (const line of input.items) {
    const product = products.get(line.productId);
    if (!product || !product.is_active) {
      throw new OrderError('Ada produk yang sudah tidak tersedia. Muat ulang halaman lalu coba lagi.');
    }

    const variants = product.product_variants ?? [];
    // Produk habis jika toggle OFF, atau punya varian tetapi semuanya OFF.
    if (!product.is_available || (variants.length > 0 && !variants.some((v) => v.is_available))) {
      throw new OrderError(`${product.name} sedang habis`);
    }

    let variantName: string | null = null;
    if (variants.length > 0) {
      const variant = variants.find((v) => v.id === line.variantId);
      if (!variant) throw new OrderError(`Pilih varian untuk ${product.name}`);
      if (!variant.is_available) {
        throw new OrderError(`Varian ${variant.name} (${product.name}) sedang habis`);
      }
      variantName = variant.name;
    } else if (line.variantId) {
      throw new OrderError('Varian tidak valid');
    }

    let noodleStyle: NoodleStyle | null = null;
    const chosenToppings: ToppingRow[] = [];
    if (product.product_type === 'noodle') {
      if (!line.noodleStyle) throw new OrderError(`Pilih kuah atau goreng untuk ${product.name}`);
      noodleStyle = line.noodleStyle;
      for (const id of new Set(line.toppingIds ?? [])) {
        const topping = toppings.get(id);
        if (!topping) throw new OrderError('Ada topping yang tidak ditemukan. Muat ulang halaman lalu coba lagi.');
        if (!topping.is_available) throw new OrderError(`Topping ${topping.name} sedang habis`);
        chosenToppings.push(topping);
      }
    } else if (line.noodleStyle || (line.toppingIds?.length ?? 0) > 0) {
      throw new OrderError('Pilihan tidak valid untuk produk ini');
    }

    const toppingsTotal = chosenToppings.reduce((sum, t) => sum + t.price, 0);
    items.push({
      product_id: product.id,
      product_name: product.name,
      variant_name: variantName,
      noodle_style: noodleStyle,
      unit_price: product.base_price,
      toppings: chosenToppings.map((t) => ({ name: t.name, price: t.price })),
      toppings_total: toppingsTotal,
      quantity: line.quantity,
      line_total: (product.base_price + toppingsTotal) * line.quantity,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.line_total, 0);

  let deliveryFee = 0;
  let usedArea: AreaRow | null = null;
  if (input.fulfillment === 'delivery') {
    if (!area || !area.is_active) {
      throw new OrderError('Desa pengiriman tidak valid atau belum dilayani');
    }
    if (subtotal < area.min_order) {
      throw new OrderError(`Minimum belanja untuk ${area.name} adalah ${rupiah(area.min_order)}`);
    }
    deliveryFee = area.delivery_fee;
    usedArea = area;
  }

  return { items, subtotal, deliveryFee, total: subtotal + deliveryFee, area: usedArea };
}

export type OrderSummary = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillment: 'delivery' | 'pickup';
  areaName: string | null;
  address: string | null;
  rtRw: string | null;
  landmark: string | null;
  note: string | null;
  paymentMethod: 'cod' | 'qris_transfer';
  items: PricedItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
};

function itemTitle(i: PricedItem): string {
  const variant = i.variant_name ? ` (${i.variant_name})` : '';
  return `${i.product_name}${variant}`;
}

// 628123456789 -> +62 812-3456-789
function displayPhone(p: string): string {
  if (!/^62\d{9,13}$/.test(p)) return p;
  const rest = p.slice(2);
  return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`;
}

// Teks biasa, bukan blok monospace. Font monospace dan karakter garis berbeda di tiap HP,
// sehingga kolom rata-kanan dan tepi kotak sering bergeser. Format ini tidak bergantung pada lebar karakter.
const DIVIDER = '────────────────────';

// Buang karakter pemicu format WhatsApp (tebal, miring, coret, kode) dan rapikan spasi/baris baru.
const clean = (s: string) => s.replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();

// Baris dalam blok kutipan WhatsApp ("> "), label tebal. Baris berurutan menyatu jadi satu blok.
const kv = (label: string, value: string) => `> *${label}:* ${value}`;

export function buildWhatsAppMessage(o: OrderSummary): string {
  const lines: string[] = [];
  lines.push('*KONFIRMASI PESANAN*', DIVIDER, `ID Pesanan: *${o.orderNumber}*`, DIVIDER);

  lines.push('*DETAIL PESANAN*');
  o.items.forEach((i, idx) => {
    lines.push(`${idx + 1}. ${clean(itemTitle(i))} (${i.quantity}x) — ${rupiah(i.line_total)}`);
    if (i.noodle_style) lines.push(`    ${i.noodle_style === 'kuah' ? 'Kuah' : 'Goreng'}`);
    if (i.toppings.length > 0) lines.push(`    + ${clean(i.toppings.map((t) => t.name).join(', '))}`);
  });

  lines.push(DIVIDER, '*RINCIAN BIAYA*');
  lines.push(kv('Subtotal', rupiah(o.subtotal)));
  lines.push(kv('Ongkir', o.deliveryFee === 0 ? 'Gratis' : rupiah(o.deliveryFee)));
  lines.push(kv('Pengambilan', o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil di warung'));
  lines.push(kv('Pembayaran', o.paymentMethod === 'cod' ? 'COD (tunai)' : 'QRIS / Transfer'));

  lines.push(DIVIDER, `*TOTAL TAGIHAN: ${rupiah(o.total)}*`, DIVIDER);

  lines.push('*DATA PEMESAN*');
  lines.push(kv('Nama', clean(o.customerName)));
  lines.push(kv('WhatsApp', displayPhone(o.customerPhone)));
  if (o.fulfillment === 'delivery') {
    lines.push(kv('Desa', clean(o.areaName ?? '-')));
    if (o.address) lines.push(kv('Alamat', clean(o.address)));
    if (o.rtRw) lines.push(kv('RT/RW', clean(o.rtRw)));
    if (o.landmark) lines.push(kv('Patokan', clean(o.landmark)));
  }
  if (o.note) lines.push(kv('Catatan', clean(o.note)));
  lines.push(DIVIDER);

  lines.push(
    o.paymentMethod === 'qris_transfer'
      ? 'Mohon kirim detail pembayarannya. Terima kasih.'
      : 'Terima kasih.',
  );
  return lines.join('\n');
}

export function buildWhatsAppUrl(number: string | null, message: string): string | null {
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function normalizePhone(value: string): string {
  const d = value.replace(/[\s()+-]/g, '');
  if (!/^\d+$/.test(d)) return d;
  if (d.startsWith('0')) return '62' + d.slice(1);
  if (d.startsWith('62')) return d;
  if (d.startsWith('8')) return '62' + d;
  return d;
}
