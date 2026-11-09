import { useEffect, useState } from 'react';
import { formatWib, useNow } from '../lib/theme';
import { loadVisitors } from '../lib/visitors';

// Jam WIB berjalan + total pengunjung unik. Dipakai di halaman pelanggan dan admin.
export type StripCart = { count: number; disabled?: boolean; onOpen: () => void };

export function InfoStrip({ cart }: { cart?: StripCart }) {
  const { date, time } = formatWib(useNow(1000));
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    void loadVisitors().then((v) => {
      if (alive) setVisitors(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const cells = [
    { label: 'Tanggal', value: date, extra: '' },
    { label: 'Jam', value: `${time} WIB`, extra: 'tabular-nums' },
    { label: 'Pengunjung', value: visitors === null ? '–' : visitors.toLocaleString('id-ID'), extra: 'tabular-nums' },
  ];

  const hasItems = !!cart && cart.count > 0;

  return (
    <div className="border-t border-stone-200/70 bg-brand-soft/60 transition-colors duration-500">
      <dl
        className={`mx-auto grid max-w-5xl items-center divide-x divide-stone-200/80 px-1 py-1.5 ${
          cart ? 'grid-cols-[1.35fr_1fr_0.85fr_0.95fr]' : 'grid-cols-[1.4fr_1fr_0.8fr]'
        }`}
      >
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 px-2 text-center">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{c.label}</dt>
            <dd className={`truncate text-[11px] font-semibold text-stone-800 sm:text-xs ${c.extra}`}>{c.value}</dd>
          </div>
        ))}
        {cart && (
          <div className="px-1.5">
            <button
              type="button"
              onClick={cart.onOpen}
              disabled={cart.disabled || !hasItems}
              aria-label={hasItems ? `Buka keranjang, ${cart.count} item` : 'Keranjang kosong'}
              className={`block w-full rounded-xl px-2 py-1 text-center transition-colors ${
                hasItems ? 'bg-brand text-white shadow-sm' : 'bg-white/70 text-stone-500'
              } disabled:cursor-default`}
            >
              <span className="block text-[10px] font-medium uppercase tracking-wider opacity-80">Keranjang</span>
              <span className="block text-[11px] font-semibold tabular-nums sm:text-xs">
                {hasItems ? `${cart.count} item` : 'Kosong'}
              </span>
            </button>
          </div>
        )}
      </dl>
    </div>
  );
}
