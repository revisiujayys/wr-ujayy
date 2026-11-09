import { useCallback, useEffect, useRef, useState } from 'react';
import { Sheet } from '../components/Sheet';
import { ImageSearch } from './ImageSearch';
import { rupiah } from '../lib/format';
import { uploadImage } from '../lib/images';
import { supabase } from '../lib/supabase';
import { Btn, ErrorNote, errorText, Field, Toggle } from './ui';

type Category = { id: string; name: string };
type Variant = { id: string; name: string; is_available: boolean; sort_order: number };
type ProductRow = {
  id: string;
  category_id: string;
  name: string;
  base_price: number;
  image_url: string | null;
  product_type: 'regular' | 'noodle';
  is_active: boolean;
  is_available: boolean;
  product_variants: Variant[];
};

type DraftVariant = { id?: string; name: string; is_available: boolean };

function Editor({
  product,
  categories,
  onClose,
  onSaved,
}: {
  product: ProductRow | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '');
  const [type, setType] = useState<'regular' | 'noodle'>(product?.product_type ?? 'regular');
  const [price, setPrice] = useState(product ? String(product.base_price) : '');
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  const [available, setAvailable] = useState(product?.is_available ?? true);
  const [active, setActive] = useState(product?.is_active ?? true);
  const [variants, setVariants] = useState<DraftVariant[]>(
    [...(product?.product_variants ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((v) => ({ id: v.id, name: v.name, is_available: v.is_available })),
  );
  const [newVariant, setNewVariant] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setImageUrl(await uploadImage(file, 'products'));
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  function addVariant() {
    const n = newVariant.trim();
    if (!n) return;
    if (variants.some((v) => v.name.toLowerCase() === n.toLowerCase())) {
      setError('Nama varian sudah ada');
      return;
    }
    setError(null);
    setVariants([...variants, { name: n, is_available: true }]);
    setNewVariant('');
  }

  async function save() {
    const priceNumber = Number(price);
    if (!name.trim()) return setError('Nama produk wajib diisi');
    if (!categoryId) return setError('Pilih kategori (buat dulu di menu Data jika belum ada)');
    if (!Number.isInteger(priceNumber) || priceNumber < 0) return setError('Harga harus berupa angka rupiah bulat');

    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        category_id: categoryId,
        product_type: type,
        base_price: priceNumber,
        image_url: imageUrl,
        is_available: available,
        is_active: active,
      };

      let id = product?.id;
      if (id) {
        const { error: e } = await supabase.from('products').update(payload).eq('id', id);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase.from('products').insert(payload).select('id').single();
        if (e) throw e;
        id = (data as { id: string }).id;
      }

      const keptIds = variants.filter((v) => v.id).map((v) => v.id as string);
      const removed = (product?.product_variants ?? []).filter((v) => !keptIds.includes(v.id));
      for (const v of removed) {
        const { error: e } = await supabase.from('product_variants').delete().eq('id', v.id);
        if (e) throw e;
      }
      for (const [index, v] of variants.entries()) {
        if (v.id) {
          const { error: e } = await supabase
            .from('product_variants')
            .update({ name: v.name, is_available: v.is_available, sort_order: index })
            .eq('id', v.id);
          if (e) throw e;
        } else {
          const { error: e } = await supabase
            .from('product_variants')
            .insert({ product_id: id, name: v.name, is_available: v.is_available, sort_order: index });
          if (e) throw e;
        }
      }
      onSaved();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  async function remove() {
    if (!product) return;
    if (!window.confirm(`Hapus produk "${product.name}"? Riwayat pesanan lama tetap tersimpan.`)) return;
    setBusy(true);
    const { error: e } = await supabase.from('products').delete().eq('id', product.id);
    if (e) {
      setError(errorText(e));
      setBusy(false);
    } else onSaved();
  }

  return (
    <Sheet title={product ? 'Edit produk' : 'Tambah produk'} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Nama produk" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-700">Kategori</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-700">Jenis</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'regular' | 'noodle')}
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2"
          >
            <option value="regular">Biasa</option>
            <option value="noodle">Mie rebus/goreng (pilih kuah/goreng + topping)</option>
          </select>
        </label>

        <Field
          label="Harga utama (Rp), berlaku untuk semua varian"
          inputMode="numeric"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))}
        />

        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">Foto</span>
          <div className="flex items-center gap-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
              {imageUrl && <img src={imageUrl} alt="" className="size-full object-cover" />}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void pickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Btn variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                Pilih dari galeri
              </Btn>
              <Btn variant="ghost" disabled={busy} onClick={() => setSearching(true)}>
                Cari foto
              </Btn>
              {imageUrl && (
                <Btn variant="ghost" disabled={busy} onClick={() => setImageUrl(null)}>
                  Hapus foto
                </Btn>
              )}
            </div>
          </div>
        </div>

        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">Varian (opsional)</span>
          <p className="mb-2 text-xs text-stone-500">Setiap varian bisa dinyalakan/dimatikan sendiri. Harga tetap satu.</p>
          <ul className="space-y-2">
            {variants.map((v, i) => (
              <li key={v.id ?? `new-${i}`} className="flex items-center gap-2">
                <input
                  value={v.name}
                  onChange={(e) => setVariants(variants.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm"
                  aria-label="Nama varian"
                />
                <Toggle
                  checked={v.is_available}
                  label={`Varian ${v.name} tersedia`}
                  onChange={(on) => setVariants(variants.map((x, j) => (j === i ? { ...x, is_available: on } : x)))}
                />
                <button
                  type="button"
                  aria-label={`Hapus varian ${v.name}`}
                  onClick={() => setVariants(variants.filter((_, j) => j !== i))}
                  className="text-sm text-red-600"
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              value={newVariant}
              onChange={(e) => setNewVariant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addVariant();
                }
              }}
              placeholder="Nama varian baru"
              className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-1.5 text-sm"
            />
            <Btn variant="ghost" onClick={addVariant}>
              Tambah
            </Btn>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
          <span>Stok tersedia (OFF = tampil “Habis”)</span>
          <Toggle checked={available} onChange={setAvailable} label="Stok tersedia" />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-sm">
          <span>Tampilkan di katalog (OFF = disembunyikan)</span>
          <Toggle checked={active} onChange={setActive} label="Tampilkan di katalog" />
        </div>

        <ErrorNote message={error} />

        <div className="flex gap-2">
          <Btn disabled={busy} onClick={() => void save()} className="flex-1">
            {busy ? 'Menyimpan…' : 'Simpan'}
          </Btn>
          {product && (
            <Btn variant="danger" disabled={busy} onClick={() => void remove()}>
              Hapus
            </Btn>
          )}
        </div>
      </div>
      {searching && (
        <ImageSearch initialQuery={name} onPick={setImageUrl} onClose={() => setSearching(false)} />
      )}
    </Sheet>
  );
}

export function ProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [prods, cats] = await Promise.all([
      supabase.from('products').select('*, product_variants(*)').order('name'),
      supabase.from('categories').select('id, name').order('sort_order'),
    ]);
    if (prods.error || cats.error) setError('Gagal memuat produk');
    else {
      setError(null);
      setProducts(prods.data as ProductRow[]);
      setCategories(cats.data as Category[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function quickToggle(p: ProductRow, available: boolean) {
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_available: available } : x)));
    const { error: e } = await supabase.from('products').update({ is_available: available }).eq('id', p.id);
    if (e) {
      setError(errorText(e));
      await load();
    }
  }

  const q = query.trim().toLowerCase();
  const shown = products.filter((p) => q === '' || p.name.toLowerCase().includes(q));
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '-';

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari produk…"
          aria-label="Cari produk"
          className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm"
        />
        <Btn onClick={() => setEditing('new')}>+ Produk</Btn>
      </div>

      <ErrorNote message={error} />
      {loading && <p className="py-8 text-center text-sm text-stone-500">Memuat…</p>}
      {!loading && products.length === 0 && (
        <p className="py-8 text-center text-sm text-stone-500">Belum ada produk. Tekan “+ Produk” untuk menambah.</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
            <button type="button" onClick={() => setEditing(p)} className="text-left">
              <div className="aspect-square bg-stone-100">
                {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="size-full object-cover" />}
              </div>
              <div className="p-3 pb-2">
                <p className="line-clamp-2 min-h-10 text-sm font-medium leading-5">{p.name}</p>
                <p className="text-sm font-semibold text-brand">{rupiah(p.base_price)}</p>
                <p className="truncate text-xs text-stone-500">
                  {categoryName(p.category_id)}
                  {p.product_variants.length > 0 && ` · ${p.product_variants.length} varian`}
                </p>
                {!p.is_active && <p className="text-xs font-medium text-amber-700">Disembunyikan</p>}
              </div>
            </button>
            <div className="mt-auto flex items-center justify-between border-t border-stone-100 px-3 py-2">
              <span className="text-xs text-stone-600">{p.is_available ? 'Stok ada' : 'Habis'}</span>
              <Toggle checked={p.is_available} onChange={(v) => void quickToggle(p, v)} label={`Stok ${p.name}`} />
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <Editor
          product={editing === 'new' ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
