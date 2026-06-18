import { supabase } from '../lib/config.js';
import { unwrapOne } from '../lib/serializers.js';

export type TeamMatchStats = {
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type LeaderboardTeamSelection = {
  teamId: number;
  name: string;
  points: number;
  tierName: string | null;
  groupCode: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type PlayerLeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  isCurrentUser: boolean;
  totalScore: number;
  hasSelections: boolean;
  selections: LeaderboardTeamSelection[];
};

type TeamJoin = {
  id: number;
  name_tr: string;
  group_code: string;
  tier: { name_tr: string } | { name_tr: string }[] | null;
};

type SelectionRow = {
  user_id: string;
  team_id: number;
  team: TeamJoin | TeamJoin[] | null;
};

function emptyStats(): TeamMatchStats {
  return { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
}

function toLeaderboardSelection(
  teamId: number,
  team: TeamJoin | null,
  pointsMap: Map<number, number>,
  statsMap: Map<number, TeamMatchStats>,
): LeaderboardTeamSelection {
  const stats = statsMap.get(teamId) ?? emptyStats();
  const tier = team ? unwrapOne(team.tier) : null;
  return {
    teamId,
    name: team?.name_tr ?? '—',
    points: pointsMap.get(teamId) ?? 0,
    tierName: tier?.name_tr ?? null,
    groupCode: team?.group_code ?? '',
    ...stats,
  };
}

/** Aggregates W/D/L and goals from every finished match per team. */
export async function loadTeamMatchStatsMap(): Promise<Map<number, TeamMatchStats>> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score')
    .eq('status', 'finished');

  if (error) throw error;

  const map = new Map<number, TeamMatchStats>();

  const ensure = (teamId: number) => {
    const current = map.get(teamId) ?? emptyStats();
    map.set(teamId, current);
    return current;
  };

  for (const match of matches ?? []) {
    if (match.home_score === null || match.away_score === null) continue;
    if (!match.home_team_id || !match.away_team_id) continue;

    const home = ensure(match.home_team_id);
    const away = ensure(match.away_team_id);

    home.goalsFor += match.home_score;
    home.goalsAgainst += match.away_score;
    away.goalsFor += match.away_score;
    away.goalsAgainst += match.home_score;

    if (match.home_score > match.away_score) {
      home.won += 1;
      away.lost += 1;
    } else if (match.home_score < match.away_score) {
      home.lost += 1;
      away.won += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
    }
  }

  return map;
}

/**
 * Builds the player leaderboard scoped to a single competition. Shared by the
 * participant-facing `/api/leaderboard` and the admin competition-monitoring
 * view so both stay consistent. Returns an empty list when `competitionId` is
 * null (unassigned users see no players).
 *
 * `currentUserId` is flagged via `isCurrentUser`; pass null for the admin view
 * (no row is the "current" player).
 *
 * `pointsMap` (team id → total points) can be supplied by callers that already
 * loaded `team_total_points` (e.g. `/api/leaderboard`, which also needs it for
 * team standings) to avoid fetching the same table twice; omitted, it is loaded
 * here.
 */
export async function buildPlayerLeaderboard(
  competitionId: string | null,
  currentUserId: string | null,
  pointsMap?: Map<number, number>,
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

  const [selectionsResult, statsMap] = await Promise.all([
    supabase
      .from('team_selections')
      .select('user_id, team_id, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
      .in('user_id', userIds)
      .order('selected_at'),
    loadTeamMatchStatsMap(),
  ]);

  const { data: selections, error: selError } = selectionsResult;
  if (selError) throw selError;

  const points = pointsMap ?? (await loadTeamPointsMap());

  const byUser = new Map<string, SelectionRow[]>();
  for (const sel of (selections ?? []) as SelectionRow[]) {
    const list = byUser.get(sel.user_id) ?? [];
    list.push(sel);
    byUser.set(sel.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userSelections = byUser.get(u.id) ?? [];
    const totalScore = userSelections.reduce((sum, s) => sum + (points.get(s.team_id) ?? 0), 0);

    return {
      username: u.username,
      displayName: u.display_name,
      isCurrentUser: u.id === currentUserId,
      totalScore,
      hasSelections: userSelections.length > 0,
      selections: userSelections.map((s) =>
        toLeaderboardSelection(s.team_id, unwrapOne(s.team), points, statsMap),
      ),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

  return entries.map((e, index) => ({ ...e, rank: index + 1 }));
}

export async function buildRandomModeLeaderboard(
  competitionId: string | null,
  currentUserId: string,
  pointsMap?: Map<number, number>,
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

  const [slotsResult, statsMap] = await Promise.all([
    supabase
      .from('random_mode_teams')
      .select('user_id, slot, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
      .in('user_id', userIds)
      .order('slot'),
    loadTeamMatchStatsMap(),
  ]);

  const { data: slots, error: slotError } = slotsResult;
  if (slotError) throw slotError;

  const points = pointsMap ?? (await loadTeamPointsMap());

  type SlotRow = {
    user_id: string;
    slot: number;
    team: TeamJoin | TeamJoin[] | null;
  };

  const byUser = new Map<string, SlotRow[]>();
  for (const row of (slots ?? []) as SlotRow[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userSlots = byUser.get(u.id) ?? [];
    const totalScore = userSlots.reduce((sum, s) => {
      const team = unwrapOne(s.team);
      return sum + (team ? points.get(team.id) ?? 0 : 0);
    }, 0);

    return {
      username: u.username,
      displayName: u.display_name,
      isCurrentUser: u.id === currentUserId,
      totalScore,
      hasSelections: userSlots.length > 0,
      selections: userSlots.map((s) => {
        const team = unwrapOne(s.team);
        return toLeaderboardSelection(team?.id ?? 0, team, points, statsMap);
      }),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

  return entries.map((e, index) => ({ ...e, rank: index + 1 }));
}

/** Loads the team id → total points map from the `team_total_points` view. */
export async function loadTeamPointsMap(): Promise<Map<number, number>> {
  const { data: totals, error } = await supabase.from('team_total_points').select('*');
  if (error) throw error;
  return new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));
}
