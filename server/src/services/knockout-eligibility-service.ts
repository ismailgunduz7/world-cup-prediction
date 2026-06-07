import { supabase } from '../lib/config.js';
import type { MatchStage } from '../lib/types.js';
import { getBestThirdAdvancingTeamIds, getBestThirdSummary } from './best-third-service.js';

const KNOCKOUT_PROGRESSION: MatchStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
];

export async function getRoundOf32Qualifiers(): Promise<number[]> {
  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('team_id, rank, is_finalized')
    .eq('is_finalized', true)
    .in('rank', [1, 2]);

  if (error) throw error;

  const direct = (standings ?? []).map((standing) => standing.team_id);
  const advancingThirds = [...(await getBestThirdAdvancingTeamIds())];
  return [...direct, ...advancingThirds];
}

async function removeLosersAtStage(active: Set<number>, stage: MatchStage) {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, winner_team_id, status')
    .eq('stage', stage)
    .eq('status', 'finished');

  if (error) throw error;

  for (const match of matches ?? []) {
    if (!match.winner_team_id) continue;
    const loser =
      match.winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;
    active.delete(loser);
  }
}

async function getSemiFinalLosers(): Promise<number[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('home_team_id, away_team_id, winner_team_id, status')
    .eq('stage', 'semi_final')
    .eq('status', 'finished');

  if (error) throw error;

  const losers: number[] = [];
  for (const match of matches ?? []) {
    if (!match.winner_team_id) continue;
    const loser =
      match.winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;
    losers.push(loser);
  }

  return losers;
}

export async function getEligibleTeamIdsForStage(stage: MatchStage): Promise<number[]> {
  if (stage === 'group') {
    const { data, error } = await supabase.from('teams').select('id').eq('is_active', true);
    if (error) throw error;
    return (data ?? []).map((team) => team.id);
  }

  if (stage === 'third_place') {
    return getSemiFinalLosers();
  }

  const qualifiers = await getRoundOf32Qualifiers();
  if (qualifiers.length < 32) {
    return [];
  }

  if (stage === 'round_of_32') {
    return qualifiers;
  }

  const active = new Set(qualifiers);
  for (const knockoutStage of KNOCKOUT_PROGRESSION) {
    if (knockoutStage === stage) break;
    await removeLosersAtStage(active, knockoutStage);
  }

  return [...active].sort((a, b) => a - b);
}

export async function getEligibleTeamsForStage(stage: MatchStage) {
  const teamIds = await getEligibleTeamIdsForStage(stage);
  if (teamIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('teams')
    .select('id, name_tr, group_code')
    .in('id', teamIds)
    .eq('is_active', true)
    .order('name_tr');

  if (error) throw error;
  return data ?? [];
}

export async function validateTeamsEligibleForStage(
  stage: MatchStage,
  homeTeamId: number,
  awayTeamId: number,
): Promise<string | null> {
  if (stage === 'group') return null;

  const eligible = new Set(await getEligibleTeamIdsForStage(stage));
  if (eligible.size === 0) {
    if (stage === 'round_of_32') {
      const summary = await getBestThirdSummary();
      if (!summary.isReady) {
        return 'Son 32 için önce tüm gruplar finalize edilmeli';
      }
      if (!summary.isComputed) {
        return 'Son 32 için önce en iyi 3.ler sıralaması belirlenmeli';
      }
    }
    return 'Bu tur için uygun takım bulunamadı';
  }

  if (!eligible.has(homeTeamId) || !eligible.has(awayTeamId)) {
    return 'Seçilen takımlardan biri bu tur için uygun değil (elenmiş veya gruptan çıkmış olabilir)';
  }

  return null;
}

export async function getRoundOf32QualifierCount(): Promise<number> {
  return (await getRoundOf32Qualifiers()).length;
}
