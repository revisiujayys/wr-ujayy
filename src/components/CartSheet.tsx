import { rupiah } from '../lib/format';
import { describeItem, useCart, type CartItem } from '../lib/cart';
import { Sheet } from './Sheet';

type Props = {
  items: CartItem[];
  subtotal: number;
  hasProblem: boolean;
  isOpen: boolean;
  onClose: () => void;
  onCheckout: () => void;
};

export function CartSheet({ items, subtotal, hasProblem, isOpen, onClose, onCheckout }: Props) {
  const cart = useCart();

  return (
    <Sheet title="Keranjang" onClose={onClose}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-500">Keranjang masih kosong.</p>
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {items.map((item) => (
              <li key={item.line.key} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.product.name}</p>
                    {describeItem(item) && <p className="mt-0.5 text-xs text-stone-500">{describeItem(item)}</p>}
                    {item.problem && <p className="mt-0.5 text-xs font-medium text-red-600">{item.problem}, hapus dari keranjang</p>}
                  </div>
                  <p className="shrink-0 text-sm font-semibold">{rupiah(item.lineTotal)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Kurangi"
                      onClick={() => cart.setQty(item.line.key, item.line.quantity - 1)}
                      className="grid size-8 place-items-center rounded-full border border-stone-300"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{item.line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Tambah"
                      onClick={() => cart.setQty(item.line.key, item.line.quantity + 1)}
                      className="grid size-8 place-items-center rounded-full border border-stone-300"
                    >
                      +
                    </button>
                  </div>
                  <button type="button" onClick={() => cart.remove(item.line.key)} className="text-xs font-medium text-red-600">
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3">
            <span className="text-sm text-stone-600">Subtotal</span>
            <span className="text-base font-semibold">{rupiah(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-stone-500">Ongkir dan total akhir dihitung saat checkout.</p>

          {!isOpen && (
            <p role="status" className="mt-3 rounded-xl bg-stone-900 px-3 py-2 text-center text-sm font-medium text-white">
              Maaf, toko sedang tutup 😇
            </p>
          )}

          <button
            type="button"
            disabled={!isOpen || hasProblem}
            onClick={onCheckout}
            className="mt-3 w-full rounded-full bg-stone-900 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
          >
            Lanjut ke checkout
          </button>
        </>
      )}
    </Sheet>
  );
}
