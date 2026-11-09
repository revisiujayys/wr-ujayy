import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type Theme = { id: string; name: string; brand: string };

// Warna lengkapnya ada di index.css ([data-theme="…"]). `brand` di sini hanya untuk pratinjau & meta theme-color.
export const THEMES: Theme[] = [
  { id: 'jingga', name: 'Jingga Hangat', brand: '#c2410c' },
  { id: 'hijau', name: 'Hijau Daun', brand: '#15803d' },
  { id: 'biru', name: 'Biru Laut', brand: '#0369a1' },
  { id: 'ungu', name: 'Ungu Anggur', brand: '#7e22ce' },
  { id: 'merah', name: 'Merah Cabai', brand: '#b91c1c' },
  { id: 'pink', name: 'Pink Senja', brand: '#be185d' },
  { id: 'kuning', name: 'Kuning Mentari', brand: '#a16207' },
  { id: 'grafit', name: 'Grafit Kalem', brand: '#44403c' },
];

// Indeks = hari (0 = Minggu … 6 = Sabtu), menurut WIB.
export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type ThemeMap = Record<string, string>;

export const DEFAULT_MAP: ThemeMap = {
  '1': 'jingga',
  '2': 'hijau',
  '3': 'biru',
  '4': 'ungu',
  '5': 'merah',
  '6': 'pink',
  '0': 'kuning',
};

export function sanitizeMap(value: unknown): ThemeMap {
  const out: ThemeMap = { ...DEFAULT_MAP };
  if (value && typeof value === 'object') {
    for (const day of Object.keys(DEFAULT_MAP)) {
      const id = (value as Record<string, unknown>)[day];
      if (typeof id === 'string' && THEMES.some((t) => t.id === id)) out[day] = id;
    }
  }
  return out;
}

// WIB = UTC+7 tanpa perubahan musim, jadi cukup digeser 7 jam.
function wib(now: Date): Date {
  return new Date(now.getTime() + 7 * 3600 * 1000);
}

export function wibDay(now: Date): number {
  return wib(now).getUTCDay();
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatWib(now: Date): { date: string; time: string } {
  const w = wib(now);
  return {
    date: `${DAY_NAMES[w.getUTCDay()]}, ${w.getUTCDate()} ${MONTHS[w.getUTCMonth()]} ${w.getUTCFullYear()}`,
    time: `${pad(w.getUTCHours())}.${pad(w.getUTCMinutes())}.${pad(w.getUTCSeconds())}`,
  };
}

export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const CACHE_KEY = 'wr-ujayy-theme-map';
const listeners = new Set<() => void>();

function readCache(): ThemeMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return sanitizeMap(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_MAP };
  }
}

let currentMap: ThemeMap = readCache();

export function setThemeMap(map: ThemeMap): void {
  currentMap = sanitizeMap(map);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(currentMap));
  } catch {
    // diabaikan
  }
  listeners.forEach((fn) => fn());
}

function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id;
  const brand = THEMES.find((t) => t.id === id)?.brand;
  if (!brand) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = brand;
}

let themePromise: Promise<void> | null = null;

// Ambil pemetaan tema dari server sekali saja.
export function loadThemeMap(): Promise<void> {
  if (!themePromise) {
    themePromise = Promise.resolve(supabase.from('store_settings').select('day_themes').eq('id', 1).single()).then(
      ({ data, error }) => {
        if (!error && data) setThemeMap(sanitizeMap((data as { day_themes: unknown }).day_themes));
      },
      () => undefined,
    );
  }
  return themePromise;
}

// Dipakai di halaman pelanggan maupun admin: tema mengikuti hari (WIB) sesuai pengaturan admin.
// Mengembalikan true setelah pengaturan dari server selesai dimuat.
export function useDailyTheme(): boolean {
  const [loaded, setLoaded] = useState(false);
  const [, rerender] = useState(0);
  const now = useNow(30_000);

  useEffect(() => {
    let alive = true;
    const fn = () => rerender((n) => n + 1);
    listeners.add(fn);
    void loadThemeMap().then(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);

  const id = currentMap[String(wibDay(now))] ?? 'jingga';
  useEffect(() => applyTheme(id), [id]);
  return loaded;
}
