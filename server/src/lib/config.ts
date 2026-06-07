import './load-env.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});

const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_ACCESS_SECRET = 'dev-access-secret';
const DEFAULT_REFRESH_SECRET = 'dev-refresh-secret';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET ?? DEFAULT_ACCESS_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? DEFAULT_REFRESH_SECRET;

// In production, refuse to start with the insecure development fallbacks:
// tokens signed with a known secret would be trivially forgeable.
if (isProduction && (jwtAccessSecret === DEFAULT_ACCESS_SECRET || jwtRefreshSecret === DEFAULT_REFRESH_SECRET)) {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to non-default values in production',
  );
}

type SameSite = 'Strict' | 'Lax' | 'None';
const cookieSameSite = (process.env.REFRESH_COOKIE_SAMESITE as SameSite | undefined) ?? 'Lax';

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTokenTtl: '15m',
  refreshTokenRememberTtlDays: Number(process.env.REFRESH_TOKEN_REMEMBER_TTL_DAYS ?? 30),
  refreshTokenSessionTtlDays: Number(process.env.REFRESH_TOKEN_SESSION_TTL_DAYS ?? 1),
  // Refresh token is delivered only as an httpOnly cookie scoped to the auth routes.
  refreshCookieName: 'wc_refresh',
  refreshCookiePath: '/api/auth',
  refreshCookieSameSite: cookieSameSite,
  // SameSite=None requires Secure; otherwise Secure only in production (https).
  refreshCookieSecure: cookieSameSite === 'None' ? true : isProduction,
  adminPath: process.env.ADMIN_PATH ?? 'internal-console-7k9m2',
  footballDataApiKey: process.env.FOOTBALL_DATA_API_KEY ?? '',
};
