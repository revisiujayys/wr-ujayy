import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizePhone } from '../../api/_lib/orderLogic';
import { uploadImage } from '../lib/images';
import { supabase } from '../lib/supabase';
import { Btn, Card, ErrorNote, errorText, Field, Toggle } from './ui';

type Settings = {
  is_open: boolean;
  whatsapp_number: string | null;
  address: string | null;
  maps_url: string | null;
  open_time: string;
  close_time: string;
};

type Payment = {
  qris_image_url: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  notes: string | null;
};

export function ShopPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([
      supabase.from('store_settings').select('*').eq('id', 1).single(),
      supabase.from('payment_settings').select('*').eq('id', 1).single(),
    ]);
    if (s.error || p.error) setError('Gagal memuat pengaturan');
    else {
      setSettings(s.data as Settings);
      setPayment(p.data as Payment);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!settings || !payment) {
    return (
      <>
        <ErrorNote message={error} />
        {!error && <p className="py-8 text-center text-sm text-stone-500">Memuat…</p>}
      </>
    );
  }

  async function toggleOpen(open: boolean) {
    setSettings((prev) => (prev ? { ...prev, is_open: open } : prev));
    const { error: e } = await supabase.from('store_settings').update({ is_open: open }).eq('id', 1);
    if (e) {
      setError(errorText(e));
      await load();
    } else setError(null);
  }

  async function saveStore() {
    if (!settings) return;
    const number = (settings.whatsapp_number ?? '').trim();
    const normalized = number ? normalizePhone(number) : null;
    if (normalized && !/^628\d{8,12}$/.test(normalized)) {
      setError('Nomor WhatsApp tidak valid. Contoh: 62812xxxxxxx');
      return;
    }
    setBusy(true);
    const { error: e } = await supabase
      .from('store_settings')
      .update({
        whatsapp_number: normalized,
        address: settings.address?.trim() || null,
        maps_url: settings.maps_url?.trim() || null,
        open_time: settings.open_time.slice(0, 5),
        close_time: settings.close_time.slice(0, 5),
      })
      .eq('id', 1);
    setBusy(false);
    if (e) setError(errorText(e));
    else {
      setError(null);
      setMessage('Pengaturan toko tersimpan');
      await load();
    }
  }

  async function savePayment() {
    if (!payment) return;
    setBusy(true);
    const { error: e } = await supabase
      .from('payment_settings')
      .update({
        qris_image_url: payment.qris_image_url,
        bank_name: payment.bank_name?.trim() || null,
        account_number: payment.account_number?.trim() || null,
        account_holder: payment.account_holder?.trim() || null,
        notes: payment.notes?.trim() || null,
      })
      .eq('id', 1);
    setBusy(false);
    if (e) setError(errorText(e));
    else {
      setError(null);
      setMessage('Data pembayaran tersimpan');
    }
  }

  async function pickQris(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, 'qris');
      setPayment((prev) => (prev ? { ...prev, qris_image_url: url } : prev));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <ErrorNote message={error} />
      {message && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      )}

      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Status toko: {settings.is_open ? 'Buka' : 'Tutup'}</p>
          <p className="text-xs text-stone-500">
            Diatur manual. Saat Tutup, katalog tetap tampil tetapi checkout dimatikan.
          </p>
        </div>
        <Toggle checked={settings.is_open} onChange={(v) => void toggleOpen(v)} label="Toko buka" />
      </Card>

      <div className="grid items-start gap-4 md:grid-cols-2">
      <Card className="space-y-3">
        <h2 className="text-base font-semibold">Info toko</h2>
        <Field
          label="Nomor WhatsApp pesanan (62…)"
          inputMode="numeric"
          value={settings.whatsapp_number ?? ''}
          onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
        />
        <Field
          label="Alamat warung"
          value={settings.address ?? ''}
          onChange={(e) => setSettings({ ...settings, address: e.target.value })}
        />
        <Field
          label="Link Google Maps"
          type="url"
          value={settings.maps_url ?? ''}
          onChange={(e) => setSettings({ ...settings, maps_url: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Field
            label="Jam buka"
            type="time"
            value={settings.open_time.slice(0, 5)}
            onChange={(e) => setSettings({ ...settings, open_time: e.target.value })}
          />
          <Field
            label="Jam tutup"
            type="time"
            value={settings.close_time.slice(0, 5)}
            onChange={(e) => setSettings({ ...settings, close_time: e.target.value })}
          />
        </div>
        <p className="text-xs text-stone-500">Jam hanya informasi untuk pelanggan (WIB). Buka/tutup tetap dikendalikan tombol di atas.</p>
        <Btn disabled={busy} onClick={() => void saveStore()} className="w-full">
          Simpan info toko
        </Btn>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-base font-semibold">QRIS dan rekening</h2>
        <p className="text-xs text-stone-500">
          Data ini hanya terlihat oleh admin. Detail pembayaran tetap Anda kirim manual lewat WhatsApp.
        </p>
        <div className="flex items-center gap-3">
          <div className="size-24 shrink-0 overflow-hidden rounded-xl bg-stone-100">
            {payment.qris_image_url && <img src={payment.qris_image_url} alt="QRIS" className="size-full object-contain" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickQris(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Btn variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
              Upload QRIS
            </Btn>
            {payment.qris_image_url && (
              <Btn variant="ghost" disabled={busy} onClick={() => setPayment({ ...payment, qris_image_url: null })}>
                Hapus
              </Btn>
            )}
          </div>
        </div>
        <Field label="Nama bank / e-wallet" value={payment.bank_name ?? ''} onChange={(e) => setPayment({ ...payment, bank_name: e.target.value })} />
        <Field
          label="Nomor rekening"
          inputMode="numeric"
          value={payment.account_number ?? ''}
          onChange={(e) => setPayment({ ...payment, account_number: e.target.value })}
        />
        <Field label="Atas nama" value={payment.account_holder ?? ''} onChange={(e) => setPayment({ ...payment, account_holder: e.target.value })} />
        <Field label="Catatan" value={payment.notes ?? ''} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
        <Btn disabled={busy} onClick={() => void savePayment()} className="w-full">
          Simpan data pembayaran
        </Btn>
      </Card>
      </div>
    </div>
  );
}
