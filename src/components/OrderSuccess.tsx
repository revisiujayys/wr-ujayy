import { rupiah } from '../lib/format';
import type { OrderResult } from './Checkout';

export function OrderSuccess({ result, onDone }: { result: OrderResult; onDone: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700" aria-hidden="true">
        ✓
      </div>
      <h1 className="text-xl font-bold">Pesanan diterima</h1>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <p className="text-xs text-stone-500">Nomor pesanan</p>
        <p className="text-lg font-bold tracking-wide">{result.orderNumber}</p>
        <p className="mt-3 text-xs text-stone-500">Total pembayaran</p>
        <p className="text-2xl font-extrabold text-brand">{rupiah(result.total)}</p>
        {result.deliveryFee > 0 && (
          <p className="mt-1 text-xs text-stone-500">
            Termasuk ongkir {rupiah(result.deliveryFee)}
          </p>
        )}
      </section>

      <p className="text-sm text-stone-600">
        {result.paymentMethod === 'cod'
          ? 'Siapkan uang tunai saat pesanan diterima.'
          : 'Kirim pesan WhatsApp ke penjual untuk menerima detail pembayaran (QRIS/rekening).'}
      </p>

      {result.whatsappUrl ? (
        <a
          href={result.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white"
        >
          Kirim pesanan lewat WhatsApp
        </a>
      ) : (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
          Pesanan sudah tersimpan. Simpan nomor pesanan di atas dan hubungi penjual.
        </p>
      )}

      <p className="text-xs text-stone-500">
        Pesanan Anda sudah tersimpan meskipun WhatsApp tidak dibuka. Untuk membatalkan, hubungi admin lewat WhatsApp.
      </p>

      <button type="button" onClick={onDone} className="text-sm font-medium text-stone-600 underline underline-offset-2">
        Kembali ke katalog
      </button>
    </div>
  );
}
