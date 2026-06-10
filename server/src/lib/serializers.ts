/**
 * Shared serializers that turn raw DB rows into the FE-facing response shape.
 * Keeping these in one place avoids leaking column names (`name_tr`,
 * `description_tr`, …) and keeps the participant API in a single camelCase
 * vocabulary. See the plan/README for the full contract.
 */

export type PointEntryDTO = {
  description: string;
  points: number;
  ruleCode: string | null;
  ruleName: string | null;
};

type PointEntryRow = {
  description_tr: string;
  points: number | string;
  rule_type?: { code?: string | null; name_tr?: string | null } | null;
};

export function toPointEntry(row: PointEntryRow): PointEntryDTO {
  return {
    description: row.description_tr,
    points: Number(row.points),
    ruleCode: row.rule_type?.code ?? null,
    ruleName: row.rule_type?.name_tr ?? null,
  };
}

export type MatchSummaryDTO = {
  id: number;
  stage: string;
  status: string;
  scheduledAt: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  points: number;
  breakdown: PointEntryDTO[];
};

type MatchRow = {
  id: number;
  stage: string;
  status: string;
  scheduled_at: string;
  home_score: number | null;
  away_score: number | null;
  home_team?: { name_tr?: string | null } | null;
  away_team?: { name_tr?: string | null } | null;
};

/**
 * Maps a match row plus its point-entry breakdown into the FE shape. `points`
 * is the total the team earned from this match (sum of the breakdown).
 */
export function toMatchSummary(match: MatchRow, breakdown: PointEntryRow[]): MatchSummaryDTO {
  const entries = breakdown.map(toPointEntry);
  return {
    id: match.id,
    stage: match.stage,
    status: match.status,
    scheduledAt: match.scheduled_at,
    homeTeam: match.home_team?.name_tr ?? '—',
    awayTeam: match.away_team?.name_tr ?? '—',
    homeScore: match.home_score,
    awayScore: match.away_score,
    points: entries.reduce((sum, e) => sum + e.points, 0),
    breakdown: entries,
  };
}
