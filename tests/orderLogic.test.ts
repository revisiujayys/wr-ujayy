import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  priceOrder,
  OrderError,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  normalizePhone,
  rupiah,
  type ProductRow,
  type ToppingRow,
  type AreaRow,
} from '../api/_lib/orderLogic.ts';

// Data uji fiktif — hanya untuk menguji rumus, bukan harga asli warung.
const drink: ProductRow = {
  id: 'p-drink', name: 'Minuman Uji', base_price: 4000, product_type: 'regular',
  is_active: true, is_available: true,
  product_variants: [
    { id: 'v-a', name: 'Rasa A', is_available: true },
    { id: 'v-b', name: 'Rasa B', is_available: false },
  ],
};
const noodle: ProductRow = {
  id: 'p-noodle', name: 'Mie Uji', base_price: 8000, product_type: 'noodle',
  is_active: true, is_available: true, product_variants: [],
};
const soldOut: ProductRow = {
  id: 'p-out', name: 'Habis Uji', base_price: 1000, product_type: 'regular',
  is_active: true, is_available: true,
  product_variants: [{ id: 'v-x', name: 'X', is_available: false }],
};
const products = new Map([drink, noodle, soldOut].map((p) => [p.id, p]));
const toppings = new Map<string, ToppingRow>([
  ['t-egg', { id: 't-egg', name: 'Telur', price: 3000, is_available: true }],
  ['t-off', { id: 't-off', name: 'Sosis', price: 2000, is_available: false }],
]);
const near: AreaRow = { id: 'a1', name: 'Dekat', min_order: 15000, delivery_fee: 5000, is_active: true };
const free: AreaRow = { id: 'a2', name: 'Gratis', min_order: 10000, delivery_fee: 0, is_active: true };

test('harga: varian memakai harga utama produk, topping dihitung per porsi', () => {
  const r = priceOrder(
    { fulfillment: 'pickup', items: [
      { productId: 'p-drink', variantId: 'v-a', quantity: 2 },
      { productId: 'p-noodle', quantity: 2, noodleStyle: 'goreng', toppingIds: ['t-egg'] },
    ] },
    products, toppings, null,
  );
  assert.equal(r.items[0].line_total, 8000);
  assert.equal(r.items[1].line_total, (8000 + 3000) * 2);
  assert.equal(r.subtotal, 30000);
  assert.equal(r.total, 30000);
});

test('pickup: tanpa ongkir dan tanpa minimum belanja', () => {
  const r = priceOrder({ fulfillment: 'pickup', items: [{ productId: 'p-drink', variantId: 'v-a', quantity: 1 }] }, products, toppings, near);
  assert.equal(r.deliveryFee, 0);
  assert.equal(r.total, 4000);
});

test('delivery: ongkir ditambahkan dan minimum belanja dicek', () => {
  const ok = priceOrder({ fulfillment: 'delivery', items: [{ productId: 'p-noodle', quantity: 2, noodleStyle: 'kuah' }] }, products, toppings, near);
  assert.equal(ok.total, 16000 + 5000);
  assert.throws(
    () => priceOrder({ fulfillment: 'delivery', items: [{ productId: 'p-drink', variantId: 'v-a', quantity: 1 }] }, products, toppings, near),
    (e: unknown) => e instanceof OrderError && e.message.includes('Rp15.000'),
  );
});

test('delivery: ongkir gratis dan minimum Rp10.000', () => {
  const r = priceOrder({ fulfillment: 'delivery', items: [{ productId: 'p-noodle', quantity: 2, noodleStyle: 'kuah' }] }, products, toppings, free);
  assert.equal(r.deliveryFee, 0);
  assert.equal(r.total, 16000);
});

test('delivery tanpa desa valid ditolak', () => {
  assert.throws(() => priceOrder({ fulfillment: 'delivery', items: [{ productId: 'p-noodle', quantity: 2, noodleStyle: 'kuah' }] }, products, toppings, null), OrderError);
});

test('varian nonaktif, produk dengan semua varian nonaktif, dan topping habis ditolak', () => {
  assert.throws(() => priceOrder({ fulfillment: 'pickup', items: [{ productId: 'p-drink', variantId: 'v-b', quantity: 1 }] }, products, toppings, null), /habis/);
  assert.throws(() => priceOrder({ fulfillment: 'pickup', items: [{ productId: 'p-out', variantId: 'v-x', quantity: 1 }] }, products, toppings, null), /habis/);
  assert.throws(() => priceOrder({ fulfillment: 'pickup', items: [{ productId: 'p-noodle', quantity: 1, noodleStyle: 'kuah', toppingIds: ['t-off'] }] }, products, toppings, null), /habis/);
});

test('input tidak konsisten ditolak', () => {
  const run = (item: object) => () => priceOrder({ fulfillment: 'pickup', items: [item as never] }, products, toppings, null);
  assert.throws(run({ productId: 'p-drink', quantity: 1 }), OrderError); // varian wajib
  assert.throws(run({ productId: 'p-noodle', quantity: 1 }), OrderError); // kuah/goreng wajib
  assert.throws(run({ productId: 'p-drink', variantId: 'v-a', quantity: 1, toppingIds: ['t-egg'] }), OrderError);
  assert.throws(run({ productId: 'tidak-ada', quantity: 1 }), OrderError);
});

test('topping ganda pada satu item hanya dihitung sekali', () => {
  const r = priceOrder({ fulfillment: 'pickup', items: [{ productId: 'p-noodle', quantity: 1, noodleStyle: 'kuah', toppingIds: ['t-egg', 't-egg'] }] }, products, toppings, null);
  assert.equal(r.total, 11000);
});

test('normalisasi nomor & format rupiah', () => {
  assert.equal(normalizePhone('0812-3456 789'), '628123456789');
  assert.equal(normalizePhone('+62 812 3456 789'), '628123456789');
  assert.equal(normalizePhone('812345678'), '62812345678');
  assert.equal(rupiah(1234567), 'Rp1.234.567');
});

test('pesan WhatsApp memuat ringkasan dan URL ter-encode', () => {
  const r = priceOrder({ fulfillment: 'delivery', items: [{ productId: 'p-noodle', quantity: 2, noodleStyle: 'goreng', toppingIds: ['t-egg'] }] }, products, toppings, near);
  const msg = buildWhatsAppMessage({
    orderNumber: 'UJ-TEST-0001', customerName: 'Budi', customerPhone: '628123456789',
    fulfillment: 'delivery', areaName: near.name, address: 'Jl. Uji 1', rtRw: null, landmark: null, note: 'Pedas',
    paymentMethod: 'cod', items: r.items, subtotal: r.subtotal, deliveryFee: r.deliveryFee, total: r.total,
  });
  assert.match(msg, /UJ-TEST-0001/);
  assert.match(msg, /1\. Mie Uji - Goreng\n/);
  assert.match(msg, /\+ Telur\n\s+2 × Rp11\.000 = Rp22\.000/);
  assert.match(msg, /\*Total: Rp27\.000\*/);
  assert.match(msg, /WhatsApp: \+62 812-3456-789/);
  assert.doesNotMatch(msg, /Mohon kirim detail/); // COD: tanpa permintaan detail pembayaran
  assert.equal(buildWhatsAppUrl(null, msg), null);
  assert.ok(buildWhatsAppUrl('628100000000', msg)!.startsWith('https://wa.me/628100000000?text=Halo'));
});
