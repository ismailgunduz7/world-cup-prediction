/** Shared leaderboard types and formatters used by the player leaderboards. */

export type LeaderboardSelection = { name: string; points: number };

export type PlayerLeaderboardEntry = {
  rank: number;
  username: string;
  displayName: string;
  totalScore: number;
  isCurrentUser: boolean;
  hasSelections: boolean;
  selections: LeaderboardSelection[];
};

/** Medal emoji for the top 3, otherwise the plain rank number. */
export function rankLabel(rank: number): string | number {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

/**
 * Comma-separated "Team (Np)" summary of a player's picks, or `emptyLabel`
 * when the player has none. The label differs by mode (real picks vs. random
 * assignment), so it is passed in by the caller.
 */
export function formatSelections(
  entry: Pick<PlayerLeaderboardEntry, 'hasSelections' | 'selections'>,
  emptyLabel: string,
): string {
  if (!entry.hasSelections) return emptyLabel;
  return entry.selections.map((s) => `${s.name} (${s.points}p)`).join(', ');
}
