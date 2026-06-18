import type { SupabaseClient } from '@supabase/supabase-js';
import { isGroupFinalMatch } from '../lib/match-round.js';
import type { MatchRow } from '../lib/types.js';

export const LIVE_MATCH_CONSTRAINT_PREFIX = 'matches_live_constraint';
export const SINGLE_LIVE_MATCH_ERROR = 'Aynı anda yalnızca bir maç canlı olabilir';
export const GROUP_FINAL_LIVE_LIMIT_ERROR = 'Bu grupta aynı anda en fazla iki maç canlı olabilir';

type LiveMatchCandidate = Pick<MatchRow, 'id' | 'stage' | 'group_code' | 'round_label'>;

type MatchUpdateInput = {
  homeScore: number;
  awayScore: number;
  homeScoreAet?: number | null;
  awayScoreAet?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  status?: string;
};

export function isLiveMatchConstraintViolation(
  error: { code?: string; message?: string; details?: string },
  options?: { settingLive?: boolean },
): boolean {
  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  if (text.includes(LIVE_MATCH_CONSTRAINT_PREFIX)) return true;

  if (error.code === '23505' && options?.settingLive) return true;

  return false;
}

export function mapLiveMatchConstraintError(message: string): string {
  if (message.includes('group_final_live_limit')) return GROUP_FINAL_LIVE_LIMIT_ERROR;
  return SINGLE_LIVE_MATCH_ERROR;
}

export function validateLiveMatchTransition(
  target: LiveMatchCandidate,
  otherLiveMatches: LiveMatchCandidate[],
): string | null {
  if (!otherLiveMatches.length) return null;

  const targetIsGroupFinal = isGroupFinalMatch(target);

  if (!targetIsGroupFinal) {
    return SINGLE_LIVE_MATCH_ERROR;
  }

  for (const other of otherLiveMatches) {
    if (!isGroupFinalMatch(other)) {
      return SINGLE_LIVE_MATCH_ERROR;
    }
    if (other.group_code !== target.group_code) {
      return SINGLE_LIVE_MATCH_ERROR;
    }
  }

  const sameGroupFinalCount = otherLiveMatches.filter(
    (other) => isGroupFinalMatch(other) && other.group_code === target.group_code,
  ).length;

  if (sameGroupFinalCount >= 2) {
    return GROUP_FINAL_LIVE_LIMIT_ERROR;
  }

  return null;
}

export async function findLiveMatchConstraintError(
  supabase: SupabaseClient,
  target: LiveMatchCandidate,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, stage, group_code, round_label')
    .eq('status', 'live')
    .neq('id', target.id);

  if (error) throw error;
  return validateLiveMatchTransition(target, data ?? []);
}

export function matchUpdateAffectsScoring(
  existing: Pick<
    MatchRow,
    | 'home_score'
    | 'away_score'
    | 'home_score_aet'
    | 'away_score_aet'
    | 'home_penalties'
    | 'away_penalties'
    | 'status'
  >,
  update: MatchUpdateInput,
): boolean {
  const finalStatus = update.status ?? 'finished';
  const wasFinished = existing.status === 'finished';
  const isFinished = finalStatus === 'finished';
  // 90' skoru aynı kalsa bile uzatma/penaltı sonucu (dolayısıyla kazanan ve ayar
  // aktifken gol/sonuç puanı) değişebilir; bu yüzden ET/penaltı alanlarını da karşılaştır.
  const scoreChanged =
    existing.home_score !== update.homeScore ||
    existing.away_score !== update.awayScore ||
    existing.home_score_aet !== (update.homeScoreAet ?? null) ||
    existing.away_score_aet !== (update.awayScoreAet ?? null) ||
    existing.home_penalties !== (update.homePenalties ?? null) ||
    existing.away_penalties !== (update.awayPenalties ?? null);
  const statusChanged = existing.status !== finalStatus;
  return (wasFinished || isFinished) && (scoreChanged || statusChanged);
}
