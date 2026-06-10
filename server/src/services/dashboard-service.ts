import { supabase } from '../lib/config.js';
import { getStageLabel } from '../lib/stage-labels.js';
import type { MatchStage } from '../lib/types.js';
import { getTeamQualificationMap, qualificationLabel } from './best-third-service.js';
import { getGroupStandingsSummaries } from './group-standings-service.js';
import {
  areSelectionsLocked,
  getSelectionLockAt,
  getTournamentStartAt,
  hasTournamentStarted,
} from './tournament-config.js';

type MatchWithTeams = {
  id: number;
  stage: MatchStage;
  scheduled_at: string;
  status: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_score: number | null;
  away_score: number | null;
  home_team: { id: number; name_tr: string } | null;
  away_team: { id: number; name_tr: string } | null;
};

type PointEntryRow = {
  team_id: number;
  match_id: number | null;
  points: number;
  description_tr: string;
  earned_at: string | null;
  rule_type: { code: string; name_tr: string; category: string } | null;
};

type SelectionTeam = {
  id: number;
  name_tr: string;
  group_code: string;
  tier: { name_tr: string };
};

const MATCH_SELECT =
  '*, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)';

function opponentForTeam(match: MatchWithTeams, teamId: number): string {
  if (match.home_team_id === teamId) return match.away_team?.name_tr ?? '—';
  return match.home_team?.name_tr ?? '—';
}

function scoreForTeam(match: MatchWithTeams, teamId: number): string | null {
  if (match.home_score === null || match.away_score === null) return null;
  const isHome = match.home_team_id === teamId;
  const mine = isHome ? match.home_score : match.away_score;
  const theirs = isHome ? match.away_score : match.home_score;
  return `${mine}-${theirs}`;
}

function resultForTeam(match: MatchWithTeams, teamId: number): 'win' | 'draw' | 'loss' | null {
  if (match.home_score === null || match.away_score === null) return null;
  const isHome = match.home_team_id === teamId;
  const mine = isHome ? match.home_score : match.away_score;
  const theirs = isHome ? match.away_score : match.home_score;
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'loss';
  return 'draw';
}

