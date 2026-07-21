import type { Context, Next } from 'hono';

/**
 * Turnuva bitti; API kalıcı olarak kapalı.
 * Vercel projesi silinmeden trafiği kesmek için tüm istekleri reddeder.
 */
export async function shutdownMiddleware(c: Context, _next: Next) {
  return c.json(
    { error: 'API kapatıldı. Servis artık kullanılmıyor.' },
    503,
  );
}
