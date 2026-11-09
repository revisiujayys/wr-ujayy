import { useState } from 'react';
import { Sheet } from '../components/Sheet';
import { postJson } from '../lib/api';
import { uploadImage } from '../lib/images';
import { supabase } from '../lib/supabase';
import { Btn, ErrorNote } from './ui';

type Photo = { id: number; thumb: string; image: string; photographer: string; pageUrl: string };

// Cari foto produk lewat Pexels (API resmi). Foto yang dipilih disalin ke penyimpanan sendiri.
export function ImageSearch({
  initialQuery,
  onPick,
  onClose,
}: {
  initialQuery: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setError('Tulis kata kunci minimal 2 huruf');
      return;
    }
    setBusy(true);
    setError(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setError('Sesi habis, silakan login ulang');
      setBusy(false);
      return;
    }
    const res = await postJson<{ photos: Photo[] }>('/api/image-search', { query: q }, { Authorization: `Bearer ${token}` });
    if (res.ok) setPhotos(res.data.photos);
    else setError(res.error);
    setBusy(false);
  }

  async function pick(photo: Photo) {
    setBusy(true);
    setError(null);
    try {
      const blob = await (await fetch(photo.image)).blob();
      const file = new File([blob], 'pexels.jpg', { type: blob.type || 'image/jpeg' });
      onPick(await uploadImage(file, 'products', 'pexels-'));
      onClose();
    } catch {
      // Jika penyalinan gagal, pakai tautan langsung dari Pexels.
      onPick(photo.image);
      onClose();
    }
    setBusy(false);
  }

  return (
    <Sheet title="Cari foto produk" onClose={onClose}>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mis. mie goreng"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
        />
        <Btn type="submit" disabled={busy}>
          Cari
        </Btn>
      </form>
      <div className="mt-3 space-y-3">
        <ErrorNote message={error} />
        {photos && photos.length === 0 && <p className="text-sm text-stone-500">Foto tidak ditemukan. Coba kata kunci lain.</p>}
        {photos && photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void pick(p)}
                  className="block aspect-square w-full overflow-hidden rounded-xl bg-stone-100"
                >
                  <img src={p.thumb} alt={`Foto oleh ${p.photographer}`} loading="lazy" className="size-full object-cover" />
                </button>
                <p className="mt-0.5 truncate text-[10px] text-stone-400">{p.photographer}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-stone-400">
          Foto dari{' '}
          <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">
            Pexels
          </a>
          . Foto hanya contoh, pastikan sesuai dengan produk Anda.
        </p>
      </div>
    </Sheet>
  );
}
