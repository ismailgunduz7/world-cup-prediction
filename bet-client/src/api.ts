// Turnuva bittikten sonra veri statiktir: bet özeti export edilmiş
// public/data/bet-progress.json dosyasından okunur (backend yok).
const BASE = import.meta.env.BASE_URL || '/';

export type BetProgressSpotlightMatch = {
  kind: 'live' | 'scheduled';
  scheduledAt: string;
  roundLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeCorners: number | null;
  awayCorners: number | null;
  homeYellowCards: number | null;
  awayYellowCards: number | null;
};

export type BetProgressSummary = {
  targets: { corners: number; yellowCards: number };
  totals: { corners: number; yellowCards: number };
  progress: { corners: number; yellowCards: number };
  spotlightMatch: BetProgressSpotlightMatch | null;
  finishedMatches: Array<{
    scheduledAt: string;
    roundLabel: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
    homeScore: number;
    awayScore: number;
    homeCorners: number | null;
    awayCorners: number | null;
    homeYellowCards: number | null;
    awayYellowCards: number | null;
  }>;
};

export async function fetchBetProgress(): Promise<BetProgressSummary> {
  const res = await fetch(`${BASE}data/bet-progress.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('Bet verisi bulunamadı');
  return (await res.json()) as BetProgressSummary;
}
