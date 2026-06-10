import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, type AppVariables } from '../middleware/auth.js';
import { buildPlayerLeaderboard } from '../services/leaderboard-service.js';

const leaderboardRoutes = new Hono<{ Variables: AppVariables }>();

leaderboardRoutes.use('*', authMiddleware);

leaderboardRoutes.get('/', async (c) => {
  const user = c.get('user');

  // Player list is scoped to the caller's competition (empty when unassigned).
  // Team standings stay global since they're tournament-wide data, not players.
  const entries = await buildPlayerLeaderboard(user.competitionId, user.id);

  const { data: totals, error: totalError } = await supabase.from('team_total_points').select('*');
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const { data: ownSelections, error: ownSelError } = await supabase
    .from('team_selections')
    .select('team_id')
    .eq('user_id', user.id);

  if (ownSelError) throw ownSelError;

  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(name_tr)')
    .eq('is_active', true);

  if (teamError) throw teamError;

  type TeamRow = {
    id: number;
    name_tr: string;
    group_code: string;
    tier: { name_tr: string } | { name_tr: string }[] | null;
  };

  const userSelectedTeamIds = new Set((ownSelections ?? []).map((s) => s.team_id));

  const teamStandings = ((teams ?? []) as TeamRow[])
    .map((team) => {
      const tier = Array.isArray(team.tier) ? team.tier[0] ?? null : team.tier;
      return {
        teamId: team.id,
        name: team.name_tr,
        groupCode: team.group_code,
        tierName: tier?.name_tr ?? null,
        totalPoints: pointsMap.get(team.id) ?? 0,
        isUserSelection: userSelectedTeamIds.has(team.id),
      };
    })
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        a.name.localeCompare(b.name, 'tr'),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return c.json({ entries, teamStandings });
});

export default leaderboardRoutes;
