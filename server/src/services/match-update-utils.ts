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
  existing: Pick<MatchRow, 'home_score' | 'away_score' | 'status'>,
  update: MatchUpdateInput,
): boolean {
  const finalStatus = update.status ?? 'finished';
  const wasFinished = existing.status === 'finished';
  const isFinished = finalStatus === 'finished';
  const scoreChanged =
    existing.home_score !== update.homeScore || existing.away_score !== update.awayScore;
  const statusChanged = existing.status !== finalStatus;
  return (wasFinished || isFinished) && (scoreChanged || statusChanged);
}
