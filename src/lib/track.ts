import { postJson } from './api';

const KEY = 'wr-ujayy-visitor';

function visitorId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

// Hanya UUID acak + path. Tanpa IP/user-agent. Gagal diam-diam: tidak boleh mengganggu pelanggan.
export function trackVisit(path: string): void {
  void postJson('/api/track', { visitorId: visitorId(), path });
}
