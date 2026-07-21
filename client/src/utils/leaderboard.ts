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
  /** Opak oyuncu kimliği (username sızdırmadan link için). */
  slug: string;
  displayName: string;
  totalScore: number;
  hasSelections: boolean;
  selections: LeaderboardSelection[];
};

/** Bir takımı seçen oyuncular, yarışma bazında gruplanmış. */
export type SelectorGroup = { competitionName: string; players: string[] };

export type CompetitionLeaderboard = {
  id: string;
  name: string;
  randomModeEnabled: boolean;
  entries: PlayerLeaderboardEntry[];
  randomEntries: PlayerLeaderboardEntry[];
};

/**
 * Verilen takımı seçen oyuncuları yarışma bazında gruplar. `source` gerçek
 * seçimleri (`real`) veya rastgele atamaları (`random`) hedefler. Boş yarışmalar
 * atlanır.
 */
export function teamSelectorGroups(
  competitions: CompetitionLeaderboard[],
  teamId: number,
  source: 'real' | 'random',
): SelectorGroup[] {
  const groups: SelectorGroup[] = [];
  for (const comp of competitions) {
    const entries = source === 'random' ? comp.randomEntries : comp.entries;
    const players = entries
      .filter((e) => e.selections.some((s) => s.teamId === teamId))
      .map((e) => e.displayName);
    if (players.length) groups.push({ competitionName: comp.name, players });
  }
  return groups;
}

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
