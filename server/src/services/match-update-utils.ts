import type { MatchRow } from '../lib/types.js';

type MatchUpdateInput = {
  homeScore: number;
  awayScore: number;
  status?: string;
};

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
