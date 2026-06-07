import { supabase } from '../lib/config.js';
import { getTeamQualificationMap, qualificationLabel, type QualificationStatus } from './best-third-service.js';

export const GROUP_CODES = 'ABCDEFGHIJKL'.split('');

export type GroupStandingRow = {
  rank: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isFinalized: boolean;
  qualificationLabel: string | null;
};

export type GroupStandingsSummary = {
  code: string;
  totalMatches: number;
  finishedMatches: number;
  isFinalized: boolean;
  rankIsManual: boolean;
  standings: GroupStandingRow[];
};

type StandingRecord = {
  team_id: number;
  group_code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  rank: number | null;
  is_finalized: boolean;
  rank_is_manual: boolean;
  team: { id: number; name_tr: string };
};

function autoSortStandings(list: StandingRecord[]) {
  return [...list].sort((a, b) => {
    return (
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team.name_tr.localeCompare(b.team.name_tr, 'tr')
    );
  });
}

function sortStandings(list: StandingRecord[]) {
  return [...list].sort((a, b) => {
    if (a.is_finalized && b.is_finalized && a.rank !== null && b.rank !== null) {
      return a.rank - b.rank;
    }
    return (
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team.name_tr.localeCompare(b.team.name_tr, 'tr')
    );
  });
}

function standingsOrderDiffersFromAuto(list: StandingRecord[]) {
  if (!list.every((standing) => standing.is_finalized && standing.rank !== null)) {
    return false;
  }

  const autoOrder = autoSortStandings(list).map((standing) => standing.team_id);
  const currentOrder = [...list]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((standing) => standing.team_id);

  return autoOrder.join(',') !== currentOrder.join(',');
}

export async function getGroupStandingsSummaries(
  qualificationMap?: Map<number, QualificationStatus>,
): Promise<GroupStandingsSummary[]> {
  const [{ data: standings, error: stError }, { data: matches, error: mError }] = await Promise.all([
    supabase
      .from('group_standings')
      .select('*, team:teams(id, name_tr)')
      .in('group_code', GROUP_CODES),
    supabase.from('matches').select('group_code, status').eq('stage', 'group'),
  ]);

  if (stError) throw stError;
  if (mError) throw mError;

  const matchStats = new Map<string, { total: number; finished: number }>();
  for (const match of matches ?? []) {
    if (!match.group_code) continue;
    const stats = matchStats.get(match.group_code) ?? { total: 0, finished: 0 };
    stats.total += 1;
    if (match.status === 'finished') stats.finished += 1;
    matchStats.set(match.group_code, stats);
  }

  const standingsByGroup = new Map<string, StandingRecord[]>();
  for (const standing of (standings ?? []) as StandingRecord[]) {
    const list = standingsByGroup.get(standing.group_code) ?? [];
    list.push(standing);
    standingsByGroup.set(standing.group_code, list);
  }

  const resolvedQualificationMap = qualificationMap ?? (await getTeamQualificationMap());

  return GROUP_CODES.map((code) => {
    const stats = matchStats.get(code) ?? { total: 0, finished: 0 };
    const groupStandings = sortStandings(standingsByGroup.get(code) ?? []);
    const isFinalized =
      groupStandings.length > 0 && groupStandings.every((standing) => standing.is_finalized);
    const rankIsManual =
      groupStandings.some((standing) => standing.rank_is_manual) ||
      standingsOrderDiffersFromAuto(groupStandings);

    return {
      code,
      totalMatches: stats.total,
      finishedMatches: stats.finished,
      isFinalized,
      rankIsManual,
      standings: groupStandings.map((standing, index) => ({
        rank: standing.is_finalized && standing.rank !== null ? standing.rank : index + 1,
        teamId: standing.team_id,
        teamName: standing.team.name_tr,
        played: standing.played,
        won: standing.won,
        drawn: standing.drawn,
        lost: standing.lost,
        goalsFor: standing.goals_for,
        goalsAgainst: standing.goals_against,
        goalDifference: standing.goal_difference,
        points: standing.points,
        isFinalized: standing.is_finalized,
        qualificationLabel: standing.is_finalized
          ? qualificationLabel(resolvedQualificationMap.get(standing.team_id) ?? null)
          : null,
      })),
    };
  });
}
