/** Shared leaderboard types and formatters used by the player leaderboards. */

export type LeaderboardSelection = {
  teamId: number;
  name: string;
  points: number;
  tierName: string | null;
  groupCode: string;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
};

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

export function teamSlots(
  entry: Pick<PlayerLeaderboardEntry, 'selections'>,
): Array<LeaderboardSelection | null> {
  const slots: Array<LeaderboardSelection | null> = [null, null, null];
  for (let i = 0; i < Math.min(3, entry.selections.length); i++) {
    slots[i] = entry.selections[i];
  }
  return slots;
}
