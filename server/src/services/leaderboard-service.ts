import { supabase } from '../lib/config.js';

export type PlayerLeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  isCurrentUser: boolean;
  totalScore: number;
  hasSelections: boolean;
  selections: Array<{ name: string; points: number }>;
};

type SelectionRow = {
  user_id: string;
  team_id: number;
  team: { name_tr: string } | { name_tr: string }[] | null;
};

/**
 * Builds the player leaderboard scoped to a single competition. Shared by the
 * participant-facing `/api/leaderboard` and the admin competition-monitoring
 * view so both stay consistent. Returns an empty list when `competitionId` is
 * null (unassigned users see no players).
 *
 * `currentUserId` is flagged via `isCurrentUser`; pass null for the admin view
 * (no row is the "current" player).
 */
export async function buildPlayerLeaderboard(
  competitionId: string | null,
  currentUserId: string | null,
): Promise<PlayerLeaderboardEntry[]> {
  if (!competitionId) return [];

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('is_admin', false)
    .eq('competition_id', competitionId)
    .order('display_name');

  if (userError) throw userError;

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) return [];

  const { data: selections, error: selError } = await supabase
    .from('team_selections')
    .select('user_id, team_id, team:teams(name_tr)')
    .in('user_id', userIds)
    .order('selected_at');

  if (selError) throw selError;

  const { data: totals, error: totalError } = await supabase.from('team_total_points').select('*');
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const byUser = new Map<string, SelectionRow[]>();
  for (const sel of (selections ?? []) as SelectionRow[]) {
    const list = byUser.get(sel.user_id) ?? [];
    list.push(sel);
    byUser.set(sel.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userSelections = byUser.get(u.id) ?? [];
    const totalScore = userSelections.reduce((sum, s) => sum + (pointsMap.get(s.team_id) ?? 0), 0);

    return {
      username: u.username,
      displayName: u.display_name,
      isCurrentUser: u.id === currentUserId,
      totalScore,
      hasSelections: userSelections.length > 0,
      selections: userSelections.map((s) => {
        const team = Array.isArray(s.team) ? s.team[0] ?? null : s.team;
        return { name: team?.name_tr ?? '—', points: pointsMap.get(s.team_id) ?? 0 };
      }),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

  return entries.map((e, index) => ({ ...e, rank: index + 1 }));
}
