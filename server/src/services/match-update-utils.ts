import type { SupabaseClient } from '@supabase/supabase-js';
import type { MatchRow } from '../lib/types.js';

export const SINGLE_LIVE_MATCH_INDEX = 'idx_matches_single_live';
export const SINGLE_LIVE_MATCH_ERROR = 'Aynı anda yalnızca bir maç canlı olabilir';

type MatchUpdateInput = {
  homeScore: number;
  awayScore: number;
  status?: string;
};

export function isSingleLiveMatchViolation(
  error: { code?: string; message?: string; details?: string },
  options?: { settingLive?: boolean },
): boolean {
  if (error.code !== '23505') return false;

  const text = `${error.message ?? ''} ${error.details ?? ''}`;
  if (text.includes(SINGLE_LIVE_MATCH_INDEX)) return true;

  return options?.settingLive ?? false;
}

export async function findConflictingLiveMatch(
  supabase: SupabaseClient,
  excludeMatchId: number,
): Promise<{ id: number } | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'live')
    .neq('id', excludeMatchId)
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
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
