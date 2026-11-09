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

// Lebar isi kotak (karakter). Kotak dibungkus ``` agar WhatsApp memakai font monospace
// sehingga kolom lurus. Lebar dijaga sempit supaya tidak terpotong di layar HP kecil.
const BOX_WIDTH = 34;

function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > width) {
      if (line) {
        out.push(line);
        line = '';
      }
      out.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.length > 0 ? out : [''];
}

const cell = (s: string) => `│ ${s.padEnd(BOX_WIDTH)} │`;
const rule = (l: string, r: string) => `${l}${'─'.repeat(BOX_WIDTH + 2)}${r}`;
const clean = (s: string) => s.replace(/`/g, "'").replace(/\s+/g, ' ').trim();

function centered(text: string): string {
  return cell(text.padStart(Math.floor((BOX_WIDTH + text.length) / 2)));
}

// Kiri = label, kanan = nilai pendek (rata kanan). Label panjang dibungkus ke baris berikutnya.
function pair(left: string, right: string): string[] {
  const parts = wrapText(left, Math.max(BOX_WIDTH - right.length - 1, 8));
  return parts.map((p, i) => (i === 0 ? cell(p.padEnd(BOX_WIDTH - right.length) + right) : cell(p)));
}

// Nilai yang bisa panjang (alamat, catatan): jika tidak muat satu baris, turun ke baris bawah.
function field(label: string, value: string): string[] {
  const v = clean(value);
  if (label.length + 1 + v.length <= BOX_WIDTH) return pair(label, v);
  return [cell(label), ...wrapText(v, BOX_WIDTH - 2).map((l) => cell('  ' + l))];
}

export function buildWhatsAppMessage(o: OrderSummary): string {
  const box: string[] = [rule('┌', '┐'), centered('KONFIRMASI PESANAN'), rule('├', '┤')];
  box.push(cell(`ID Pesanan : ${o.orderNumber}`));

  box.push(rule('├', '┤'), cell('DETAIL PESANAN'));
  o.items.forEach((i, idx) => {
    const price = rupiah(i.line_total);
    const title = `${idx + 1}. ${clean(itemTitle(i))}`;
    const inline = `${title} (${i.quantity}x)`;
    // Jumlah sebaris dengan nama jika muat; jika tidak, pindah ke baris keterangan.
    const fits = inline.length <= BOX_WIDTH - price.length - 1;
    box.push(...pair(fits ? inline : title, price));
    const details: string[] = [];
    if (!fits) details.push(`${i.quantity}x`);
    if (i.noodle_style) details.push(i.noodle_style === 'kuah' ? 'Kuah' : 'Goreng');
    for (const d of details) box.push(cell('   ' + d));
    if (i.toppings.length > 0) {
      const names = clean(i.toppings.map((t) => t.name).join(', '));
      box.push(...wrapText('+ ' + names, BOX_WIDTH - 3).map((l) => cell('   ' + l)));
    }
  });

  box.push(rule('├', '┤'), cell('RINCIAN BIAYA'));
  box.push(...pair('Subtotal', rupiah(o.subtotal)));
  box.push(...pair('Ongkir', o.deliveryFee === 0 ? 'Gratis' : rupiah(o.deliveryFee)));
  box.push(...pair('Pengambilan', o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil di warung'));
  box.push(...pair('Pembayaran', o.paymentMethod === 'cod' ? 'COD (tunai)' : 'QRIS / Transfer'));

  box.push(rule('├', '┤'), ...pair('TOTAL TAGIHAN', rupiah(o.total)));

  box.push(rule('├', '┤'), cell('DATA PEMESAN'));
  box.push(...field('Nama', o.customerName));
  box.push(...field('WhatsApp', displayPhone(o.customerPhone)));
  if (o.fulfillment === 'delivery') {
    box.push(...field('Desa', o.areaName ?? '-'));
    if (o.address) box.push(...field('Alamat', o.address));
    if (o.rtRw) box.push(...field('RT/RW', o.rtRw));
    if (o.landmark) box.push(...field('Patokan', o.landmark));
  }
  if (o.note) box.push(...field('Catatan', o.note));
  box.push(rule('└', '┘'));

  const closing =
    o.paymentMethod === 'qris_transfer'
      ? 'Mohon kirim detail pembayarannya. Terima kasih.'
      : 'Terima kasih.';
  return ['```', ...box, '```', closing].join('\n');
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
