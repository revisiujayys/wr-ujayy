import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { adminClient, guardPost, json, readBody, withinLimit } from './_lib/server.js';

const Body = z.object({ query: z.string().trim().min(2).max(80) });

type PexelsPhoto = {
  id: number;
  url: string;
  photographer: string;
  src: { medium: string; large: string };
};

// Pencarian foto lewat API resmi Pexels (bukan scraping). Hanya untuk admin yang sedang login.
// Kunci API Pexels disimpan di server (PEXELS_API_KEY) dan tidak pernah dikirim ke browser.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardPost(req, res)) return;

  try {
    const header = req.headers.authorization;
    const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return json(res, 401, { error: 'Harus login sebagai admin' });

    const admin = adminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) return json(res, 401, { error: 'Sesi admin tidak valid, silakan login ulang' });

    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (!adminRow) return json(res, 403, { error: 'Tidak diizinkan' });

    if (!(await withinLimit(admin, 'img-search:' + userData.user.id, 60, 3600))) {
      return json(res, 429, { error: 'Terlalu banyak pencarian. Coba lagi nanti.' });
    }

    const key = process.env.PEXELS_API_KEY;
    if (!key) return json(res, 503, { error: 'Pencarian foto belum diaktifkan (PEXELS_API_KEY belum diatur di Vercel).' });

    const parsed = Body.safeParse(readBody(req));
    if (!parsed.success) return json(res, 400, { error: 'Tulis kata kunci pencarian (minimal 2 huruf)' });

    const url = new URL('https://api.pexels.com/v1/search');
    url.searchParams.set('query', parsed.data.query);
    url.searchParams.set('per_page', '15');
    url.searchParams.set('locale', 'id-ID');

    const upstream = await fetch(url, { headers: { Authorization: key } });
    if (!upstream.ok) {
      console.error('pexels failed:', upstream.status);
      return json(res, 502, { error: 'Layanan foto sedang bermasalah. Coba lagi nanti.' });
    }
    const data = (await upstream.json()) as { photos?: PexelsPhoto[] };

    return json(res, 200, {
      photos: (data.photos ?? []).map((p) => ({
        id: p.id,
        thumb: p.src.medium,
        image: p.src.large,
        photographer: p.photographer,
        pageUrl: p.url,
      })),
    });
  } catch (error) {
    console.error('image-search failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}
