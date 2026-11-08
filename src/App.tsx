import { useEffect, useMemo, useRef, useState } from 'react';
import { CartSheet } from './components/CartSheet';
import { CategoryTabs } from './components/CategoryTabs';
import { Checkout, type OrderResult } from './components/Checkout';
import { Logo } from './components/Logo';
import { OrderSuccess } from './components/OrderSuccess';
import { ProductCard } from './components/ProductCard';
import { ProductSheet } from './components/ProductSheet';
import { WelcomeBanner } from './components/WelcomeBanner';
import { priceCart, useCart, type AddInput } from './lib/cart';
import { formatTime, rupiah } from './lib/format';
import { trackVisit } from './lib/track';
import type { CatalogProduct } from './lib/types';
import { useCatalog } from './lib/useCatalog';

type View = 'catalog' | 'checkout' | 'success';

const LAST_ORDER_KEY = 'wr-ujayy-last-order';

function loadLastOrder(): OrderResult | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as OrderResult) : null;
  } catch {
    return null;
  }
}

function saveLastOrder(result: OrderResult | null) {
  try {
    if (result) sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(result));
    else sessionStorage.removeItem(LAST_ORDER_KEY);
  } catch {
    // diabaikan
  }
}

export default function App() {
  const { state, retry } = useCatalog();
  const cart = useCart();
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<CatalogProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderResult | null>(loadLastOrder);
  const [view, setView] = useState<View>(lastOrder ? 'success' : 'catalog');
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackVisit('/');
  }, []);

  const data = state.status === 'ready' ? state.data : null;

  const visible = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.products.filter(
      (p) => (categoryId === null || p.categoryId === categoryId) && (q === '' || p.name.toLowerCase().includes(q)),
    );
  }, [data, query, categoryId]);

  const priced = useMemo(() => (data ? priceCart(cart.lines, data) : null), [data, cart.lines]);

  function handleAdd(product: CatalogProduct) {
    const needsOptions = product.productType === 'noodle' || product.variants.length > 0;
    if (needsOptions) setSheetProduct(product);
    else cart.add({ productId: product.id, toppingIds: [], quantity: 1 });
  }

  function handleSheetAdd(input: AddInput) {
    cart.add(input);
    setSheetProduct(null);
  }

  function finishOrder(result: OrderResult) {
    saveLastOrder(result);
    setLastOrder(result);
    setView('success');
    window.scrollTo({ top: 0 });
  }

  function leaveSuccess() {
    saveLastOrder(null);
    setLastOrder(null);
    setView('catalog');
  }

  return (
    <div className="min-h-dvh pb-24">
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
        {view === 'success' && lastOrder && <OrderSuccess result={lastOrder} onDone={leaveSuccess} />}

        {view === 'checkout' && data && priced && (
          <Checkout
            catalog={data}
            items={priced.items}
            subtotal={priced.subtotal}
            onBack={() => setView('catalog')}
            onSuccess={finishOrder}
          />
        )}

        {view === 'catalog' && (
          <>
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
                      <ProductCard key={p.id} product={p} onAdd={handleAdd} />
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
          </>
        )}
      </main>

      {data && view !== 'success' && (
        <footer className="mx-auto max-w-5xl px-4 pb-6 pt-4 text-sm text-stone-500">
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

      {data && view === 'catalog' && cart.count > 0 && priced && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-4">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-lg items-center justify-between rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
          >
            <span>Keranjang · {cart.count} item</span>
            <span>{rupiah(priced.subtotal)}</span>
          </button>
        </div>
      )}

      {data && sheetProduct && (
        <ProductSheet
          product={sheetProduct}
          toppings={data.toppings}
          onClose={() => setSheetProduct(null)}
          onAdd={handleSheetAdd}
        />
      )}

      {data && priced && cartOpen && (
        <CartSheet
          items={priced.items}
          subtotal={priced.subtotal}
          hasProblem={priced.hasProblem}
          isOpen={data.settings.is_open}
          onClose={() => setCartOpen(false)}
          onCheckout={() => {
            setCartOpen(false);
            setView('checkout');
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
}
