import { useEffect, useState } from 'react';
import { formatWib, useNow } from '../lib/theme';
import { loadVisitors } from '../lib/visitors';

// Jam WIB berjalan + total pengunjung unik. Dipakai di halaman pelanggan dan admin.
export function InfoStrip() {
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

  return (
    <div className="border-t border-stone-200/70 bg-brand-soft/60 transition-colors duration-500">
      <dl className="mx-auto grid max-w-5xl grid-cols-[1.4fr_1fr_0.8fr] divide-x divide-stone-200/80 px-1 py-1.5">
        {cells.map((c) => (
          <div key={c.label} className="min-w-0 px-3 text-center">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-stone-500">{c.label}</dt>
            <dd className={`truncate text-xs font-semibold text-stone-800 ${c.extra}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
