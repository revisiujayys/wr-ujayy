import { supabase } from './supabase';

let cached: Promise<number | null> | null = null;

// Total pengunjung unik, diambil sekali. Sedikit ditunda agar kunjungan ini ikut tercatat lebih dulu.
export function loadVisitors(): Promise<number | null> {
  if (!cached) {
    cached = new Promise((resolve) => {
      window.setTimeout(() => {
        void supabase.rpc('visitor_total').then(
          ({ data, error }) => {
            const n = Number(data);
            resolve(!error && data !== null && Number.isFinite(n) ? n : null);
          },
          () => resolve(null),
        );
      }, 800);
    });
  }
  return cached;
}
