import { useState } from 'react';
import { rupiah } from '../lib/format';
import type { AddInput } from '../lib/cart';
import type { CatalogProduct, Topping } from '../lib/types';
import { Sheet } from './Sheet';

type Props = {
  product: CatalogProduct;
  toppings: Topping[];
  onClose: () => void;
  onAdd: (input: AddInput) => void;
};

export function ProductSheet({ product, toppings, onClose, onAdd }: Props) {
  const isNoodle = product.productType === 'noodle';
  const hasVariants = product.variants.length > 0;
  const [variantId, setVariantId] = useState<string>(product.variants.find((v) => v.available)?.id ?? '');
  const [style, setStyle] = useState<'kuah' | 'goreng'>('kuah');
  const [picked, setPicked] = useState<string[]>([]);
  const [qty, setQty] = useState(1);

  const toppingsTotal = toppings.filter((t) => picked.includes(t.id)).reduce((sum, t) => sum + t.price, 0);
  const total = (product.price + toppingsTotal) * qty;
  const canAdd = !hasVariants || variantId !== '';
  const selectedVariant = product.variants.find((v) => v.id === variantId);
  const shownImage = selectedVariant?.imageUrl ?? product.imageUrl ?? product.variants.find((v) => v.imageUrl)?.imageUrl ?? null;

  const toggleTopping = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const choice = (active: boolean, disabled = false) =>
    `flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-left text-sm transition-colors ${
      disabled ? 'bg-stone-50 text-stone-400' : active ? 'bg-brand text-white shadow-sm' : 'bg-stone-100 text-stone-800'
    }`;

  return (
    <Sheet title={product.name} onClose={onClose}>
      {shownImage && (
        <div className="mb-3 overflow-hidden rounded-3xl bg-stone-100">
          <img key={shownImage} src={shownImage} alt={product.name} className="reveal-fade aspect-[4/3] w-full object-contain" />
        </div>
      )}
      <p className="text-sm font-semibold text-brand">{rupiah(product.price)}</p>

      {hasVariants && (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-medium text-stone-700">Pilih varian</h3>
          <div className="grid gap-2">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={!v.available}
                onClick={() => setVariantId(v.id)}
                className={choice(variantId === v.id, !v.available)}
              >
                <span className="flex items-center gap-2.5">
                  {v.imageUrl && <img src={v.imageUrl} alt="" className="size-9 rounded-lg bg-white object-cover" />}
                  {v.name}
                </span>
                {!v.available && <span className="text-xs">Habis</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      {isNoodle && (
        <>
          <section className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-stone-700">Disajikan</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setStyle('kuah')} className={choice(style === 'kuah')}>
                Kuah
              </button>
              <button type="button" onClick={() => setStyle('goreng')} className={choice(style === 'goreng')}>
                Goreng
              </button>
            </div>
          </section>

          {toppings.length > 0 && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-stone-700">Topping (opsional)</h3>
              <div className="grid gap-2">
                {toppings.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!t.available}
                    onClick={() => toggleTopping(t.id)}
                    className={choice(picked.includes(t.id), !t.available)}
                  >
                    <span>{t.name}</span>
                    <span className="text-xs">{t.available ? `+${rupiah(t.price)}` : 'Habis'}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">Jumlah</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Kurangi"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="grid size-9 place-items-center rounded-full bg-stone-100 text-lg font-semibold"
          >
            −
          </button>
          <span className="w-6 text-center font-medium">{qty}</span>
          <button
            type="button"
            aria-label="Tambah"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="grid size-9 place-items-center rounded-full bg-stone-100 text-lg font-semibold"
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!canAdd}
        onClick={() =>
          onAdd({
            productId: product.id,
            variantId: hasVariants ? variantId : undefined,
            noodleStyle: isNoodle ? style : undefined,
            toppingIds: isNoodle ? picked : [],
            quantity: qty,
          })
        }
        className="mt-5 w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
      >
        Tambah ke keranjang · {rupiah(total)}
      </button>
    </Sheet>
  );
}
