import { Hono } from 'hono';
import { z } from 'zod';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { login, logout, refresh } from '../services/auth-service.js';
import { config } from '../lib/config.js';

const authRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(4).max(128),
  rememberMe: z.boolean().optional().default(false),
});

function setRefreshCookie(c: Context, token: string, expiresAt: Date) {
  const maxAge = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  setCookie(c, config.refreshCookieName, token, {
    httpOnly: true,
    secure: config.refreshCookieSecure,
    sameSite: config.refreshCookieSameSite,
    path: config.refreshCookiePath,
    maxAge,
  });
}

function clearRefreshCookie(c: Context) {
  deleteCookie(c, config.refreshCookieName, {
    path: config.refreshCookiePath,
    secure: config.refreshCookieSecure,
    sameSite: config.refreshCookieSameSite,
  });
}

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz giriş bilgileri' }, 400);
  }

  try {
    const result = await login(parsed.data.username, parsed.data.password, parsed.data.rememberMe);
    setRefreshCookie(c, result.refreshToken, result.refreshTokenExpiresAt);
    return c.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Giriş başarısız' }, 401);
  }
});

authRoutes.post('/refresh', async (c) => {
  const refreshToken = getCookie(c, config.refreshCookieName);
  if (!refreshToken) {
    return c.json({ error: 'Oturum bulunamadı' }, 401);
  }

  try {
    const result = await refresh(refreshToken);
    setRefreshCookie(c, result.refreshToken, result.refreshTokenExpiresAt);
    return c.json({ accessToken: result.accessToken, user: result.user });
  } catch {
    clearRefreshCookie(c);
    return c.json({ error: 'Oturum yenilenemedi' }, 401);
  }
});

authRoutes.post('/logout', async (c) => {
  const refreshToken = getCookie(c, config.refreshCookieName);
  if (refreshToken) {
    await logout(refreshToken);
  }
  clearRefreshCookie(c);
  return c.json({ success: true });
});

export default authRoutes;
