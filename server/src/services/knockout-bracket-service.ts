import { supabase } from '../lib/config.js';
import type { MatchRow } from '../lib/types.js';
import {
  WC2026_KNOCKOUT_BRACKET,
  type BracketSlot,
  type ThirdPlaceWinnerSlot,
} from '../data/wc2026-knockout-bracket.js';
import { allGroupsFinalized, getBestThirdSummary } from './best-third-service.js';
import { getCombinationNumber, lookupThirdPlaceAssignments } from './third-place-combinations.js';

type QualifierContext = {
  winners: Map<string, number>;
  runnersUp: Map<string, number>;
  thirds: Map<string, number>;
  thirdAssignments: Record<ThirdPlaceWinnerSlot, string>;
  advancingThirdGroups: string[];
};

async function loadQualifierContext(): Promise<QualifierContext> {
  const ready = await allGroupsFinalized();
  if (!ready) {
    throw new Error('Tüm gruplar finalize edilmeden turnuva ağacı oluşturulamaz');
  }

  const bestThirdSummary = await getBestThirdSummary();
  if (!bestThirdSummary.isComputed) {
    throw new Error('En iyi 3.ler sıralaması belirlenmeden turnuva ağacı oluşturulamaz');
  }

  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('team_id, group_code, rank, is_finalized')
    .eq('is_finalized', true);

  if (error) throw error;

  const winners = new Map<string, number>();
  const runnersUp = new Map<string, number>();
  const thirds = new Map<string, number>();

  for (const standing of standings ?? []) {
    if (standing.rank === 1) winners.set(standing.group_code, standing.team_id);
    if (standing.rank === 2) runnersUp.set(standing.group_code, standing.team_id);
    if (standing.rank === 3) thirds.set(standing.group_code, standing.team_id);
  }

  const advancingThirdGroups = bestThirdSummary.rows
    .filter((row) => row.isAdvancing)
    .map((row) => row.groupCode);

  const thirdAssignments = lookupThirdPlaceAssignments(advancingThirdGroups);

  return { winners, runnersUp, thirds, thirdAssignments, advancingThirdGroups };
}

function resolveSlot(slot: BracketSlot, context: QualifierContext): number | null {
  if (/^W\d+$/.test(slot)) {
    return null;
  }

  if (/^L\d+$/.test(slot)) {
    return null;
  }

  if (slot.startsWith('3@')) {
    const winnerSlot = slot.slice(2) as ThirdPlaceWinnerSlot;
    const thirdGroup = context.thirdAssignments[winnerSlot];
    return context.thirds.get(thirdGroup) ?? null;
  }

  const rank = Number(slot[0]) as 1 | 2;
  const group = slot[1];
  if (rank === 1) return context.winners.get(group) ?? null;
  return context.runnersUp.get(group) ?? null;
}

