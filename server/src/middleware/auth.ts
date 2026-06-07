import { Context, Next } from 'hono';
import { verifyAccessToken } from '../lib/jwt.js';
import { getUserById } from '../services/auth-service.js';
import type { AuthUser } from '../lib/types.js';

export type AppVariables = {
  user: AuthUser;
};

function extractBearerToken(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const token = extractBearerToken(c);
  if (!token) {
    return c.json({ error: 'Yetkilendirme gerekli' }, 401);
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    if (!user) {
      return c.json({ error: 'Kullanıcı bulunamadı' }, 401);
    }
    c.set('user', user);
    await next();
  } catch {
    return c.json({ error: 'Geçersiz veya süresi dolmuş oturum' }, 401);
  }
}

export async function adminMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const user = c.get('user');
  if (!user?.isAdmin) {
    return c.json({ error: 'Yönetici yetkisi gerekli' }, 403);
  }
  await next();
}

export async function participantMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const user = c.get('user');
  if (user?.isAdmin) {
    return c.json({ error: 'Yönetici hesapları tahmin oyununa katılamaz' }, 403);
  }
  await next();
}

export async function optionalAuthMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const token = extractBearerToken(c);
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      const user = await getUserById(payload.sub);
      if (user) c.set('user', user);
    } catch {
      // ignore
    }
  }
  await next();
}
