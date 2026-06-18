import type { MatchRow } from './types.js';

type ScoreFields = Pick<
  MatchRow,
  'home_score' | 'away_score' | 'home_score_aet' | 'away_score_aet'
>;

/**
 * Eleme maçlarında puan/sonuç esası skoru. Varsayılan (ayar kapalı) 90'
 * (home_score/away_score). Global `knockout_result_over_120` ayarı açıkken ve maç
 * uzatmaya gidildiyse (aet doldurulmuş) 120' (uzatma sonu) skoru esas alınır.
 * Kazanan/tur atlama bu skordan bağımsız (winner_team_id) belirlenir.
 */
export function pointsBasisScore(
  match: ScoreFields,
  knockoutResultOver120: boolean,
): { home: number | null; away: number | null } {
  const useExtraTime =
    knockoutResultOver120 && match.home_score_aet !== null && match.away_score_aet !== null;
  return useExtraTime
    ? { home: match.home_score_aet, away: match.away_score_aet }
    : { home: match.home_score, away: match.away_score };
}
