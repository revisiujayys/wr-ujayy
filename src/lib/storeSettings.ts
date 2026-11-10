import { supabase } from './supabase';
import type { StoreSettings } from './types';

export type StoreRow = StoreSettings & { day_themes: unknown };

// Satu-satunya tempat yang mengambil tabel store_settings. Hasilnya dipakai bersama oleh katalog, tema harian,
// dan halaman Toko admin, jadi satu pemuatan halaman hanya membuat SATU permintaan ke server.
let cached: Promise<StoreRow> | null = null;

export function getStoreSettings(fresh = false): Promise<StoreRow> {
  if (!cached || fresh) {
    const request = Promise.resolve(supabase.from('store_settings').select('*').eq('id', 1).single()).then(
      ({ data, error }) => {
        if (error || !data) throw new Error('Gagal memuat pengaturan toko');
        return data as StoreRow;
      },
    );
    cached = request;
    // Jika gagal, buang cache supaya percobaan ulang benar-benar meminta lagi.
    request.catch(() => {
      if (cached === request) cached = null;
    });
  }
  return cached;
}

// Setelah admin menyimpan perubahan, cukup perbarui cache (tanpa meminta ulang ke server).
export function patchStoreSettings(patch: Partial<StoreRow>): void {
  if (cached) cached = cached.then((row) => ({ ...row, ...patch }));
}
