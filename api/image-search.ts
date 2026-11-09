import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { adminClient, guardPost, json, readBody, withinLimit } from './_lib/server.js';

const Body = z.union([
  z.object({ query: z.string().trim().min(2).max(80) }),
  z.object({ download: z.string().url().max(500) }),
]);

type PixabayHit = {
  id: number;
  pageURL: string;
  user: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
};

const MAX_BYTES = 3_000_000;

// Pencarian foto lewat API resmi Pixabay (bukan scraping). Hanya untuk admin yang sedang login.
// Kunci API disimpan di server (PIXABAY_API_KEY) dan tidak pernah dikirim ke browser.
// Foto diunduh lewat server lalu disalin ke penyimpanan sendiri (Pixabay melarang hotlink permanen).
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

    const parsed = Body.safeParse(readBody(req));
    if (!parsed.success) return json(res, 400, { error: 'Tulis kata kunci pencarian (minimal 2 huruf)' });

    const mode = 'download' in parsed.data ? 'dl' : 'search';
    if (!(await withinLimit(admin, `img-${mode}:` + userData.user.id, 60, 3600))) {
      return json(res, 429, { error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
    }

    if ('download' in parsed.data) {
      const target = new URL(parsed.data.download);
      if (target.protocol !== 'https:' || !(target.hostname === 'pixabay.com' || target.hostname.endsWith('.pixabay.com'))) {
        return json(res, 400, { error: 'Alamat foto tidak valid' });
      }
      const img = await fetch(target);
      const type = img.headers.get('content-type') ?? '';
      if (!img.ok || !type.startsWith('image/')) return json(res, 502, { error: 'Gagal mengunduh foto. Coba foto lain.' });
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.length > MAX_BYTES) return json(res, 413, { error: 'Foto terlalu besar. Coba foto lain.' });
      return json(res, 200, { contentType: type, data: buf.toString('base64') });
    }

    const key = process.env.PIXABAY_API_KEY;
    if (!key) return json(res, 503, { error: 'Pencarian foto belum diaktifkan (PIXABAY_API_KEY belum diatur di Vercel).' });

    const url = new URL('https://pixabay.com/api/');
    url.searchParams.set('key', key);
    url.searchParams.set('q', parsed.data.query);
    url.searchParams.set('image_type', 'photo');
    url.searchParams.set('per_page', '15');
    url.searchParams.set('safesearch', 'true');
    url.searchParams.set('lang', 'id');

    const upstream = await fetch(url);
    if (!upstream.ok) {
      console.error('pixabay failed:', upstream.status);
      return json(res, 502, { error: 'Layanan foto sedang bermasalah. Coba lagi nanti.' });
    }
    const data = (await upstream.json()) as { hits?: PixabayHit[] };

    return json(res, 200, {
      photos: (data.hits ?? []).map((p) => ({
        id: p.id,
        thumb: p.webformatURL,
        image: p.largeImageURL,
        photographer: p.user,
        pageUrl: p.pageURL,
      })),
    });
  } catch (error) {
    console.error('image-search failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}
