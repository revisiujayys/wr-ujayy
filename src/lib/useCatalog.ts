import { useEffect, useState } from 'react';
import { getStoreSettings } from './storeSettings';
import { supabase } from './supabase';
import type { CatalogProduct, Category, DeliveryArea, StoreSettings, Topping } from './types';

export type Catalog = {
  categories: Category[];
  products: CatalogProduct[];
  toppings: Topping[];
  areas: DeliveryArea[];
  settings: StoreSettings;
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Catalog };

type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  product_type: 'regular' | 'noodle';
  is_available: boolean;
  product_variants: { id: string; name: string; is_available: boolean; sort_order: number; image_url: string | null }[] | null;
};

type ToppingRow = { id: string; name: string; price: number; is_available: boolean };
type AreaRow = { id: string; name: string; min_order: number; delivery_fee: number };

async function load(fresh: boolean): Promise<Catalog> {
  // Filter is_active eksplisit: admin yang sedang login juga bisa membaca baris nonaktif,
  // tetapi pelanggan tidak boleh melihatnya.
  const [cats, prods, tops, areas, settings] = await Promise.all([
    supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order'),
    supabase
      .from('products')
      .select(
        'id, category_id, name, description, base_price, image_url, product_type, is_available, product_variants(id, name, is_available, sort_order, image_url)',
      )
      .eq('is_active', true)
      .order('sort_order')
      .order('name'),
    supabase.from('toppings').select('id, name, price, is_available').order('sort_order').order('name'),
    supabase
      .from('delivery_areas')
      .select('id, name, min_order, delivery_fee')
      .eq('is_active', true)
      .order('sort_order'),
    // Pengaturan toko dibagi dengan tema harian: satu permintaan saja.
    getStoreSettings(fresh),
  ]);

  if (cats.error || prods.error || tops.error || areas.error) {
    throw new Error('Gagal memuat katalog');
  }

  const products: CatalogProduct[] = (prods.data as ProductRow[]).map((p) => {
    const variants = [...(p.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, available: v.is_available, imageUrl: v.image_url }));
    return {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description,
      price: p.base_price,
      imageUrl: p.image_url,
      productType: p.product_type,
      // Habis jika toggle OFF, atau punya varian tetapi semuanya OFF.
      available: p.is_available && (variants.length === 0 || variants.some((v) => v.available)),
      variants,
    };
  });

  return {
    categories: cats.data as Category[],
    products,
    toppings: (tops.data as ToppingRow[]).map((t) => ({
      id: t.id,
      name: t.name,
      price: t.price,
      available: t.is_available,
    })),
    areas: (areas.data as AreaRow[]).map((a) => ({
      id: a.id,
      name: a.name,
      minOrder: a.min_order,
      fee: a.delivery_fee,
    })),
    settings: {
      is_open: settings.is_open,
      whatsapp_number: settings.whatsapp_number,
      address: settings.address,
      maps_url: settings.maps_url,
      open_time: settings.open_time,
      close_time: settings.close_time,
    },
  };
}

export function useCatalog() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    load(attempt > 0)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
