import { supabase } from '../lib/config.js';
import { GROUP_CODES } from './group-standings-service.js';
import { getConfigValue, setConfigValue } from './tournament-config.js';

export const BEST_THIRD_ADVANCING_COUNT = 8;

export type BestThirdRow = {
  globalRank: number;
  teamId: number;
  teamName: string;
  groupCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalDifference: number;
  points: number;
  isAdvancing: boolean;
};

export type BestThirdSummary = {
  isReady: boolean;
  isComputed: boolean;
  rankIsManual: boolean;
  advancingCount: number;
  rows: BestThirdRow[];
};

type ThirdCandidate = {
  team_id: number;
  group_code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goal_difference: number;
  points: number;
  team: { id: number; name_tr: string };
};

function sortThirdCandidates(list: ThirdCandidate[]) {
  return [...list].sort((a, b) => {
    return (
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team.name_tr.localeCompare(b.team.name_tr, 'tr')
    );
  });
}

export async function allGroupsFinalized(): Promise<boolean> {
  const { data, error } = await supabase
    .from('group_standings')
    .select('group_code, is_finalized')
    .in('group_code', GROUP_CODES);

  if (error) throw error;

  for (const code of GROUP_CODES) {
    const groupRows = (data ?? []).filter((row) => row.group_code === code);
    if (groupRows.length === 0 || !groupRows.every((row) => row.is_finalized)) {
      return false;
    }
  }

  return true;
}

async function loadThirdCandidates(): Promise<ThirdCandidate[]> {
  const { data, error } = await supabase
    .from('group_standings')
    .select('team_id, group_code, played, won, drawn, lost, goals_for, goal_difference, points, rank, is_finalized, team:teams(id, name_tr)')
    .eq('rank', 3)
    .eq('is_finalized', true);

  if (error) throw error;
  return (data ?? []) as unknown as ThirdCandidate[];
}

async function isBestThirdRankManual(): Promise<boolean> {
  const config = await getConfigValue<{ manual: boolean }>('best_third_rank_is_manual', { manual: false });
  return config.manual === true;
}

function mapCandidateToRow(candidate: ThirdCandidate, globalRank: number, isAdvancing: boolean): BestThirdRow {
  return {
    globalRank,
    teamId: candidate.team_id,
    teamName: candidate.team.name_tr,
    groupCode: candidate.group_code,
    played: candidate.played,
    won: candidate.won,
    drawn: candidate.drawn,
    lost: candidate.lost,
    goalsFor: candidate.goals_for,
    goalDifference: candidate.goal_difference,
    points: candidate.points,
    isAdvancing,
  };
}