async function buildLeaderboardEntries(competitionId: string | null) {
  // Leaderboard is scoped to the user's competition; unassigned users have no
  // ranked players (empty leaderboard).
  if (!competitionId) return [];

  const [{ data: users, error: userError }, { data: selections, error: selError }, { data: totals, error: totalError }] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, display_name')
        .eq('is_admin', false)
        .eq('competition_id', competitionId)
        .order('display_name'),
      supabase.from('team_selections').select('user_id, team_id'),
      supabase.from('team_total_points').select('*'),
    ]);

  if (userError) throw userError;
  if (selError) throw selError;
  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const byUser = new Map<string, number[]>();
  for (const sel of selections ?? []) {
    const list = byUser.get(sel.user_id) ?? [];
    list.push(sel.team_id);
    byUser.set(sel.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userTeamIds = byUser.get(u.id) ?? [];
    const totalScore = userTeamIds.reduce((sum, teamId) => sum + (pointsMap.get(teamId) ?? 0), 0);
    return {
      userId: u.id,
      displayName: u.display_name,
      totalScore,
      hasSelections: userTeamIds.length > 0,
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName, 'tr'));

  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function buildMiniLeaderboard(
  entries: Array<{ userId: string; displayName: string; totalScore: number; rank: number }>,
  userId: string,
) {
  const myIndex = entries.findIndex((e) => e.userId === userId);
  const indices = new Set<number>();

  for (let i = 0; i < Math.min(3, entries.length); i++) {
    indices.add(i);
  }

  if (myIndex >= 0) {
    indices.add(myIndex);
    if (myIndex > 0) indices.add(myIndex - 1);
    if (myIndex < entries.length - 1) indices.add(myIndex + 1);
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({
      rank: entries[i].rank,
      displayName: entries[i].displayName,
      totalScore: entries[i].totalScore,
      isCurrentUser: entries[i].userId === userId,
    }));
}

function buildMinimalTeams(
  selections: Array<{ team: unknown }>,
  pointsMap: Map<number, number>,
) {
  return selections.map((selection) => {
    const team = selection.team as SelectionTeam;
    return {
      teamId: team.id,
      name: team.name_tr,
      groupCode: team.group_code,
      tierName: team.tier.name_tr,
      totalPoints: pointsMap.get(team.id) ?? 0,
      qualificationLabel: null,
      lastMatch: null,
      nextMatch: null,
    };
  });
}

function buildPreTournamentResponse(
  status: {
    selectionsLocked: boolean;
    tournamentStarted: boolean;
    selectionLockAt: string | null;
    tournamentStartAt: string | null;
  },
  hasSelections: boolean,
  teams: ReturnType<typeof buildMinimalTeams>,
) {
  return {
    status,
    me: {
      rank: null,
      totalScore: 0,
      playerCount: 0,
      pointsToLeader: null,
      pointsToNext: null,
      hasSelections,
    },
    teams,
    upcoming: [],
    miniLeaderboard: [],
    recentActivity: [],
    groupProgress: [],
  };
}

export async function getDashboardData(userId: string, competitionId: string | null) {
  const [selectionsLocked, tournamentStarted, lockAt, startAt] = await Promise.all([
    areSelectionsLocked(),
    hasTournamentStarted(),
    getSelectionLockAt(),
    getTournamentStartAt(),
  ]);

  const status = {
    selectionsLocked,
    tournamentStarted,
    selectionLockAt: lockAt?.toISOString() ?? null,
    tournamentStartAt: startAt?.toISOString() ?? null,
  };

  const { data: selections, error: selError } = await supabase
    .from('team_selections')
    .select('*, team:teams(*, tier:tiers(name_tr))')
    .eq('user_id', userId)
    .order('selected_at');

  if (selError) throw selError;

  const teamIds = (selections ?? []).map((s) => s.team_id);
  const hasSelections = teamIds.length > 0;

  if (!tournamentStarted) {
    if (!hasSelections) {
      return buildPreTournamentResponse(status, false, []);
    }

    const { data: totals, error: totalError } = await supabase
      .from('team_total_points')
      .select('*')
      .in('team_id', teamIds);

    if (totalError) throw totalError;

    const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));
    const teams = buildMinimalTeams(selections ?? [], pointsMap);

    return buildPreTournamentResponse(status, true, teams);
  }

  const selectedTeamIds = new Set(teamIds);

  if (!hasSelections) {
    return {
      status,
      me: {
        rank: null,
        totalScore: 0,
        playerCount: 0,
        pointsToLeader: null,
        pointsToNext: null,
        hasSelections: false,
      },
      teams: [],
      upcoming: [],
      miniLeaderboard: [],
      recentActivity: [],
      groupProgress: [],
    };
  }

  const qualificationMap = await getTeamQualificationMap();

  const [leaderboardEntries, groupSummaries, totalsResult, pointEntriesResult, matchesResult] =
    await Promise.all([
      buildLeaderboardEntries(competitionId),
      getGroupStandingsSummaries(qualificationMap),
      supabase.from('team_total_points').select('*').in('team_id', teamIds),
      supabase
        .from('team_point_entries')
        .select('*, rule_type:scoring_rule_types(code, name_tr, category)')
        .in('team_id', teamIds)
        .order('earned_at', { nullsFirst: false }),
      supabase
        .from('matches')
        .select(MATCH_SELECT)
        .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
        .order('scheduled_at'),
    ]);

  if (totalsResult.error) throw totalsResult.error;
  if (pointEntriesResult.error) throw pointEntriesResult.error;
  if (matchesResult.error) throw matchesResult.error;

  const meEntry = leaderboardEntries.find((e) => e.userId === userId);
  const leaderEntry = leaderboardEntries[0] ?? null;
  const aboveEntry =
    meEntry && meEntry.rank > 1
      ? leaderboardEntries.find((e) => e.rank === meEntry.rank - 1) ?? null
      : null;

  const pointsMap = new Map((totalsResult.data ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const entriesByTeam = new Map<number, PointEntryRow[]>();
  for (const entry of (pointEntriesResult.data ?? []) as PointEntryRow[]) {
    const list = entriesByTeam.get(entry.team_id) ?? [];
    list.push(entry);
    entriesByTeam.set(entry.team_id, list);
  }

  const matchesByTeam = new Map<number, MatchWithTeams[]>();
  for (const match of (matchesResult.data ?? []) as MatchWithTeams[]) {
    for (const teamId of teamIds) {
      if (match.home_team_id === teamId || match.away_team_id === teamId) {
        const list = matchesByTeam.get(teamId) ?? [];
        list.push(match);
        matchesByTeam.set(teamId, list);
      }
    }
  }

  const teams = (selections ?? []).map((selection) => {
    const team = selection.team as SelectionTeam;
    const teamId = team.id;
    const teamMatches = matchesByTeam.get(teamId) ?? [];
    const finished = teamMatches.filter((m) => m.status === 'finished');
    const upcomingMatches = teamMatches.filter((m) => m.status !== 'finished');
    const lastMatch = finished.length > 0 ? finished[finished.length - 1] : null;
    const nextMatch = upcomingMatches.length > 0 ? upcomingMatches[0] : null;

    const qualStatus = qualificationMap.get(teamId) ?? null;

    let lastMatchPayload = null;
    if (lastMatch) {
      const breakdown = (entriesByTeam.get(teamId) ?? []).filter((e) => e.match_id === lastMatch.id);
      lastMatchPayload = {
        matchId: lastMatch.id,
        opponent: opponentForTeam(lastMatch, teamId),
        score: scoreForTeam(lastMatch, teamId),
        result: resultForTeam(lastMatch, teamId),
        pointsEarned: breakdown.reduce((sum, e) => sum + Number(e.points), 0),
        playedAt: lastMatch.scheduled_at,
        stageLabel: getStageLabel(lastMatch.stage),
      };
    }

    let nextMatchPayload = null;
    if (nextMatch) {
      nextMatchPayload = {
        matchId: nextMatch.id,
        opponent: opponentForTeam(nextMatch, teamId),
        scheduledAt: nextMatch.scheduled_at,
        stageLabel: getStageLabel(nextMatch.stage),
      };
    }

    return {
      teamId,
      name: team.name_tr,
      groupCode: team.group_code,
      tierName: team.tier.name_tr,
      totalPoints: pointsMap.get(teamId) ?? 0,
      qualificationLabel: qualificationLabel(qualStatus),
      lastMatch: lastMatchPayload,
      nextMatch: nextMatchPayload,
    };
  });

  const upcoming = teamIds
    .flatMap((teamId) => {
      const team = teams.find((t) => t.teamId === teamId);
      const teamMatches = matchesByTeam.get(teamId) ?? [];
      return teamMatches
        .filter((m) => m.status !== 'finished')
        .map((match) => ({
          matchId: match.id,
          teamId,
          teamName: team?.name ?? '',
          opponent: opponentForTeam(match, teamId),
          scheduledAt: match.scheduled_at,
          stageLabel: getStageLabel(match.stage),
        }));
    })
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const recentActivity = teamIds
    .flatMap((teamId) => {
      const team = teams.find((t) => t.teamId === teamId);
      const teamMatches = matchesByTeam.get(teamId) ?? [];
      return teamMatches
        .filter((m) => m.status === 'finished')
        .map((match) => {
          const breakdown = (entriesByTeam.get(teamId) ?? [])
            .filter((e) => e.match_id === match.id)
            .map((e) => ({
              description: e.description_tr,
              points: Number(e.points),
            }));
          return {
            matchId: match.id,
            teamId,
            teamName: team?.name ?? '',
            opponent: opponentForTeam(match, teamId),
            score: scoreForTeam(match, teamId),
            pointsEarned: breakdown.reduce((sum, e) => sum + e.points, 0),
            playedAt: match.scheduled_at,
            stageLabel: getStageLabel(match.stage),
            breakdown,
          };
        });
    })
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 8);

  const userGroupCodes = new Set(
    (selections ?? []).map((s) => (s.team as SelectionTeam).group_code),
  );

  const groupProgress = groupSummaries
    .filter((group) => userGroupCodes.has(group.code))
    .map((group) => ({
      code: group.code,
      isFinalized: group.isFinalized,
      standings: group.standings.map((standing) => ({
        rank: standing.rank,
        teamId: standing.teamId,
        teamName: standing.teamName,
        played: standing.played,
        points: standing.points,
        goalDifference: standing.goalDifference,
        qualificationLabel: standing.qualificationLabel,
        isUserSelection: selectedTeamIds.has(standing.teamId),
      })),
    }));

  return {
    status,
    me: {
      rank: meEntry?.rank ?? null,
      totalScore: meEntry?.totalScore ?? 0,
      playerCount: leaderboardEntries.length,
      pointsToLeader:
        leaderEntry && meEntry ? Math.max(0, leaderEntry.totalScore - meEntry.totalScore) : null,
      pointsToNext: aboveEntry && meEntry ? Math.max(0, aboveEntry.totalScore - meEntry.totalScore) : null,
      hasSelections: true,
    },
    teams,
    upcoming,
    miniLeaderboard: buildMiniLeaderboard(leaderboardEntries, userId),
    recentActivity,
    groupProgress,
  };
}
