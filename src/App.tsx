import { useMemo, useState } from 'react';
import { CategoryTabs } from './components/CategoryTabs';
import { Logo } from './components/Logo';
import { ProductCard } from './components/ProductCard';
import { WelcomeBanner } from './components/WelcomeBanner';
import { formatTime } from './lib/format';
import { useCatalog } from './lib/useCatalog';

export default function App() {
  const { state, retry } = useCatalog();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const data = state.status === 'ready' ? state.data : null;

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.products.filter(
      (p) => (categoryId === null || p.categoryId === categoryId) && (q === '' || p.name.toLowerCase().includes(q)),
    );
  }, [data, query, categoryId]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Logo />
          {data && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                data.settings.is_open ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'
              }`}
            >
              <span className={`size-1.5 rounded-full ${data.settings.is_open ? 'bg-emerald-500' : 'bg-stone-400'}`} />
              {data.settings.is_open ? 'Buka' : 'Tutup'}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <WelcomeBanner settings={data?.settings ?? null} />

        {data && !data.settings.is_open && (
          <p role="status" className="rounded-2xl bg-stone-900 px-4 py-3 text-center text-sm font-medium text-white">
            Maaf, toko sedang tutup 😇
          </p>
        )}

        {state.status === 'error' && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center">
            <p className="text-sm text-stone-600">Katalog belum bisa dimuat. Periksa koneksi Anda.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white"
            >
              Coba lagi
            </button>
          </div>
        )}

        {state.status !== 'error' && (
          <>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk…"
              aria-label="Cari produk"
              className="w-full rounded-full border border-stone-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-stone-400"
            />

            {data && data.categories.length > 0 && (
              <CategoryTabs categories={data.categories} value={categoryId} onChange={setCategoryId} />
            )}

            {state.status === 'loading' && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-stone-200" />
                ))}
              </div>
            )}

            {data && visible.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {visible.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {data && visible.length === 0 && (
              <p className="py-10 text-center text-sm text-stone-500">
                {data.products.length === 0 ? 'Belum ada produk.' : 'Produk tidak ditemukan.'}
              </p>
            )}
          </>
        )}
      </main>

      {data && (
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-sm text-stone-500">
          <div className="border-t border-stone-200 pt-4">
            <p className="font-medium text-stone-700">Lokasi warung</p>
            {data.settings.address && <p className="mt-1">{data.settings.address}</p>}
            <p className="mt-1">
              Buka {formatTime(data.settings.open_time)}–{formatTime(data.settings.close_time)} WIB
            </p>
            {data.settings.maps_url && (
              <a
                href={data.settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block font-medium text-brand underline underline-offset-2"
              >
                Buka di Google Maps
              </a>
            )}
            <p className="mt-4 text-xs text-stone-400">© Wr. Ujayy</p>
          </div>
        </footer>
      )}
    </div>
  );
}
