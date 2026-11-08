import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} belum diatur`);
  return value;
}

// Service role: hanya di server. Jangan pernah dipakai/diekspos di frontend.
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client baru per permintaan untuk login; jangan dipakai ulang agar tidak membawa sesi.
export function publicClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function json(res: VercelResponse, status: number, body: unknown): void {
  res.status(status).json(body);
}

export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || 'unknown';
}

// Nilai di-hash agar IP/nomor telepon tidak tersimpan mentah di tabel rate limit.
export function hashKey(value: string): string {
  return createHash('sha256')
    .update((process.env.RATE_LIMIT_SALT ?? '') + value)
    .digest('hex')
    .slice(0, 32);
}

function sameOrigin(req: VercelRequest): boolean {
  const origin = req.headers.origin;
  if (!origin || !req.headers.host) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// Mengembalikan true jika permintaan boleh dilanjutkan.
export function guardPost(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    json(res, 405, { error: 'Metode tidak diizinkan' });
    return false;
  }
  if (!sameOrigin(req)) {
    json(res, 403, { error: 'Permintaan ditolak' });
    return false;
  }
  return true;
}

export function readBody(req: VercelRequest): unknown {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return undefined;
    }
  }
  return req.body;
}

// Gagal tertutup: jika pengecekan error, permintaan tidak diteruskan.
export async function withinLimit(
  admin: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error('rate limit check failed');
  return data === true;
}
