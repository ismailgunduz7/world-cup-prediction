import { supabase } from '../lib/config.js';
import { buildRankContext, sortAndRankEntries } from '../lib/rank-summary.js';
import { buildRandomModeLeaderboard } from './leaderboard-service.js';

/**
 * Whether random mode is enabled for a given competition. Random mode is now a
 * per-competition toggle (`competitions.random_mode_enabled`). Users not
 * assigned to any competition can never use random mode.
 */
export async function isRandomModeEnabledForUser(competitionId: string | null): Promise<boolean> {
  if (!competitionId) return false;

  const { data, error } = await supabase
    .from('competitions')
    .select('random_mode_enabled')
    .eq('id', competitionId)
    .maybeSingle();

  if (error) throw error;
  return data?.random_mode_enabled === true;
}

export async function buildRandomModeRankContext(
  competitionId: string | null,
  userId: string,
) {
  if (!competitionId) return null;
  if (!(await isRandomModeEnabledForUser(competitionId))) return null;

  const { data: entry, error } = await supabase
    .from('random_mode_entries')
    .select('is_triggered')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!entry?.is_triggered) return null;

  const leaderboard = await buildRandomModeLeaderboard(competitionId, userId);
  const ranked = sortAndRankEntries(
    leaderboard
      .filter((e) => e.hasSelections)
      .map((e) => ({
        displayName: e.displayName,
        totalScore: e.totalScore,
        isCurrentUser: e.isCurrentUser,
        hasSelections: e.hasSelections,
      })),
  );

  return buildRankContext(ranked, userId, true);
}
