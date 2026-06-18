import type { MatchRow } from './types.js';

const GROUP_MATCH_NUMBER_RE = /(\d+)\.\s*Maç/u;

export function getGroupMatchNumber(roundLabel: string | null): number | null {
  if (!roundLabel) return null;
  const match = roundLabel.match(GROUP_MATCH_NUMBER_RE);
  return match ? Number(match[1]) : null;
}

export function isGroupFinalMatch(
  match: Pick<MatchRow, 'stage' | 'group_code' | 'round_label'>,
): boolean {
  if (match.stage !== 'group' || !match.group_code) return false;
  const matchNumber = getGroupMatchNumber(match.round_label);
  return matchNumber === 5 || matchNumber === 6;
}
