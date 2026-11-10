import { rupiah } from '../lib/format';
import type { CatalogProduct } from '../lib/types';

export function ProductCard({
  product,
  index = 0,
  qty = 0,
  onAdd,
  onSetQty,
}: {
  product: CatalogProduct;
  index?: number;
  // Jumlah di keranjang untuk produk polos (tanpa varian/topping); 0 = belum ada.
  qty?: number;
  onAdd: (p: CatalogProduct) => void;
  onSetQty?: (qty: number) => void;
}) {
  const soldOut = !product.available;
  const setQty = qty > 0 ? onSetQty : undefined;
  return (
    <article
      className="reveal surface flex flex-col overflow-hidden p-2 transition-shadow duration-300 hover:shadow-lg"
      style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
    >
      <div className="relative aspect-square overflow-hidden rounded-[1.1rem] bg-stone-100">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className={`size-full object-cover ${soldOut ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="grid size-full place-items-center text-stone-300" aria-hidden="true">
            <svg viewBox="0 0 32 32" className="size-12">
              <path d="M4 16h24a12 12 0 0 1-24 0z" fill="currentColor" />
            </svg>
          </div>
        )}
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">Habis</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col px-1.5 pb-1 pt-2.5">
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{product.name}</h3>
        <p className="mt-1 text-base font-bold text-brand">{rupiah(product.price)}</p>
        {setQty ? (
          <div className="mt-2.5 flex items-center justify-between rounded-full bg-brand-soft p-1">
            <button
              type="button"
              aria-label="Kurangi"
              onClick={() => setQty(qty - 1)}
              className="grid size-8 place-items-center rounded-full bg-white text-lg font-semibold text-brand shadow-sm"
            >
              −
            </button>
            <span className="text-sm font-bold tabular-nums">{qty}</span>
            <button
              type="button"
              aria-label="Tambah"
              onClick={() => setQty(qty + 1)}
              className="grid size-8 place-items-center rounded-full bg-brand text-lg font-semibold text-white shadow-sm"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={soldOut}
            onClick={() => onAdd(product)}
            className="mt-2.5 rounded-full bg-brand py-2 text-sm font-semibold text-white shadow-sm disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-none"
          >
            {soldOut ? 'Habis' : '+ Tambah'}
          </button>
        )}
      </div>
    </article>
  );
}
