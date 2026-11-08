import { rupiah } from '../lib/format';
import type { CatalogProduct } from '../lib/types';

export function ProductCard({ product, onAdd }: { product: CatalogProduct; onAdd: (p: CatalogProduct) => void }) {
  const soldOut = !product.available;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="relative aspect-square bg-stone-100">
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
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{product.name}</h3>
        <p className="mt-1 text-sm font-semibold text-brand">{rupiah(product.price)}</p>
        <button
          type="button"
          disabled={soldOut}
          onClick={() => onAdd(product)}
          className="mt-2 rounded-full bg-stone-900 py-1.5 text-sm font-medium text-white disabled:bg-stone-200 disabled:text-stone-500"
        >
          {soldOut ? 'Habis' : '+ Tambah'}
        </button>
      </div>
    </article>
  );
}
