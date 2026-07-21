import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './lib/config.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/teams.js';
import selectionRoutes from './routes/selections.js';
import leaderboardRoutes from './routes/leaderboard.js';
import playerRoutes from './routes/players.js';
import groupRoutes from './routes/groups.js';
import scoringRulesRoutes from './routes/scoring-rules.js';
import adminRoutes from './routes/admin.js';
import meRoutes from './routes/me.js';
import bracketRoutes from './routes/bracket.js';
import randomModeRoutes from './routes/random-mode.js';
import betProgressRoutes from './routes/bet-progress.js';
import matchesRoutes from './routes/matches.js';
import { getSelectionLockAt, hasTournamentStarted, areSelectionsLocked } from './services/tournament-config.js';
import { isRandomModeEnabledForUser } from './services/random-mode-service.js';
import { optionalAuthMiddleware, type AppVariables } from './middleware/auth.js';
import { shutdownMiddleware } from './middleware/shutdown.js';

const app = new Hono<{ Variables: AppVariables }>();

app.use(
  '*',
  cors({
    origin: config.clientOrigin,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// Turnuva bitti: hiçbir API isteğini işleme; Vercel projesi silinmeden trafiği kes.
app.use('*', shutdownMiddleware);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', authRoutes);
app.route('/api/teams', teamRoutes);
app.route('/api/selections', selectionRoutes);
app.route('/api/leaderboard', leaderboardRoutes);
app.route('/api/players', playerRoutes);
app.route('/api/groups', groupRoutes);
app.route('/api/scoring-rules', scoringRulesRoutes);
app.route('/api/bracket', bracketRoutes);
app.route('/api/random-mode', randomModeRoutes);
app.route('/api/bet-progress', betProgressRoutes);
app.route('/api/matches', matchesRoutes);
app.route(`/api/admin/${config.adminPath}`, adminRoutes);

app.get('/api/tournament/status', optionalAuthMiddleware, async (c) => {
  // Random mode is per-competition, so the flag is resolved against the caller's
  // competition. Unauthenticated/unassigned callers get `false`.
  const currentUser = c.get('user');
  const [selectionsLocked, tournamentStarted, lockAt, randomModeEnabled] = await Promise.all([
    areSelectionsLocked(),
    hasTournamentStarted(),
    getSelectionLockAt(),
    isRandomModeEnabledForUser(currentUser?.competitionId ?? null),
  ]);

  return c.json({
    selectionsLocked,
    tournamentStarted,
    selectionLockAt: lockAt?.toISOString() ?? null,
    adminPathConfigured: !!config.adminPath,
    randomModeEnabled,
  });
});

app.route('/api/me', meRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Sunucu hatası' }, 500);
});

serve({ fetch: app.fetch, port: config.port }, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

export default app;
