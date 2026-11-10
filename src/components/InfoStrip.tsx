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
    <div
      className={`mx-auto grid max-w-5xl items-stretch gap-2 px-4 pb-3 pt-1 ${
        cart ? 'grid-cols-[1.35fr_1fr_0.85fr_auto]' : 'grid-cols-[1.4fr_1fr_0.8fr]'
      }`}
    >
      {cells.map((c) => (
        <div key={c.label} className="tile min-w-0 px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">{c.label}</p>
          <p className={`truncate text-[11px] font-semibold text-stone-800 sm:text-xs ${c.extra}`}>{c.value}</p>
        </div>
      ))}
        {cart && (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={cart.onOpen}
              disabled={cart.disabled || !hasItems}
              aria-label={hasItems ? `Buka keranjang, ${cart.count} item` : 'Keranjang kosong'}
              className={`relative grid size-11 place-items-center rounded-full transition-colors ${
                hasItems ? 'bg-brand text-white shadow-sm' : 'tile !rounded-full text-stone-400'
              } disabled:cursor-default`}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="20" r="1.3" />
                <circle cx="18" cy="20" r="1.3" />
                <path d="M2 3h3l2.7 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6" />
              </svg>
              {hasItems && (
                <span
                  key={cart.count}
                  className="badge-pop absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-stone-900 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
                >
                  {cart.count > 99 ? '99+' : cart.count}
                </span>
              )}
            </button>
          </div>
        )}
    </div>
  );
}
