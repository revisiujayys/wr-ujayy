import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { adminClient, clientIp, guardPost, hashKey, json, readBody, withinLimit } from './_lib/server.js';

// Hanya UUID acak dari browser + path halaman. IP dan user-agent tidak disimpan.
const Body = z.object({
  visitorId: z.string().uuid(),
  path: z.string().max(200).startsWith('/'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardPost(req, res)) return;

  try {
    const parsed = Body.safeParse(readBody(req));
    if (!parsed.success || parsed.data.path.startsWith('/admin')) return json(res, 400, { error: 'Tidak valid' });

    const admin = adminClient();
    if (!(await withinLimit(admin, 'track-ip:' + hashKey(clientIp(req)), 120, 3600))) {
      return json(res, 429, { error: 'Terlalu banyak permintaan' });
    }

    const { error } = await admin
      .from('site_visits')
      .insert({ visitor_id: parsed.data.visitorId, path: parsed.data.path });
    if (error) throw error;

    res.status(204).end();
  } catch (error) {
    console.error('track failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Terjadi kesalahan' });
  }
}
