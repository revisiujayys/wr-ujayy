export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function postJson<T>(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.ok) return { ok: true, data: json as T };
    const message = (json as { error?: string } | null)?.error;
    return { ok: false, status: res.status, error: message ?? 'Terjadi kesalahan. Silakan coba lagi.' };
  } catch {
    return { ok: false, status: 0, error: 'Tidak bisa terhubung. Periksa koneksi Anda.' };
  }
}
