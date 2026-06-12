import axios from 'axios';

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

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
  const { data } = await api.get<BetProgressSummary>('/bet-progress');
  return data;
}
