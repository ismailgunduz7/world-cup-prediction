import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, type AppVariables } from '../middleware/auth.js';

const leaderboardRoutes = new Hono<{ Variables: AppVariables }>();

leaderboardRoutes.use('*', authMiddleware);

leaderboardRoutes.get('/', async (c) => {
  const user = c.get('user');

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('is_admin', false)
    .order('display_name');

  if (userError) throw userError;

  const { data: selections, error: selError } = await supabase
    .from('team_selections')
    .select('user_id, team_id, team:teams(name_tr)')
    .order('selected_at');

  if (selError) throw selError;

  const { data: totals, error: totalError } = await supabase.from('team_total_points').select('*');
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  type SelectionRow = {
    user_id: string;
    team_id: number;
    team: { name_tr: string } | { name_tr: string }[] | null;
  };

  const byUser = new Map<string, SelectionRow[]>();
  for (const sel of (selections ?? []) as SelectionRow[]) {
    const list = byUser.get(sel.user_id) ?? [];
    list.push(sel);
    byUser.set(sel.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userSelections = byUser.get(u.id) ?? [];
    const totalScore = userSelections.reduce(
      (sum, s) => sum + (pointsMap.get(s.team_id) ?? 0),
      0,
    );

    return {
      username: u.username,
      displayName: u.display_name,
      isCurrentUser: u.id === user.id,
      totalScore,
      hasSelections: userSelections.length > 0,
      selections: userSelections.map((s) => {
        const team = Array.isArray(s.team) ? s.team[0] ?? null : s.team;
        return { name: team?.name_tr ?? '—', points: pointsMap.get(s.team_id) ?? 0 };
      }),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

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

  const userSelectedTeamIds = new Set(
    (byUser.get(user.id) ?? []).map((s) => s.team_id),
  );

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

  return c.json({
    entries: entries.map((e, index) => ({ ...e, rank: index + 1 })),
    teamStandings,
  });
});

export default leaderboardRoutes;
