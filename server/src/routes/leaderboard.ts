import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, type AppVariables } from '../middleware/auth.js';
import { buildPlayerLeaderboard, loadTeamPointsMap } from '../services/leaderboard-service.js';
import { unwrapOne } from '../lib/serializers.js';

const leaderboardRoutes = new Hono<{ Variables: AppVariables }>();

leaderboardRoutes.use('*', authMiddleware);

leaderboardRoutes.get('/', async (c) => {
  const user = c.get('user');

  // Team standings and the player leaderboard both need team totals; load the
  // view once and share it (the player list is scoped to the caller's
  // competition, empty when unassigned — team standings stay global).
  const pointsMap = await loadTeamPointsMap();
  const entries = await buildPlayerLeaderboard(user.competitionId, user.id, pointsMap);

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
      const tier = unwrapOne(team.tier);
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
