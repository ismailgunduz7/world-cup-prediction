const GROUP_MATCH_NUMBER_RE = /(\d+)\.\s*Maç/u;

export function getGroupMatchNumber(roundLabel: string | null): number | null {
  if (!roundLabel) return null;
  const match = roundLabel.match(GROUP_MATCH_NUMBER_RE);
  return match ? Number(match[1]) : null;
}

export function isGroupFinalMatch(match: {
  stage: string;
  groupCode: string | null;
  roundLabel: string | null;
}): boolean {
  if (match.stage !== 'group' || !match.groupCode) return false;
  const matchNumber = getGroupMatchNumber(match.roundLabel);
  return matchNumber === 5 || matchNumber === 6;
}
