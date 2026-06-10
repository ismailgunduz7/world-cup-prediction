import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { toMatchSummary, toPointEntry, unwrapOne } from '../lib/serializers.js';
import {
  areSelectionsLocked,
  getSelectionLockAt,
  hasTournamentStarted,
} from '../services/tournament-config.js';

const teamRoutes = new Hono<{ Variables: AppVariables }>();

teamRoutes.use('*', authMiddleware);

teamRoutes.get('/', participantMiddleware, async (c) => {
  const [{ data: tiers, error: tierError }, { data: teams, error: teamError }] = await Promise.all([
    supabase.from('tiers').select('id, name_tr').order('sort_order'),
    supabase
      .from('teams')
      .select('id, name_tr, group_code, tier:tiers(id, name_tr)')
      .eq('is_active', true)
      .order('name_tr'),
  ]);

  if (tierError) throw tierError;
  if (teamError) throw teamError;

  type TeamRow = {
    id: number;
    name_tr: string;
    group_code: string;
    tier: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
  };

  const teamDtos = ((teams ?? []) as TeamRow[]).map((team) => {
    const tier = unwrapOne(team.tier);
    return {
      id: team.id,
      name: team.name_tr,
      groupCode: team.group_code,
      tier: tier ? { id: tier.id, name: tier.name_tr } : null,
    };
  });

  const groups = [...new Set(teamDtos.map((t) => t.groupCode))].sort().map((code) => ({
    code,
    teams: teamDtos.filter((t) => t.groupCode === code),
  }));

  const [selectionsLocked, tournamentStarted, lockAt] = await Promise.all([
    areSelectionsLocked(),
    hasTournamentStarted(),
    getSelectionLockAt(),
  ]);

  return c.json({
    tiers: (tiers ?? []).map((t) => ({ id: t.id, name: t.name_tr })),
    groups,
    meta: {
      selectionsLocked,
      tournamentStarted,
      selectionLockAt: lockAt?.toISOString() ?? null,
    },
  });
});

teamRoutes.get('/:id/matches', participantMiddleware, async (c) => {
  const teamId = Number(c.req.param('id'));
  if (Number.isNaN(teamId)) {
    return c.json({ error: 'Geçersiz takım' }, 400);
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(name_tr)')
    .eq('id', teamId)
    .eq('is_active', true)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team) {
    return c.json({ error: 'Takım bulunamadı' }, 404);
  }

  const tier = Array.isArray(team.tier) ? team.tier[0] ?? null : team.tier;

  const { data: matches, error } = await supabase
    .from('matches')
    .select(
      'id, stage, status, scheduled_at, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr)',
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('scheduled_at');

  if (error) throw error;

  const { data: allTeamPoints } = await supabase
    .from('team_point_entries')
    .select('match_id, points, description_tr, rule_type:scoring_rule_types(code, name_tr)')
    .eq('team_id', teamId)
    .order('earned_at', { nullsFirst: false });

  const pointsByMatch = new Map<number, typeof allTeamPoints>();
  for (const entry of allTeamPoints ?? []) {
    if (!entry.match_id) continue;
    const list = pointsByMatch.get(entry.match_id) ?? [];
    list.push(entry);
    pointsByMatch.set(entry.match_id, list);
  }

  const matchDtos = (matches ?? []).map((match) =>
    toMatchSummary(match as never, (pointsByMatch.get(match.id) ?? []) as never),
  );

  const bonusEntries = (allTeamPoints ?? [])
    .filter((entry) => entry.match_id === null)
    .map((entry) => toPointEntry(entry as never));

  const totalPoints = (allTeamPoints ?? []).reduce((sum, e) => sum + Number(e.points), 0);

  return c.json({
    team: {
      name: team.name_tr,
      groupCode: team.group_code,
      tierName: tier?.name_tr ?? null,
    },
    totalPoints,
    matches: matchDtos,
    bonusEntries,
  });
});

export default teamRoutes;
