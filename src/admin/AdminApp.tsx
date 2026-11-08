import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Logo } from '../components/Logo';
import { postJson } from '../lib/api';
import { supabase } from '../lib/supabase';
import { DataPage } from './DataPage';
import { OrdersPage } from './OrdersPage';
import { ProductsPage } from './ProductsPage';
import { ReportPage } from './ReportPage';
import { ShopPage } from './ShopPage';
import { Btn, ErrorNote, Field } from './ui';

type Tab = 'orders' | 'products' | 'data' | 'shop' | 'report';
type Phase = 'checking' | 'login' | 'ready';

const TABS: { id: Tab; label: string }[] = [
  { id: 'orders', label: 'Pesanan' },
  { id: 'products', label: 'Produk' },
  { id: 'data', label: 'Data' },
  { id: 'shop', label: 'Toko' },
  { id: 'report', label: 'Laporan' },
];

type LoginSession = { access_token: string; refresh_token: string };

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ session: LoginSession }>('/api/admin-login', { username, password });
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: res.data.session.access_token,
      refresh_token: res.data.session.refresh_token,
    });
    setBusy(false);
    if (sessionError) setError('Login gagal. Coba lagi.');
    else onDone();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <Logo />
        <p className="mt-1 text-sm text-stone-500">Masuk admin</p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5">
        <Field
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <ErrorNote message={error} />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-stone-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [tab, setTab] = useState<Tab>('orders');

  useEffect(() => {
    document.title = 'Admin · Wr. Ujayy';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const check = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setPhase('login');
      return;
    }
    // Hanya admin yang lolos RLS untuk membaca tabel ini.
    const { data } = await supabase.from('admin_users').select('user_id').maybeSingle();
    if (data) {
      setPhase('ready');
    } else {
      await supabase.auth.signOut();
      setPhase('login');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  async function logout() {
    await supabase.auth.signOut();
    setPhase('login');
  }

  if (phase === 'checking') return <div className="grid min-h-dvh place-items-center text-sm text-stone-500">Memuat…</div>;
  if (phase === 'login') return <Login onDone={() => void check()} />;

  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo />
          <Btn variant="ghost" onClick={() => void logout()} className="px-3 py-1.5">
            Keluar
          </Btn>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-4">
        {tab === 'orders' && <OrdersPage />}
        {tab === 'products' && <ProductsPage />}
        {tab === 'data' && <DataPage />}
        {tab === 'shop' && <ShopPage />}
        {tab === 'report' && <ReportPage />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white" aria-label="Menu admin">
        <div className="mx-auto grid max-w-3xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`py-3.5 text-xs font-semibold ${tab === t.id ? 'text-brand' : 'text-stone-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
