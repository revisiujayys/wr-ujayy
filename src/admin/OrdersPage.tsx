import { useCallback, useEffect, useState } from 'react';
import { rupiah } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Btn, Card, ErrorNote, errorText, formatDateTime } from './ui';

type OrderItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  noodle_style: 'kuah' | 'goreng' | null;
  toppings: { name: string; price: number }[];
  quantity: number;
  line_total: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  fulfillment: 'delivery' | 'pickup';
  area_name: string | null;
  address: string | null;
  rt_rw: string | null;
  landmark: string | null;
  note: string | null;
  payment_method: 'cod' | 'qris_transfer';
  subtotal: number;
  delivery_fee: number;
  total: number;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
  order_items: OrderItem[];
};

type Filter = 'unpaid' | 'paid' | 'all';

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (loadError) setError('Gagal memuat pesanan');
    else {
      setError(null);
      setOrders(data as OrderRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    // Perbarui tiap 30 detik hanya saat tab terlihat; saat kembali ke tab, muat sekali.
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  async function setPaid(order: OrderRow, paid: boolean) {
    setBusyId(order.id);
    const { error: updateError } = await supabase.from('orders').update({ is_paid: paid }).eq('id', order.id);
    if (updateError) setError(errorText(updateError));
    await load();
    setBusyId(null);
  }

  async function remove(order: OrderRow) {
    if (!window.confirm(`Hapus pesanan ${order.order_number} dari ${order.customer_name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusyId(order.id);
    const { error: deleteError } = await supabase.from('orders').delete().eq('id', order.id);
    if (deleteError) setError(errorText(deleteError));
    await load();
    setBusyId(null);
  }

  const shown = orders.filter((o) => (filter === 'all' ? true : filter === 'paid' ? o.is_paid : !o.is_paid));
  const chip = (active: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium ${active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700'}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className={chip(filter === 'unpaid')} onClick={() => setFilter('unpaid')}>
            Belum bayar
          </button>
          <button type="button" className={chip(filter === 'paid')} onClick={() => setFilter('paid')}>
            Dibayar
          </button>
          <button type="button" className={chip(filter === 'all')} onClick={() => setFilter('all')}>
            Semua
          </button>
        </div>
        <Btn variant="ghost" onClick={() => void load()} className="px-3 py-1.5">
          Muat ulang
        </Btn>
      </div>

      <ErrorNote message={error} />
      {loading && <p className="py-8 text-center text-sm text-stone-500">Memuat…</p>}
      {!loading && shown.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Belum ada pesanan.</p>}

      <div className="grid items-start gap-3 md:grid-cols-2">
      {shown.map((o) => (
        <Card key={o.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{o.order_number}</p>
              <p className="text-xs text-stone-500">{formatDateTime(o.created_at)}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                o.is_paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {o.is_paid ? 'Sudah dibayar' : 'Belum dibayar'}
            </span>
          </div>

          <div className="mt-3 text-sm">
            <p className="font-medium">{o.customer_name}</p>
            <a href={`https://wa.me/${o.customer_phone}`} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">
              {o.customer_phone}
            </a>
            <p className="mt-1 text-stone-600">
              {o.fulfillment === 'delivery' ? `Delivery · ${o.area_name ?? '-'}` : 'Pickup di warung'} ·{' '}
              {o.payment_method === 'cod' ? 'COD' : 'QRIS/Transfer'}
            </p>
            {o.fulfillment === 'delivery' && (
              <p className="text-stone-600">
                {o.address}
                {o.rt_rw && `, RT/RW ${o.rt_rw}`}
                {o.landmark && ` (patokan: ${o.landmark})`}
              </p>
            )}
            {o.note && <p className="mt-1 rounded-lg bg-stone-50 px-2 py-1 text-stone-700">Catatan: {o.note}</p>}
          </div>

          <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
            {o.order_items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.product_name}
                  {i.variant_name && ` (${i.variant_name})`}
                  {i.noodle_style && ` · ${i.noodle_style === 'kuah' ? 'Kuah' : 'Goreng'}`} ×{i.quantity}
                  {i.toppings.length > 0 && <span className="block text-xs text-stone-500">+ {i.toppings.map((t) => t.name).join(', ')}</span>}
                </span>
                <span className="shrink-0">{rupiah(i.line_total)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-stone-100 pt-3 text-sm">
            <span className="text-stone-600">
              Ongkir {o.delivery_fee === 0 ? 'gratis' : rupiah(o.delivery_fee)}
            </span>
            <span className="text-base font-bold">{rupiah(o.total)}</span>
          </div>

          <div className="mt-3 flex gap-2">
            {o.is_paid ? (
              <Btn variant="ghost" disabled={busyId === o.id} onClick={() => void setPaid(o, false)} className="flex-1">
                Batalkan status bayar
              </Btn>
            ) : (
              <Btn disabled={busyId === o.id} onClick={() => void setPaid(o, true)} className="flex-1">
                Sudah Dibayar
              </Btn>
            )}
            <Btn variant="danger" disabled={busyId === o.id} onClick={() => void remove(o)}>
              Hapus
            </Btn>
          </div>
        </Card>
      ))}
      </div>
    </div>
  );
}
