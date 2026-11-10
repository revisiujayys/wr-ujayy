import { useEffect, useState } from 'react';
import { formatWib, useNow } from '../lib/theme';
import { loadVisitors } from '../lib/visitors';

// Jam WIB berjalan + total pengunjung unik. Berada di alur halaman (bukan menempel), jadi ikut hilang saat digulir.
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
    <div className="mx-auto grid max-w-5xl grid-cols-[1.4fr_1fr_0.8fr] gap-2 px-4 pt-3">
      {cells.map((c) => (
        <div key={c.label} className="tile min-w-0 px-2.5 py-1.5 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wider text-stone-400">{c.label}</p>
          <p className={`truncate text-[11px] font-semibold text-stone-800 sm:text-xs ${c.extra}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
