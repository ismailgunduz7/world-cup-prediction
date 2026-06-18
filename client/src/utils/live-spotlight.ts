import { isGroupFinalMatch } from '@/utils/match-round';

export type SpotlightMatch = {
  id: number;
  stage: string;
  stageLabel: string;
  groupCode: string | null;
  roundLabel: string | null;
  status: string;
  scheduledAt: string;
  homeTeam: { id: number | null; name: string };
  awayTeam: { id: number | null; name: string };
  homeScore: number | null;
  awayScore: number | null;
  homeScoreAet: number | null;
  awayScoreAet: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
};

export type LiveSpotlightGroup =
  | { kind: 'single'; match: SpotlightMatch }
  | { kind: 'group-final'; groupCode: string; matches: SpotlightMatch[] };

export function buildLiveSpotlightGroups(matches: SpotlightMatch[]): LiveSpotlightGroup[] {
  const liveMatches = matches
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const groupFinalByCode = new Map<string, SpotlightMatch[]>();
  const singles: SpotlightMatch[] = [];

  for (const match of liveMatches) {
    if (isGroupFinalMatch(match)) {
      const code = match.groupCode!;
      const list = groupFinalByCode.get(code) ?? [];
      list.push(match);
      groupFinalByCode.set(code, list);
      continue;
    }
    singles.push(match);
  }

  const groups: LiveSpotlightGroup[] = singles.map((match) => ({ kind: 'single', match }));

  for (const [groupCode, groupMatches] of groupFinalByCode) {
    const sorted = [...groupMatches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    if (sorted.length >= 2) {
      groups.push({ kind: 'group-final', groupCode, matches: sorted });
    } else {
      groups.push({ kind: 'single', match: sorted[0] });
    }
  }

  return groups.sort((a, b) => {
    const aTime = a.kind === 'single' ? a.match.scheduledAt : a.matches[0].scheduledAt;
    const bTime = b.kind === 'single' ? b.match.scheduledAt : b.matches[0].scheduledAt;
    return aTime.localeCompare(bTime);
  });
}
