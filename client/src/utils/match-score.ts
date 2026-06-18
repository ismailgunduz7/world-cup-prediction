// Eleme maçlarında uzatma/penaltı sonucunu gösterim için biçimlendirir.
// Puanlama her zaman 90' (homeScore/awayScore) üzerinden yapılır; bu yardımcılar
// yalnızca sahadaki gerçek skoru ve etiketi göstermek içindir.

export type MatchScoreFields = {
  homeScore: number | null;
  awayScore: number | null;
  homeScoreAet?: number | null;
  awayScoreAet?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
};

function hasAet(m: MatchScoreFields): boolean {
  return m.homeScoreAet != null && m.awayScoreAet != null;
}

function hasPenalties(m: MatchScoreFields): boolean {
  return m.homePenalties != null && m.awayPenalties != null;
}

/** Sahadaki gerçek skor çifti: uzatmaya gidildiyse 120' skoru, aksi halde 90'. */
export function effectiveScorePair(m: MatchScoreFields): { home: number; away: number } | null {
  if (m.homeScore === null || m.awayScore === null) return null;
  if (hasAet(m)) return { home: m.homeScoreAet as number, away: m.awayScoreAet as number };
  return { home: m.homeScore, away: m.awayScore };
}

/** "uzt." / "uzt., pen 5-4" gibi etiket; uzatma/penaltı yoksa boş string. */
export function scoreAnnotation(m: MatchScoreFields): string {
  const parts: string[] = [];
  if (hasAet(m)) parts.push('uzt.');
  if (hasPenalties(m)) parts.push(`pen ${m.homePenalties}-${m.awayPenalties}`);
  return parts.join(', ');
}

/**
 * Tek satırlık skor metni, örn. "1 - 0", "3 - 2 (uzt.)", "1 - 1 (uzt.), pen 5-4".
 * Skor yoksa `placeholder` döner.
 */
export function formatMatchScore(
  m: MatchScoreFields,
  options: { separator?: string; placeholder?: string } = {},
): string {
  const { separator = ' - ', placeholder = '– : –' } = options;
  const pair = effectiveScorePair(m);
  if (!pair) return placeholder;
  const note = scoreAnnotation(m);
  return `${pair.home}${separator}${pair.away}${note ? ` (${note})` : ''}`;
}
