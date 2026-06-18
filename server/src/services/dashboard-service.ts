import { supabase } from '../lib/config.js';
import { getStageLabel } from '../lib/stage-labels.js';
import { pointsBasisScore } from '../lib/match-basis.js';
import { unwrapOne } from '../lib/serializers.js';
import { buildLeaderSummary, buildRankMe } from '../lib/rank-summary.js';
import type { MatchStage } from '../lib/types.js';
import { getTeamQualificationMap, qualificationLabel } from './best-third-service.js';
import { getGroupStandingsSummaries } from './group-standings-service.js';
import { buildRandomModeRankContext } from './random-mode-service.js';
import {
  areSelectionsLocked,
  getConfigValue,
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
  home_score_aet: number | null;
  away_score_aet: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
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

const LIVE_MATCH_SELECT =
  'id, stage, group_code, round_label, status, scheduled_at, home_score, away_score, home_score_aet, away_score_aet, home_penalties, away_penalties, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)';

type LiveMatchRow = {
  id: number;
  stage: MatchStage;
  group_code: string | null;
  round_label: string | null;
  status: string;
  scheduled_at: string;
  home_score: number | null;
  away_score: number | null;
  home_score_aet: number | null;
  away_score_aet: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  home_team: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
  away_team: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
};

function serializeLiveMatch(match: LiveMatchRow) {
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
    homeScoreAet: match.home_score_aet,
    awayScoreAet: match.away_score_aet,
    homePenalties: match.home_penalties,
    awayPenalties: match.away_penalties,
  };
}

function opponentForTeam(match: MatchWithTeams, teamId: number): string {
  if (match.home_team_id === teamId) return match.away_team?.name_tr ?? '—';
  return match.home_team?.name_tr ?? '—';
}

function scoreForTeam(match: MatchWithTeams, teamId: number): string | null {
  if (match.home_score === null || match.away_score === null) return null;
  const isHome = match.home_team_id === teamId;
  const pick = (home: number, away: number) => (isHome ? `${home}-${away}` : `${away}-${home}`);

  // Gerçek skor + etiket: uzatmaya gidildiyse sahadaki skor uzatma sonu skorudur.
  if (match.home_score_aet !== null && match.away_score_aet !== null) {
    let label = `${pick(match.home_score_aet, match.away_score_aet)} (uzt.)`;
    if (match.home_penalties !== null && match.away_penalties !== null) {
      label += `, pen ${pick(match.home_penalties, match.away_penalties)}`;
    }
    return label;
  }
  return pick(match.home_score, match.away_score);
}

function resultForTeam(
  match: MatchWithTeams,
  teamId: number,
  knockoutResultOver120: boolean,
): 'win' | 'draw' | 'loss' | null {
  // G/B/M rozeti puan esasıyla tutarlı olmalı (ayar pasifse 90', aktifse 120').
  const basis = pointsBasisScore(match, knockoutResultOver120);
  if (basis.home === null || basis.away === null) return null;
  const isHome = match.home_team_id === teamId;
  const mine = isHome ? basis.home : basis.away;
  const theirs = isHome ? basis.away : basis.home;
  if (mine > theirs) return 'win';
  if (mine < theirs) return 'loss';
  return 'draw';
}

async function buildLeaderboardEntries(competitionId: string | null) {
  // Leaderboard is scoped to the user's competition; unassigned users have no
  // ranked players (empty leaderboard).
  if (!competitionId) return [];

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('is_admin', false)
    .eq('competition_id', competitionId)
    .order('display_name');
  if (userError) throw userError;

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) return [];

  // Selections are scoped to this competition's members so other competitions'
  // picks never enter the score computation.
  const [{ data: selections, error: selError }, { data: totals, error: totalError }] = await Promise.all([
    supabase.from('team_selections').select('user_id, team_id').in('user_id', userIds),
    supabase.from('team_total_points').select('*'),
  ]);

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

type MiniLeaderboardEntry =
  | {
      isGap?: false;
      rank: number;
      displayName: string;
      totalScore: number;
      isCurrentUser: boolean;
    }
  | { isGap: true };

function toPlayerEntry(
  entry: { userId: string; displayName: string; totalScore: number; rank: number },
  userId: string,
): MiniLeaderboardEntry {
  return {
    rank: entry.rank,
    displayName: entry.displayName,
    totalScore: entry.totalScore,
    isCurrentUser: entry.userId === userId,
  };
}

function buildMiniLeaderboard(
  entries: Array<{ userId: string; displayName: string; totalScore: number; rank: number }>,
  userId: string,
): MiniLeaderboardEntry[] {
  if (entries.length <= 10) {
    return entries.map((entry) => toPlayerEntry(entry, userId));
  }

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

  const sortedIndices = [...indices].sort((a, b) => a - b);
  const result: MiniLeaderboardEntry[] = [];

  for (let j = 0; j < sortedIndices.length; j++) {
    const i = sortedIndices[j];
    const prev = sortedIndices[j - 1];
    if (j > 0 && i - prev > 1) {
      result.push({ isGap: true });
    }
    result.push(toPlayerEntry(entries[i], userId));
  }

  return result;
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
    liveMatches: [],
    leaderSummary: null,
    randomRank: null,
    miniLeaderboard: [],
    recentActivity: [],
    groupProgress: [],
  };
}

export async function getDashboardData(userId: string, competitionId: string | null) {
  const [selectionsLocked, tournamentStarted, lockAt, startAt, scoringFlags] = await Promise.all([
    areSelectionsLocked(),
    hasTournamentStarted(),
    getSelectionLockAt(),
    getTournamentStartAt(),
    getConfigValue<{ knockout_result_over_120?: boolean }>('scoring_flags', {
      knockout_result_over_120: false,
    }),
  ]);
  const knockoutResultOver120 = scoringFlags.knockout_result_over_120 ?? false;

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
      liveMatches: [],
      leaderSummary: null,
      randomRank: null,
      miniLeaderboard: [],
      recentActivity: [],
      groupProgress: [],
    };
  }

  const qualificationMap = await getTeamQualificationMap();

  const [leaderboardEntries, groupSummaries, totalsResult, pointEntriesResult, matchesResult, liveMatchesResult, randomRank] =
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
      supabase.from('matches').select(LIVE_MATCH_SELECT).eq('status', 'live').order('scheduled_at'),
      buildRandomModeRankContext(competitionId, userId),
    ]);

  if (totalsResult.error) throw totalsResult.error;
  if (pointEntriesResult.error) throw pointEntriesResult.error;
  if (matchesResult.error) throw matchesResult.error;
  if (liveMatchesResult.error) throw liveMatchesResult.error;

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
        result: resultForTeam(lastMatch, teamId, knockoutResultOver120),
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
    me: buildRankMe(leaderboardEntries, userId, true),
    teams,
    upcoming,
    liveMatches: ((liveMatchesResult.data ?? []) as LiveMatchRow[]).map(serializeLiveMatch),
    leaderSummary: buildLeaderSummary(leaderboardEntries, userId),
    randomRank,
    miniLeaderboard: buildMiniLeaderboard(leaderboardEntries, userId),
    recentActivity,
    groupProgress,
  };
}
