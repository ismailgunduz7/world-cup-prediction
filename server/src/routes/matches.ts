import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { getStageLabel } from '../lib/stage-labels.js';
import { unwrapOne } from '../lib/serializers.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import type { MatchStage } from '../lib/types.js';

const matchesRoutes = new Hono<{ Variables: AppVariables }>();

matchesRoutes.use('*', authMiddleware, participantMiddleware);

const FIXTURE_STATUSES = ['live', 'scheduled', 'finished', 'postponed'] as const;

matchesRoutes.get('/', async (c) => {
  const { data, error } = await supabase
    .from('matches')
    .select(
      'id, stage, group_code, round_label, status, scheduled_at, home_score, away_score, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)',
    )
    .in('status', [...FIXTURE_STATUSES])
    .order('scheduled_at', { ascending: true });

  if (error) throw error;

  type MatchRow = {
    id: number;
    stage: MatchStage;
    group_code: string | null;
    round_label: string | null;
    status: string;
    scheduled_at: string;
    home_score: number | null;
    away_score: number | null;
    home_team: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
    away_team: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
  };

  const matches = ((data ?? []) as MatchRow[]).map((match) => {
    const homeTeam = unwrapOne(match.home_team);
    const awayTeam = unwrapOne(match.away_team);
    return {
      id: match.id,
      stage: match.stage,
      stageLabel: getStageLabel(match.stage),
      groupCode: match.group_code,
      roundLabel: match.round_label,
      status: match.status,
      scheduledAt: match.scheduled_at,
      homeTeam: {
        id: homeTeam?.id ?? null,
        name: homeTeam?.name_tr ?? '—',
      },
      awayTeam: {
        id: awayTeam?.id ?? null,
        name: awayTeam?.name_tr ?? '—',
      },
      homeScore: match.home_score,
      awayScore: match.away_score,
    };
  });

  return c.json({ matches });
});

export default matchesRoutes;
