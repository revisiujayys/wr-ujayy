import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Btn, Card, ErrorNote, errorText, Toggle } from './ui';

type Col = { key: string; label: string; kind: 'text' | 'number' };
type Row = Record<string, unknown> & { id: string };

type ListProps = {
  title: string;
  hint: string;
  table: string;
  cols: Col[];
  flagKey: string;
  flagLabel: string;
  // true = tampilkan satu item saja, dipilih lewat dropdown (untuk daftar panjang seperti desa)
  single?: boolean;
};

function RowEditor({
  row,
  cols,
  flagKey,
  flagLabel,
  onSave,
  onDelete,
  onFlag,
}: {
  row: Row;
  cols: Col[];
  flagKey: string;
  flagLabel: string;
  onSave: (values: Record<string, string>) => Promise<void>;
  onDelete: () => Promise<void>;
  onFlag: (value: boolean) => Promise<void>;
}) {
  const initial = Object.fromEntries(cols.map((c) => [c.key, String(row[c.key] ?? '')]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const dirty = cols.some((c) => values[c.key] !== initial[c.key]);

  return (
    <li className="rounded-2xl bg-stone-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        {cols.map((c) => (
          <label key={c.key} className={`block text-xs ${c.kind === 'text' ? 'col-span-2' : ''}`}>
            <span className="mb-0.5 block text-stone-500">{c.label}</span>
            <input
              value={values[c.key]}
              inputMode={c.kind === 'number' ? 'numeric' : undefined}
              onChange={(e) =>
                setValues({ ...values, [c.key]: c.kind === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value })
              }
              className="input !rounded-xl !bg-white !py-1.5"
            />
          </label>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-stone-600">
          <Toggle checked={row[flagKey] === true} onChange={(v) => void onFlag(v)} label={`${flagLabel}: ${String(row.name ?? '')}`} />
          {flagLabel}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Btn onClick={() => void onSave(values)} className="px-3 py-1.5">
              Simpan
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => void onDelete()} className="px-3 py-1.5 text-red-600">
            Hapus
          </Btn>
        </div>
      </div>
    </li>
  );
}

function MasterList({ title, hint, table, cols, flagKey, flagLabel, single = false }: ListProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from(table).select('*').order('sort_order').order('name');
    if (e) setError(errorText(e));
    else setRows(data as Row[]);
  }, [table]);

  useEffect(() => {
    void load();
  }, [load]);

  function toPayload(values: Record<string, string>): Record<string, string | number> | string {
    const out: Record<string, string | number> = {};
    for (const c of cols) {
      const raw = (values[c.key] ?? '').trim();
      if (c.kind === 'text') {
        if (!raw) return `${c.label} wajib diisi`;
        out[c.key] = raw;
      } else {
        if (raw === '') return `${c.label} wajib diisi`;
        out[c.key] = Number(raw);
      }
    }
    return out;
  }

  async function run(action: PromiseLike<{ error: unknown }>) {
    const { error: e } = await action;
    if (e) setError(errorText(e));
    else setError(null);
    await load();
  }

  async function add() {
    const payload = toPayload(draft);
    if (typeof payload === 'string') return setError(payload);
    const res = await supabase
      .from(table)
      .insert({ ...payload, [flagKey]: true, sort_order: rows.length + 1 })
      .select('id')
      .single();
    if (res.error) setError(errorText(res.error));
    else {
      setError(null);
      setSelectedId((res.data as { id: string }).id); // langsung tampilkan item yang baru ditambah
    }
    await load();
    setDraft({});
  }

  return (
    <Card>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-stone-500">{hint}</p>
      <ErrorNote message={error} />
      {single && rows.length > 0 && (
        <select
          aria-label={`Pilih ${title}`}
          value={(rows.find((r) => r.id === selectedId) ?? rows[0]).id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="input mb-2 font-medium"
        >
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {String(r.name)}
              {r[flagKey] === true ? '' : ' (nonaktif)'}
            </option>
          ))}
        </select>
      )}
      <ul className="mt-2 space-y-2">
        {(single ? rows.filter((r) => r.id === (rows.find((x) => x.id === selectedId) ?? rows[0]).id) : rows).map((r) => (
          <RowEditor
            key={r.id}
            row={r}
            cols={cols}
            flagKey={flagKey}
            flagLabel={flagLabel}
            onSave={async (values) => {
              const payload = toPayload(values);
              if (typeof payload === 'string') return setError(payload);
              await run(supabase.from(table).update(payload).eq('id', r.id));
            }}
            onDelete={async () => {
              if (!window.confirm(`Hapus "${String(r.name)}"?`)) return;
              await run(supabase.from(table).delete().eq('id', r.id));
            }}
            onFlag={async (v) => run(supabase.from(table).update({ [flagKey]: v }).eq('id', r.id))}
          />
        ))}
      </ul>

      <details className="group mt-3 rounded-2xl bg-stone-50 p-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-stone-700">
          + Tambah baru
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {cols.map((c) => (
            <label key={c.key} className={`block text-xs ${c.kind === 'text' ? 'col-span-2' : ''}`}>
              <span className="mb-0.5 block text-stone-500">{c.label}</span>
              <input
                value={draft[c.key] ?? ''}
                inputMode={c.kind === 'number' ? 'numeric' : undefined}
                onChange={(e) =>
                  setDraft({ ...draft, [c.key]: c.kind === 'number' ? e.target.value.replace(/\D/g, '') : e.target.value })
                }
                className="input !rounded-xl !py-1.5"
              />
            </label>
          ))}
        </div>
        <Btn onClick={() => void add()} className="mt-2 w-full">
          Tambah
        </Btn>
      </details>
    </Card>
  );
}

export function DataPage() {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <MasterList
        title="Kategori"
        hint="Kategori yang masih punya produk tidak bisa dihapus; matikan saja agar tidak tampil."
        table="categories"
        cols={[{ key: 'name', label: 'Nama kategori', kind: 'text' }]}
        flagKey="is_active"
        flagLabel="Tampil"
      />
      <MasterList
        title="Topping mie"
        hint="Topping muncul saat pelanggan memesan mie rebus/goreng. Matikan jika sedang habis."
        table="toppings"
        cols={[
          { key: 'name', label: 'Nama topping', kind: 'text' },
          { key: 'price', label: 'Harga (Rp)', kind: 'number' },
        ]}
        flagKey="is_available"
        flagLabel="Tersedia"
      />
      <MasterList
        title="Desa, minimum belanja, dan ongkir"
        hint="Hanya desa yang aktif yang bisa dipilih pelanggan. Ongkir 0 = gratis."
        table="delivery_areas"
        cols={[
          { key: 'name', label: 'Nama desa', kind: 'text' },
          { key: 'min_order', label: 'Minimum belanja (Rp)', kind: 'number' },
          { key: 'delivery_fee', label: 'Ongkir (Rp)', kind: 'number' },
        ]}
        flagKey="is_active"
        flagLabel="Dilayani"
        single
      />
    </div>
  );
}
