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
    .select('*, team:teams(*, tier:tiers(*))')
    .order('selected_at');

  if (selError) throw selError;

  const { data: totals, error: totalError } = await supabase.from('team_total_points').select('*');
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const byUser = new Map<string, typeof selections>();
  for (const sel of selections ?? []) {
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
      userId: u.id,
      displayName: u.display_name,
      username: u.username,
      isCurrentUser: u.id === user.id,
      totalScore,
      hasSelections: userSelections.length > 0,
      selections: userSelections.map((s) => ({
        team: { ...s.team, total_points: pointsMap.get(s.team_id) ?? 0 },
        selectedAt: s.selected_at,
      })),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(id, code, name_tr, sort_order)')
    .eq('is_active', true);

  if (teamError) throw teamError;

  const userSelectedTeamIds = new Set(
    (byUser.get(user.id) ?? []).map((s) => s.team_id),
  );

  const teamStandings = (teams ?? [])
    .map((team) => ({
      teamId: team.id,
      name: team.name_tr,
      groupCode: team.group_code,
      tier: team.tier,
      totalPoints: pointsMap.get(team.id) ?? 0,
      isUserSelection: userSelectedTeamIds.has(team.id),
    }))
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