async function persistBestThirdRows(sorted: ThirdCandidate[], rankIsManual: boolean) {
  const { error: deleteError } = await supabase.from('best_third_rankings').delete().gte('team_id', 0);
  if (deleteError) throw deleteError;

  const rows = sorted.map((candidate, index) => ({
    team_id: candidate.team_id,
    global_rank: index + 1,
    is_advancing: index < BEST_THIRD_ADVANCING_COUNT,
    updated_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('best_third_rankings').insert(rows);
    if (insertError) throw insertError;
  }

  await setConfigValue('best_third_rank_is_manual', { manual: rankIsManual });
}

export async function clearBestThirdRankings(): Promise<void> {
  const { error } = await supabase.from('best_third_rankings').delete().gte('team_id', 0);
  if (error) throw error;
  await setConfigValue('best_third_rank_is_manual', { manual: false });
}

export async function computeBestThirdRankings(): Promise<void> {
  const ready = await allGroupsFinalized();
  if (!ready) {
    throw new Error('Tüm gruplar finalize edilmeden en iyi 3.ler hesaplanamaz');
  }

  const candidates = await loadThirdCandidates();
  if (candidates.length !== GROUP_CODES.length) {
    throw new Error(`12 grup üçüncüsü bekleniyor, ${candidates.length} bulundu`);
  }

  const sorted = sortThirdCandidates(candidates);
  await persistBestThirdRows(sorted, false);
}

export async function setBestThirdRankingsManually(teamIdsInRankOrder: number[]): Promise<void> {
  const ready = await allGroupsFinalized();
  if (!ready) {
    throw new Error('Tüm gruplar finalize edilmeden sıralama kaydedilemez');
  }

  const candidates = await loadThirdCandidates();
  const candidateIds = new Set(candidates.map((candidate) => candidate.team_id));

  if (teamIdsInRankOrder.length !== candidateIds.size) {
    throw new Error('Sıralamaya tüm grup üçüncüleri dahil edilmeli');
  }

  const uniqueIds = new Set(teamIdsInRankOrder);
  if (uniqueIds.size !== teamIdsInRankOrder.length) {
    throw new Error('Aynı takım birden fazla sırada olamaz');
  }

  for (const teamId of teamIdsInRankOrder) {
    if (!candidateIds.has(teamId)) {
      throw new Error('Geçersiz takım');
    }
  }

  const byId = new Map(candidates.map((candidate) => [candidate.team_id, candidate]));
  const sorted = teamIdsInRankOrder.map((teamId) => byId.get(teamId)!);
  await persistBestThirdRows(sorted, true);
}

export async function getBestThirdSummary(): Promise<BestThirdSummary> {
  const ready = await allGroupsFinalized();
  const rankIsManual = await isBestThirdRankManual();

  const [{ data: stored, error: storedError }, candidates] = await Promise.all([
    supabase.from('best_third_rankings').select('team_id, global_rank, is_advancing').order('global_rank'),
    ready ? loadThirdCandidates() : Promise.resolve([] as ThirdCandidate[]),
  ]);

  if (storedError) throw storedError;

  const isComputed = (stored ?? []).length > 0;
  if (!ready || !isComputed) {
    return {
      isReady: ready,
      isComputed,
      rankIsManual,
      advancingCount: 0,
      rows: [],
    };
  }

  const candidateMap = new Map(candidates.map((candidate) => [candidate.team_id, candidate]));
  const rows = (stored ?? []).map((row) => {
    const candidate = candidateMap.get(row.team_id);
    if (!candidate) {
      throw new Error('En iyi 3.ler tablosu güncel değil. Yeniden hesaplayın');
    }
    return mapCandidateToRow(candidate, row.global_rank, row.is_advancing);
  });

  return {
    isReady: ready,
    isComputed: true,
    rankIsManual,
    advancingCount: rows.filter((row) => row.isAdvancing).length,
    rows,
  };
}

export async function getBestThirdAdvancingTeamIds(): Promise<Set<number>> {
  const summary = await getBestThirdSummary();
  return new Set(summary.rows.filter((row) => row.isAdvancing).map((row) => row.teamId));
}

/**
 * Son 32'ye yükselen 32 takımın id'lerini döndürür (12 grup birincisi + 12 grup
 * ikincisi + en iyi 8 üçüncü). Tur atlama puanı yalnızca tüm Son 32 kesinleştikten
 * sonra topluca verildiği için, set yalnızca bütün gruplar finalize edildiğinde VE
 * en iyi 3.ler hesaplandığında dolu döner; aksi halde boş set döner.
 */
export async function getGroupStageAdvancingTeamIds(): Promise<Set<number>> {
  if (!(await allGroupsFinalized())) return new Set();

  const advancingThirds = await getBestThirdAdvancingTeamIds();
  if (advancingThirds.size === 0) return new Set();

  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('team_id, rank, is_finalized')
    .eq('is_finalized', true);

  if (error) throw error;

  const ids = new Set<number>();
  for (const standing of standings ?? []) {
    if (standing.rank === 1 || standing.rank === 2) {
      ids.add(standing.team_id);
    } else if (standing.rank === 3 && advancingThirds.has(standing.team_id)) {
      ids.add(standing.team_id);
    }
  }

  return ids;
}

export async function maybeAutoComputeBestThirdRankings(): Promise<boolean> {
  if (!(await allGroupsFinalized())) return false;
  if (await isBestThirdRankManual()) return false;

  await computeBestThirdRankings();
  return true;
}

export type QualificationStatus = 'group_winner' | 'group_runner_up' | 'best_third' | 'eliminated' | null;

export async function getTeamQualificationMap(): Promise<Map<number, QualificationStatus>> {
  const map = new Map<number, QualificationStatus>();
  const advancingThirds = await getBestThirdAdvancingTeamIds();
  const bestThirdsReady = advancingThirds.size > 0;

  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('team_id, rank, is_finalized')
    .eq('is_finalized', true);

  if (error) throw error;

  for (const standing of standings ?? []) {
    if (standing.rank === null) continue;

    if (standing.rank === 1) {
      map.set(standing.team_id, 'group_winner');
    } else if (standing.rank === 2) {
      map.set(standing.team_id, 'group_runner_up');
    } else if (standing.rank === 3) {
      if (!bestThirdsReady) {
        map.set(standing.team_id, null);
      } else {
        map.set(standing.team_id, advancingThirds.has(standing.team_id) ? 'best_third' : 'eliminated');
      }
    } else if (standing.rank === 4) {
      map.set(standing.team_id, 'eliminated');
    }
  }

  return map;
}

export function qualificationLabel(status: QualificationStatus): string | null {
  switch (status) {
    case 'group_winner':
      return 'Son 32 · Grup 1.';
    case 'group_runner_up':
      return 'Son 32 · Grup 2.';
    case 'best_third':
      return 'Son 32 · En iyi 3.';
    case 'eliminated':
      return 'Elendi';
    default:
      return null;
  }
}
