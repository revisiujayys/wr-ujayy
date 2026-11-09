import { useState, type ReactNode } from 'react';
import { normalizePhone } from '../../api/_lib/orderLogic';
import { postJson } from '../lib/api';
import { describeItem, useCart, type CartItem } from '../lib/cart';
import { rupiah } from '../lib/format';
import type { Catalog } from '../lib/useCatalog';

export type OrderResult = {
  orderNumber: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: 'cod' | 'qris_transfer';
  whatsappUrl: string | null;
};

type Props = {
  catalog: Catalog;
  items: CartItem[];
  subtotal: number;
  onBack: () => void;
  onSuccess: (result: OrderResult) => void;
};

const inputCls =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-500';

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{text}</span>
      {children}
    </label>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
        active ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-800'
      }`}
    >
      {children}
    </button>
  );
}

export function Checkout({ catalog, items, subtotal, onBack, onSuccess }: Props) {
  const cart = useCart();
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery');
  const [areaId, setAreaId] = useState('');
  const [address, setAddress] = useState('');
  const [rtRw, setRtRw] = useState('');
  const [landmark, setLandmark] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<'cod' | 'qris_transfer'>('cod');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isDelivery = fulfillment === 'delivery';
  const area = catalog.areas.find((a) => a.id === areaId) ?? null;
  const fee = isDelivery && area ? area.fee : 0;
  const total = subtotal + fee;
  const belowMin = isDelivery && area !== null && subtotal < area.minOrder;
  const phoneNormalized = normalizePhone(phone);
  const isOpen = catalog.settings.is_open;

  function validate(): string | null {
    if (!name.trim()) return 'Nama penerima wajib diisi';
    if (!/^628\d{8,12}$/.test(phoneNormalized)) return 'Nomor WhatsApp tidak valid (contoh: 0812xxxxxxxx)';
    if (isDelivery) {
      if (!area) return 'Pilih desa pengiriman';
      if (address.trim().length < 5) return 'Alamat lengkap wajib diisi';
      if (subtotal < area.minOrder) return `Minimum belanja untuk ${area.name} adalah ${rupiah(area.minOrder)}`;
    }
    return null;
  }

  function goReview() {
    const problem = validate();
    setError(problem);
    if (!problem) setStep('review');
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await postJson<OrderResult>('/api/order', {
      customerName: name.trim(),
      customerPhone: phone,
      fulfillment,
      areaId: isDelivery ? areaId : undefined,
      address: isDelivery ? address.trim() : undefined,
      rtRw: isDelivery ? rtRw.trim() : undefined,
      landmark: isDelivery ? landmark.trim() : undefined,
      note: note.trim(),
      paymentMethod: payment,
      items: items.map((i) => ({
        productId: i.line.productId,
        variantId: i.line.variantId,
        quantity: i.line.quantity,
        noodleStyle: i.line.noodleStyle,
        toppingIds: i.line.toppingIds,
      })),
    });
    setBusy(false);
    if (res.ok) {
      cart.clear();
      onSuccess(res.data);
    } else {
      setError(res.error);
      setStep('form');
    }
  }

  const summary = (
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">Pesanan Anda</h2>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.line.key} className="flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p>
                {i.product.name} <span className="text-stone-500">×{i.line.quantity}</span>
              </p>
              {describeItem(i) && <p className="text-xs text-stone-500">{describeItem(i)}</p>}
            </div>
            <span className="shrink-0">{rupiah(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-stone-600">Subtotal</dt>
          <dd>{rupiah(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-stone-600">Ongkir</dt>
          <dd>{!isDelivery ? '–' : area ? (fee === 0 ? 'Gratis' : rupiah(fee)) : 'Pilih desa dulu'}</dd>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <dt>Total</dt>
          <dd>{rupiah(total)}</dd>
        </div>
      </dl>
    </section>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={step === 'review' ? () => setStep('form') : onBack} className="text-sm font-medium text-stone-600">
        ← {step === 'review' ? 'Ubah data' : 'Kembali ke katalog'}
      </button>
      <h1 className="text-xl font-bold">{step === 'review' ? 'Periksa pesanan' : 'Checkout'}</h1>

      {!isOpen && (
        <p role="status" className="rounded-2xl bg-stone-900 px-4 py-3 text-center text-sm font-medium text-white">
          Maaf, toko sedang tutup 😇
        </p>
      )}

      {step === 'form' && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            <Label text="Nama penerima">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </Label>
            <Label text="Nomor WhatsApp">
              <input
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="0812xxxxxxxx"
                maxLength={20}
                autoComplete="tel"
              />
            </Label>
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Pengambilan</h2>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={isDelivery} onClick={() => setFulfillment('delivery')}>
                Delivery
              </Choice>
              <Choice active={!isDelivery} onClick={() => setFulfillment('pickup')}>
                Pickup
              </Choice>
            </div>

            {isDelivery ? (
              <>
                <p className="text-xs text-stone-500">Delivery hanya untuk Kecamatan Jatibarang, Kabupaten Indramayu.</p>
                <Label text="Desa">
                  <select className={inputCls} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                    <option value="">Pilih desa…</option>
                    {catalog.areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </Label>
                {area && (
                  <p className={`text-xs ${belowMin ? 'font-medium text-red-600' : 'text-stone-500'}`}>
                    Minimum belanja {rupiah(area.minOrder)} · Ongkir {area.fee === 0 ? 'gratis' : rupiah(area.fee)}
                    {belowMin && ` · Tambah ${rupiah(area.minOrder - subtotal)} lagi`}
                  </p>
                )}
                <Label text="Alamat lengkap">
                  <textarea className={inputCls} rows={3} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Label text="RT/RW (opsional)">
                    <input className={inputCls} value={rtRw} onChange={(e) => setRtRw(e.target.value)} maxLength={20} placeholder="01/02" />
                  </Label>
                  <Label text="Patokan (opsional)">
                    <input className={inputCls} value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={200} />
                  </Label>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-brand-soft p-3 text-sm text-stone-700">
                <p className="font-medium">Ambil di warung, tanpa ongkir dan tanpa minimum belanja.</p>
                <p className="mt-1">Pesanan baru dibuat saat Anda datang, tidak perlu pilih jam.</p>
                {catalog.settings.address && <p className="mt-2">{catalog.settings.address}</p>}
                {catalog.settings.maps_url && (
                  <a
                    href={catalog.settings.maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-medium text-brand underline underline-offset-2"
                  >
                    Buka di Google Maps
                  </a>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Pembayaran</h2>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={payment === 'cod'} onClick={() => setPayment('cod')}>
                COD
              </Choice>
              <Choice active={payment === 'qris_transfer'} onClick={() => setPayment('qris_transfer')}>
                QRIS / Transfer
              </Choice>
            </div>
            <p className="text-xs text-stone-500">
              {payment === 'cod'
                ? 'Bayar tunai saat pesanan diterima.'
                : 'Detail pembayaran (QRIS/rekening) dikirim penjual lewat WhatsApp setelah Anda memesan.'}
            </p>
            <Label text="Catatan pesanan (opsional)">
              <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Label>
          </section>
          </div>

          <div className="space-y-4 md:sticky md:top-20">
            {summary}

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={!isOpen}
              onClick={goReview}
              className="w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
            >
              Periksa pesanan
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <>
          <div className="grid items-start gap-4 md:grid-cols-2">
          {summary}

          <section className="space-y-1 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
            <p>
              <span className="text-stone-500">Nama: </span>
              {name.trim()}
            </p>
            <p>
              <span className="text-stone-500">WhatsApp: </span>
              {phoneNormalized}
            </p>
            {isDelivery ? (
              <>
                <p>
                  <span className="text-stone-500">Delivery ke: </span>
                  {area?.name}
                </p>
                <p>
                  <span className="text-stone-500">Alamat: </span>
                  {address.trim()}
                  {rtRw.trim() && `, RT/RW ${rtRw.trim()}`}
                </p>
                {landmark.trim() && (
                  <p>
                    <span className="text-stone-500">Patokan: </span>
                    {landmark.trim()}
                  </p>
                )}
              </>
            ) : (
              <p>
                <span className="text-stone-500">Pengambilan: </span>Pickup di warung
              </p>
            )}
            <p>
              <span className="text-stone-500">Pembayaran: </span>
              {payment === 'cod' ? 'COD (tunai saat diterima)' : 'QRIS / Transfer'}
            </p>
            {note.trim() && (
              <p>
                <span className="text-stone-500">Catatan: </span>
                {note.trim()}
              </p>
            )}
          </section>
          </div>

          <p className="text-xs text-stone-500">
            Pembatalan tidak bisa dilakukan lewat website. Hubungi admin lewat WhatsApp jika ingin membatalkan.
          </p>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !isOpen}
            onClick={submit}
            className="w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
          >
            {busy ? 'Memproses…' : `Pesan sekarang · ${rupiah(total)}`}
          </button>
        </>
      )}
    </div>
  );
}
