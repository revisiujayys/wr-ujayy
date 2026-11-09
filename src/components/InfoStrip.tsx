import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatWib, useNow } from '../lib/theme';

// Jam WIB berjalan + total pengunjung unik. Dipakai di halaman pelanggan dan admin.
export function InfoStrip() {
  const { date, time } = formatWib(useNow(1000));
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    // Sedikit ditunda agar kunjungan ini ikut tercatat lebih dulu.
    const id = window.setTimeout(() => {
      void supabase.rpc('visitor_total').then(({ data, error }) => {
        if (!error && typeof data === 'number') setVisitors(data);
        else if (!error && typeof data === 'string') setVisitors(Number(data));
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="border-t border-brand/10 bg-brand-soft/70 transition-colors duration-500">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-1 text-[11px] text-stone-600">
        <time className="truncate" aria-label="Waktu WIB saat ini">
          {date} · <span className="font-semibold tabular-nums text-stone-800">{time}</span> WIB
        </time>
        {visitors !== null && (
          <span className="shrink-0" title="Total pengunjung unik">
            👥 <span className="font-semibold tabular-nums text-stone-800">{visitors.toLocaleString('id-ID')}</span> pengunjung
          </span>
        )}
      </div>
    </div>
  );
}
