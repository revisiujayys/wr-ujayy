import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { adminClient, clientIp, guardPost, hashKey, json, publicClient, readBody, withinLimit } from './_lib/server.js';

const Body = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{3,32}$/),
  password: z.string().min(1).max(200),
});

const FAILED = { error: 'Username atau password salah' };

// Username -> akun internal dipetakan di server. Email internal tidak pernah dikirim ke browser.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!guardPost(req, res)) return;

  try {
    const admin = adminClient();

    if (!(await withinLimit(admin, 'login-ip:' + hashKey(clientIp(req)), 10, 900))) {
      return json(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });
    }

    const parsed = Body.safeParse(readBody(req));
    if (!parsed.success) return json(res, 401, FAILED);
    const { username, password } = parsed.data;

    if (!(await withinLimit(admin, 'login-user:' + hashKey(username), 10, 900))) {
      return json(res, 429, { error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });
    }

    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('username', username)
      .maybeSingle();
    if (!adminRow) return json(res, 401, FAILED);

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(adminRow.user_id);
    const email = userData?.user?.email;
    if (userError || !email) return json(res, 401, FAILED);

    const { data, error } = await publicClient().auth.signInWithPassword({ email, password });
    if (error || !data.session) return json(res, 401, FAILED);

    // Hanya token sesi yang dikembalikan; objek user (berisi email) sengaja tidak disertakan.
    const { access_token, refresh_token, expires_at, expires_in, token_type } = data.session;
    return json(res, 200, { session: { access_token, refresh_token, expires_at, expires_in, token_type } });
  } catch (error) {
    console.error('admin-login failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Terjadi kesalahan. Silakan coba lagi.' });
  }
}
