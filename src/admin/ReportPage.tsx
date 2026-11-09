import { useCallback, useEffect, useState } from 'react';
import { rupiah } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Btn, Card, ErrorNote, errorText, Field } from './ui';

type Finance = {
  revenue_today: number;
  revenue_7d: number;
  revenue_month: number;
  paid_today: number;
  paid_7d: number;
  paid_month: number;
  orders_total: number;
  orders_unpaid: number;
  expense_today: number;
  expense_7d: number;
  expense_month: number;
};

type Visits = Record<
  | 'pageviews_today' | 'pageviews_7d' | 'pageviews_month' | 'pageviews_total'
  | 'unique_today' | 'unique_7d' | 'unique_month' | 'unique_total'
  | 'visits_today' | 'visits_7d' | 'visits_month' | 'visits_total',
  number
>;

type Expense = { id: string; name: string; amount: number; expense_date: string };

function todayJakarta(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-xs text-stone-500">{sub}</p>}
    </div>
  );
}

export function ReportPage() {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [visits, setVisits] = useState<Visits | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayJakarta());

  const load = useCallback(async () => {
    const [f, v, e] = await Promise.all([
      supabase.rpc('admin_finance'),
      supabase.rpc('admin_visits'),
      supabase.from('expenses').select('id, name, amount, expense_date').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(30),
    ]);
    if (f.error || v.error || e.error) setError('Gagal memuat laporan');
    else {
      setError(null);
      setFinance(f.data as Finance);
      setVisits(v.data as Visits);
      setExpenses(e.data as Expense[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addExpense() {
    const value = Number(amount);
    if (!name.trim()) return setError('Nama pengeluaran wajib diisi');
    if (!Number.isInteger(value) || value <= 0) return setError('Nominal harus angka lebih dari 0');
    const { error: e } = await supabase.from('expenses').insert({ name: name.trim(), amount: value, expense_date: date });
    if (e) return setError(errorText(e));
    setName('');
    setAmount('');
    await load();
  }

  async function removeExpense(x: Expense) {
    if (!window.confirm(`Hapus pengeluaran "${x.name}"?`)) return;
    const { error: e } = await supabase.from('expenses').delete().eq('id', x.id);
    if (e) setError(errorText(e));
    await load();
  }

  const diff = (revenue: number, expense: number) => {
    const d = revenue - expense;
    return (d < 0 ? '−' : '') + rupiah(Math.abs(d));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn variant="ghost" onClick={() => void load()} className="px-3 py-1.5">
          Muat ulang
        </Btn>
      </div>
      <ErrorNote message={error} />

      {finance && (
        <Card>
          <h2 className="text-base font-semibold">Keuangan</h2>
          <p className="mb-3 text-xs text-stone-500">
            Omzet hanya dari pesanan berstatus “Sudah Dibayar” (termasuk ongkir), dihitung menurut tanggal ditandai dibayar. Waktu WIB.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="Omzet hari ini" value={rupiah(finance.revenue_today)} sub={`${finance.paid_today} pesanan`} />
            <Stat label="Omzet 7 hari" value={rupiah(finance.revenue_7d)} sub={`${finance.paid_7d} pesanan`} />
            <Stat label="Omzet bulan ini" value={rupiah(finance.revenue_month)} sub={`${finance.paid_month} pesanan`} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="Pengeluaran hari ini" value={rupiah(finance.expense_today)} />
            <Stat label="Pengeluaran 7 hari" value={rupiah(finance.expense_7d)} />
            <Stat label="Pengeluaran bulan ini" value={rupiah(finance.expense_month)} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Stat label="Estimasi selisih hari ini" value={diff(finance.revenue_today, finance.expense_today)} />
            <Stat label="Estimasi selisih 7 hari" value={diff(finance.revenue_7d, finance.expense_7d)} />
            <Stat label="Estimasi selisih bulan ini" value={diff(finance.revenue_month, finance.expense_month)} />
          </div>
          <p className="mt-3 text-xs text-stone-500">
            Estimasi selisih = omzet − pengeluaran yang dicatat. Ini <strong>bukan laba bersih</strong> karena harga modal barang tidak dicatat.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Total semua pesanan" value={String(finance.orders_total)} />
            <Stat label="Belum dibayar" value={String(finance.orders_unpaid)} />
          </div>
        </Card>
      )}

      <div className="grid items-start gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Catat pengeluaran</h2>
        <Field label="Nama" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nominal (Rp)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} />
          <Field label="Tanggal" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Btn onClick={() => void addExpense()} className="w-full">
          Tambah pengeluaran
        </Btn>
        {expenses.length > 0 && (
          <ul className="divide-y divide-stone-100">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{x.name}</p>
                  <p className="text-xs text-stone-500">{x.expense_date}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span>{rupiah(x.amount)}</span>
                  <button type="button" onClick={() => void removeExpense(x)} className="text-xs text-red-600">
                    Hapus
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {visits && (
        <Card>
          <h2 className="text-base font-semibold">Statistik pengunjung</h2>
          <p className="mb-3 text-xs text-stone-500">
            Tanpa IP atau data pribadi: hanya ID acak dari browser. Kunjungan = satu pengunjung per hari.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-500">
                  <th className="py-1 font-medium" />
                  <th className="py-1 text-right font-medium">Hari ini</th>
                  <th className="py-1 text-right font-medium">7 hari</th>
                  <th className="py-1 text-right font-medium">Bulan ini</th>
                  <th className="py-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {(
                  [
                    ['Kunjungan', 'visits'],
                    ['Pengunjung unik', 'unique'],
                    ['Pageview', 'pageviews'],
                  ] as const
                ).map(([label, prefix]) => (
                  <tr key={prefix}>
                    <td className="py-2 font-medium">{label}</td>
                    <td className="py-2 text-right">{visits[`${prefix}_today`]}</td>
                    <td className="py-2 text-right">{visits[`${prefix}_7d`]}</td>
                    <td className="py-2 text-right">{visits[`${prefix}_month`]}</td>
                    <td className="py-2 text-right">{visits[`${prefix}_total`]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      </div>
    </div>
  );
}
