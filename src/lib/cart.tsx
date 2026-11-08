import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Catalog } from './useCatalog';
import type { CatalogProduct, Topping } from './types';

// Keranjang hanya menyimpan ID dan pilihan. Nama dan harga selalu dibaca dari katalog terbaru,
// dan total final tetap dihitung ulang oleh server saat checkout.
export type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  noodleStyle?: 'kuah' | 'goreng';
  toppingIds: string[];
  quantity: number;
};

export type AddInput = Omit<CartLine, 'key'>;

const STORAGE_KEY = 'wr-ujayy-cart-v1';

function makeKey(l: AddInput): string {
  return [l.productId, l.variantId ?? '', l.noodleStyle ?? '', [...l.toppingIds].sort().join(',')].join('|');
}

function isLine(v: unknown): v is CartLine {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.key === 'string' &&
    typeof o.productId === 'string' &&
    Array.isArray(o.toppingIds) &&
    typeof o.quantity === 'number' &&
    o.quantity >= 1 &&
    o.quantity <= 99
  );
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLine) : [];
  } catch {
    return [];
  }
}

type CartApi = {
  lines: CartLine[];
  count: number;
  add: (input: AddInput) => void;
  setQty: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // penyimpanan diblokir: keranjang tetap jalan di memori
    }
  }, [lines]);

  const add = useCallback((input: AddInput) => {
    const key = makeKey(input);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + input.quantity) } : l));
      }
      return [...prev, { ...input, key }];
    });
  }, []);

  const setQty = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.key !== key)
        : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, quantity) } : l)),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartApi>(
    () => ({ lines, count: lines.reduce((n, l) => n + l.quantity, 0), add, setQty, remove, clear }),
    [lines, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart harus dipakai di dalam CartProvider');
  return ctx;
}

export type CartItem = {
  line: CartLine;
  product: CatalogProduct;
  variantName: string | null;
  toppings: Topping[];
  unitPrice: number; // harga produk + topping, per porsi
  lineTotal: number;
  problem: string | null; // alasan item tidak bisa dipesan saat ini
};

export function describeItem(item: CartItem): string {
  const parts: string[] = [];
  if (item.variantName) parts.push(item.variantName);
  if (item.line.noodleStyle) parts.push(item.line.noodleStyle === 'kuah' ? 'Kuah' : 'Goreng');
  if (item.toppings.length > 0) parts.push('+ ' + item.toppings.map((t) => t.name).join(', '));
  return parts.join(' · ');
}

export function priceCart(lines: CartLine[], catalog: Catalog): { items: CartItem[]; subtotal: number; hasProblem: boolean } {
  const items: CartItem[] = [];
  for (const line of lines) {
    const product = catalog.products.find((p) => p.id === line.productId);
    if (!product) continue; // produk sudah dihapus/disembunyikan
    const variant = line.variantId ? product.variants.find((v) => v.id === line.variantId) : undefined;
    const toppings = line.toppingIds
      .map((id) => catalog.toppings.find((t) => t.id === id))
      .filter((t): t is Topping => t !== undefined);

    let problem: string | null = null;
    if (!product.available) problem = 'Habis';
    else if (line.variantId && (!variant || !variant.available)) problem = 'Varian habis';
    else if (toppings.length !== line.toppingIds.length || toppings.some((t) => !t.available)) problem = 'Topping habis';

    const unitPrice = product.price + toppings.reduce((sum, t) => sum + t.price, 0);
    items.push({
      line,
      product,
      variantName: variant?.name ?? null,
      toppings,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
      problem,
    });
  }
  return {
    items,
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
    hasProblem: items.some((i) => i.problem !== null),
  };
}
