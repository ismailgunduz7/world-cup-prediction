export type RankMe = {
  rank: number | null;
  totalScore: number;
  playerCount: number;
  pointsToLeader: number | null;
  pointsToNext: number | null;
  hasSelections: boolean;
};

export type LeaderSummary = {
  leaderName: string;
  leaderScore: number;
  isCurrentUserLeader: boolean;
  chaserName: string | null;
  chaserScore: number | null;
  leadOverChaser: number | null;
};

type RankedEntry = {
  userId?: string;
  displayName: string;
  totalScore: number;
  rank: number;
  isCurrentUser?: boolean;
  hasSelections?: boolean;
};

function isEntryForUser(entry: RankedEntry, userId: string) {
  if (entry.userId) return entry.userId === userId;
  return entry.isCurrentUser === true;
}

export function buildLeaderSummary(entries: RankedEntry[], userId: string): LeaderSummary | null {
  if (entries.length === 0) return null;
  const leader = entries[0];
  const chaser = entries.length > 1 ? entries[1] : null;
  return {
    leaderName: leader.displayName,
    leaderScore: leader.totalScore,
    isCurrentUserLeader: isEntryForUser(leader, userId),
    chaserName: chaser?.displayName ?? null,
    chaserScore: chaser?.totalScore ?? null,
    leadOverChaser: chaser ? Math.max(0, leader.totalScore - chaser.totalScore) : null,
  };
}

export function buildRankMe(entries: RankedEntry[], userId: string, hasSelections: boolean): RankMe {
  const meEntry = entries.find((e) => isEntryForUser(e, userId));
  const leaderEntry = entries[0] ?? null;
  const aboveEntry =
    meEntry && meEntry.rank > 1
      ? entries.find((e) => e.rank === meEntry.rank - 1) ?? null
      : null;

  return {
    rank: meEntry?.rank ?? null,
    totalScore: meEntry?.totalScore ?? 0,
    playerCount: entries.length,
    pointsToLeader:
      leaderEntry && meEntry ? Math.max(0, leaderEntry.totalScore - meEntry.totalScore) : null,
    pointsToNext: aboveEntry && meEntry ? Math.max(0, aboveEntry.totalScore - meEntry.totalScore) : null,
    hasSelections,
  };
}

export function buildRankContext(
  entries: RankedEntry[],
  userId: string,
  hasSelections: boolean,
): { me: RankMe; leaderSummary: LeaderSummary | null } | null {
  if (entries.length === 0) return null;
  return {
    me: buildRankMe(entries, userId, hasSelections),
    leaderSummary: buildLeaderSummary(entries, userId),
  };
}

export function sortAndRankEntries<T extends Omit<RankedEntry, 'rank'>>(
  entries: T[],
): Array<T & { rank: number }> {
  const sorted = [...entries].sort(
    (a, b) =>
      b.totalScore - a.totalScore || a.displayName.localeCompare(b.displayName, 'tr'),
  );
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