export async function hasKnockoutBracket(): Promise<boolean> {
  const { count, error } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .not('bracket_match_number', 'is', null);

  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function generateKnockoutBracket(): Promise<{
  created: number;
  combinationNo: number;
}> {
  const context = await loadQualifierContext();
  const combinationNo = getCombinationNumber(context.advancingThirdGroups);

  const existing = await hasKnockoutBracket();
  if (existing) {
    throw new Error('Turnuva ağacı zaten oluşturulmuş. Önce mevcut eleme maçlarını silin.');
  }

  const rows = WC2026_KNOCKOUT_BRACKET.map((template) => ({
    external_id: template.externalId,
    home_team_id: resolveSlot(template.homeSlot, context),
    away_team_id: resolveSlot(template.awaySlot, context),
    stage: template.stage,
    group_code: null,
    round_label: template.roundLabel,
    scheduled_at: template.scheduledAt,
    status: 'scheduled' as const,
    bracket_match_number: template.number,
    home_slot: template.homeSlot,
    away_slot: template.awaySlot,
  }));

  const { error } = await supabase.from('matches').insert(rows);
  if (error) throw error;

  return { created: rows.length, combinationNo };
}

export async function syncKnockoutRoundOf32(): Promise<{
  updated: number;
  reset: number;
  combinationNo: number;
}> {
  const context = await loadQualifierContext();
  const combinationNo = getCombinationNumber(context.advancingThirdGroups);

  const { data: r32Matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'round_of_32')
    .not('bracket_match_number', 'is', null)
    .order('bracket_match_number');

  if (error) throw error;
  if (!r32Matches?.length) {
    throw new Error('Son 32 maçları bulunamadı');
  }

  let updated = 0;
  let reset = 0;

  for (const match of r32Matches as MatchRow[]) {
    const homeTeamId = resolveSlot(match.home_slot as BracketSlot, context);
    const awayTeamId = resolveSlot(match.away_slot as BracketSlot, context);
    const teamsMismatch =
      match.home_team_id !== homeTeamId || match.away_team_id !== awayTeamId;

    if (!teamsMismatch) {
      continue;
    }

    if (match.status === 'finished' && match.bracket_match_number) {
      reset += await cascadeClearBracketSlot(`W${match.bracket_match_number}` as BracketSlot);
      reset += await cascadeClearBracketSlot(`L${match.bracket_match_number}` as BracketSlot);
    }

    const { error: updateError } = await supabase
      .from('matches')
      .update({
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        home_score: null,
        away_score: null,
        winner_team_id: null,
        status: 'scheduled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id);

    if (updateError) throw updateError;

    updated += 1;
    if (match.status === 'finished') {
      reset += 1;
    }
  }

  return { updated, reset, combinationNo };
}

export async function regenerateKnockoutRoundOf32(): Promise<{ updated: number; combinationNo: number }> {
  const result = await syncKnockoutRoundOf32();
  return { updated: result.updated, combinationNo: result.combinationNo };
}

async function cascadeClearBracketSlot(slot: BracketSlot, visited = new Set<string>()): Promise<number> {
  if (visited.has(slot)) return 0;
  visited.add(slot);

  let resetCount = 0;
  const dependents = await findBracketMatchesReferencingSlot(slot);

  for (const dep of dependents) {
    const touchesHome = dep.home_slot === slot;
    const touchesAway = dep.away_slot === slot;
    if (!touchesHome && !touchesAway) continue;

    const wasFinished = dep.status === 'finished';
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (touchesHome) updates.home_team_id = null;
    if (touchesAway) updates.away_team_id = null;

    if (wasFinished) {
      updates.home_score = null;
      updates.away_score = null;
      updates.winner_team_id = null;
      updates.status = 'scheduled';
      resetCount += 1;
    }

    const { error } = await supabase.from('matches').update(updates).eq('id', dep.id);
    if (error) throw error;

    if (wasFinished && dep.bracket_match_number) {
      resetCount += await cascadeClearBracketSlot(`W${dep.bracket_match_number}` as BracketSlot, visited);
      resetCount += await cascadeClearBracketSlot(`L${dep.bracket_match_number}` as BracketSlot, visited);
    }
  }

  return resetCount;
}

export async function maybeSyncKnockoutRoundOf32(): Promise<boolean> {
  if (!(await hasKnockoutBracket())) return false;
  await syncKnockoutRoundOf32();
  return true;
}

async function findBracketMatchesReferencingSlot(slot: BracketSlot) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`home_slot.eq.${slot},away_slot.eq.${slot}`);

  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

export async function syncBracketFromMatchResult(match: MatchRow): Promise<void> {
  if (!match.bracket_match_number || match.status !== 'finished') return;

  const winnerId = match.winner_team_id;
  if (!winnerId) return;

  const loserId =
    match.winner_team_id === match.home_team_id ? match.away_team_id : match.home_team_id;

  const winnerSlot = `W${match.bracket_match_number}` as BracketSlot;
  const loserSlot = `L${match.bracket_match_number}` as BracketSlot;

  await assignTeamToSlot(winnerSlot, winnerId);
  if (loserId) {
    await assignTeamToSlot(loserSlot, loserId);
  }
}

async function assignTeamToSlot(slot: BracketSlot, teamId: number) {
  const matches = await findBracketMatchesReferencingSlot(slot);

  for (const target of matches) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (target.home_slot === slot) {
      updates.home_team_id = teamId;
    }
    if (target.away_slot === slot) {
      updates.away_team_id = teamId;
    }

    if (Object.keys(updates).length <= 1) continue;

    const { error } = await supabase.from('matches').update(updates).eq('id', target.id);
    if (error) throw error;
  }
}

export async function maybeGenerateKnockoutBracket(): Promise<boolean> {
  if (await hasKnockoutBracket()) return false;
  if (!(await allGroupsFinalized())) return false;

  const bestThirdSummary = await getBestThirdSummary();
  if (!bestThirdSummary.isComputed) return false;

  await generateKnockoutBracket();
  return true;
}
