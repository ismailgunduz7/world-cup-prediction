import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import {
  areSelectionsLocked,
  getSelectionLockAt,
  hasTournamentStarted,
} from '../services/tournament-config.js';

const teamRoutes = new Hono<{ Variables: AppVariables }>();

teamRoutes.use('*', authMiddleware);

teamRoutes.get('/', participantMiddleware, async (c) => {
  const [{ data: tiers, error: tierError }, { data: teams, error: teamError }, { data: totals, error: totalError }] =
    await Promise.all([
      supabase.from('tiers').select('*').order('sort_order'),
      supabase.from('teams').select('*, tier:tiers(*)').eq('is_active', true).order('name_tr'),
      supabase.from('team_total_points').select('*'),
    ]);

  if (tierError) throw tierError;
  if (teamError) throw teamError;
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const teamsWithPoints = (teams ?? []).map((team) => ({
    ...team,
    total_points: pointsMap.get(team.id) ?? 0,
  }));

  const groups = [...new Set((teams ?? []).map((t) => t.group_code))].sort().map((code) => ({
    code,
    teams: teamsWithPoints.filter((t) => t.group_code === code),
  }));

  const [selectionsLocked, tournamentStarted, lockAt] = await Promise.all([
    areSelectionsLocked(),
    hasTournamentStarted(),
    getSelectionLockAt(),
  ]);

  return c.json({
    tiers: tiers ?? [],
    teams: teamsWithPoints,
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
    .select('*, tier:tiers(*)')
    .eq('id', teamId)
    .eq('is_active', true)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!team) {
    return c.json({ error: 'Takım bulunamadı' }, 404);
  }

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(id, name_tr, tier_id), away_team:teams!matches_away_team_id_fkey(id, name_tr, tier_id)')
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('scheduled_at');

  if (error) throw error;

  const matchIds = (matches ?? []).map((m) => m.id);
  let pointEntries: unknown[] = [];

  if (matchIds.length > 0) {
    const { data: entries, error: peError } = await supabase
      .from('team_point_entries')
      .select('*, rule_type:scoring_rule_types(code, name_tr, category)')
      .eq('team_id', teamId)
      .in('match_id', matchIds)
      .order('earned_at');

    if (peError) throw peError;
    pointEntries = entries ?? [];
  }

  const { data: allTeamPoints } = await supabase
    .from('team_point_entries')
    .select('*, rule_type:scoring_rule_types(code, name_tr, category)')
    .eq('team_id', teamId)
    .order('earned_at', { nullsFirst: false });

  let cumulative = 0;
  const pointsWithCumulative = (allTeamPoints ?? []).map((entry) => {
    cumulative += Number(entry.points);
    return { ...entry, cumulative_points: cumulative, tier_code: team.tier?.code };
  });

  const pointsByMatch = new Map<number, typeof pointsWithCumulative>();
  for (const entry of pointsWithCumulative) {
    if (!entry.match_id) continue;
    const list = pointsByMatch.get(entry.match_id) ?? [];
    list.push(entry);
    pointsByMatch.set(entry.match_id, list);
  }

  const enrichedMatches = (matches ?? []).map((match) => ({
    ...match,
    point_breakdown: pointsByMatch.get(match.id) ?? [],
    match_cumulative_points: (pointsByMatch.get(match.id) ?? []).reduce(
      (sum, e) => sum + Number(e.points),
      0,
    ),
  }));

  const bonusEntries = (allTeamPoints ?? []).filter((entry) => entry.match_id === null);

  return c.json({
    team,
    matches: enrichedMatches,
    all_point_entries: pointsWithCumulative,
    bonus_entries: bonusEntries,
    total_points: cumulative,
  });
});

export default teamRoutes;
