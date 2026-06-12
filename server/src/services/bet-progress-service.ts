import { supabase } from '../lib/config.js';

export type BetProgressConfigRow = {
  id: number;
  target_corners: number;
  target_yellow_cards: number;
  updated_at: string;
};

export type MatchBetStatsRow = {
  match_id: number;
  home_corners: number;
  away_corners: number;
  home_yellow_cards: number;
  away_yellow_cards: number;
  updated_at: string;
};

export type MatchBetStatsInput = {
  homeCorners: number;
  awayCorners: number;
  homeYellowCards: number;
  awayYellowCards: number;
};

export type BetProgressSummaryDTO = {
  targets: { corners: number; yellowCards: number };
  totals: { corners: number; yellowCards: number };
  progress: { corners: number; yellowCards: number };
  nextMatch: {
    scheduledAt: string;
    roundLabel: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  } | null;
  spotlightMatch: {
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
  } | null;
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

function progressPercent(total: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, (total / target) * 100);
}

type TeamNameJoin = { name_tr: string } | { name_tr: string }[] | null;

type FinishedMatchRow = {
  scheduled_at: string;
  round_label: string | null;
  home_score: number;
  away_score: number;
  home_team: TeamNameJoin;
  away_team: TeamNameJoin;
  match_bet_stats: MatchBetStatsRow | MatchBetStatsRow[] | null;
};

function resolveTeamName(team: TeamNameJoin): string | null {
  if (!team) return null;
  if (Array.isArray(team)) return team[0]?.name_tr ?? null;
  return team.name_tr;
}

function resolveBetStats(stats: MatchBetStatsRow | MatchBetStatsRow[] | null): MatchBetStatsRow | null {
  if (!stats) return null;
  if (Array.isArray(stats)) return stats[0] ?? null;
  return stats;
}

type SpotlightMatchRow = {
  scheduled_at: string;
  round_label: string | null;
  home_score: number | null;
  away_score: number | null;
  home_team: TeamNameJoin;
  away_team: TeamNameJoin;
  match_bet_stats: MatchBetStatsRow | MatchBetStatsRow[] | null;
};

const SPOTLIGHT_MATCH_SELECT =
  'scheduled_at, round_label, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr), match_bet_stats(home_corners, away_corners, home_yellow_cards, away_yellow_cards)';

function mapSpotlightMatch(match: SpotlightMatchRow, kind: 'live' | 'scheduled'): BetProgressSummaryDTO['spotlightMatch'] {
  const stats = resolveBetStats(match.match_bet_stats);

  return {
    kind,
    scheduledAt: match.scheduled_at,
    roundLabel: match.round_label,
    homeTeam: resolveTeamName(match.home_team),
    awayTeam: resolveTeamName(match.away_team),
    homeScore: match.home_score,
    awayScore: match.away_score,
    homeCorners: stats?.home_corners ?? null,
    awayCorners: stats?.away_corners ?? null,
    homeYellowCards: stats?.home_yellow_cards ?? null,
    awayYellowCards: stats?.away_yellow_cards ?? null,
  };
}

export async function getBetProgressConfig(): Promise<BetProgressConfigRow> {
  const { data, error } = await supabase.from('bet_progress_config').select('*').eq('id', 1).single();

  if (error) throw error;
  return data as BetProgressConfigRow;
}

export async function updateBetProgressConfig(targets: {
  targetCorners: number;
  targetYellowCards: number;
}): Promise<BetProgressConfigRow> {
  const { data, error } = await supabase
    .from('bet_progress_config')
    .update({
      target_corners: targets.targetCorners,
      target_yellow_cards: targets.targetYellowCards,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .single();

  if (error) throw error;
  return data as BetProgressConfigRow;
}

export async function upsertMatchBetStats(matchId: number, stats: MatchBetStatsInput): Promise<MatchBetStatsRow> {
  const { data, error } = await supabase
    .from('match_bet_stats')
    .upsert(
      {
        match_id: matchId,
        home_corners: stats.homeCorners,
        away_corners: stats.awayCorners,
        home_yellow_cards: stats.homeYellowCards,
        away_yellow_cards: stats.awayYellowCards,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'match_id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as MatchBetStatsRow;
}

export async function getBetProgressSummary(): Promise<BetProgressSummaryDTO> {
  const [config, finishedResult, liveResult, nextResult] = await Promise.all([
    getBetProgressConfig(),
    supabase
      .from('matches')
      .select(
        'scheduled_at, round_label, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr), match_bet_stats(home_corners, away_corners, home_yellow_cards, away_yellow_cards)',
      )
      .eq('status', 'finished')
      .order('scheduled_at', { ascending: false }),
    supabase
      .from('matches')
      .select(SPOTLIGHT_MATCH_SELECT)
      .eq('status', 'live')
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('matches')
      .select(SPOTLIGHT_MATCH_SELECT)
      .eq('status', 'scheduled')
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (finishedResult.error) throw finishedResult.error;
  if (liveResult.error) throw liveResult.error;
  if (nextResult.error) throw nextResult.error;

  let totalCorners = 0;
  let totalYellowCards = 0;

  const finishedMatches = ((finishedResult.data ?? []) as FinishedMatchRow[]).map((match) => {
    const stats = resolveBetStats(match.match_bet_stats);

    if (stats) {
      totalCorners += stats.home_corners + stats.away_corners;
      totalYellowCards += stats.home_yellow_cards + stats.away_yellow_cards;
    }

    return {
      scheduledAt: match.scheduled_at,
      roundLabel: match.round_label,
      homeTeam: resolveTeamName(match.home_team),
      awayTeam: resolveTeamName(match.away_team),
      homeScore: match.home_score,
      awayScore: match.away_score,
      homeCorners: stats?.home_corners ?? null,
      awayCorners: stats?.away_corners ?? null,
      homeYellowCards: stats?.home_yellow_cards ?? null,
      awayYellowCards: stats?.away_yellow_cards ?? null,
    };
  });

  const live = liveResult.data as SpotlightMatchRow | null;
  const next = nextResult.data as SpotlightMatchRow | null;
  const spotlightMatch = live
    ? mapSpotlightMatch(live, 'live')
    : next
      ? mapSpotlightMatch(next, 'scheduled')
      : null;

  return {
    targets: {
      corners: config.target_corners,
      yellowCards: config.target_yellow_cards,
    },
    totals: {
      corners: totalCorners,
      yellowCards: totalYellowCards,
    },
    progress: {
      corners: progressPercent(totalCorners, config.target_corners),
      yellowCards: progressPercent(totalYellowCards, config.target_yellow_cards),
    },
    nextMatch: spotlightMatch?.kind === 'scheduled'
      ? {
          scheduledAt: spotlightMatch.scheduledAt,
          roundLabel: spotlightMatch.roundLabel,
          homeTeam: spotlightMatch.homeTeam,
          awayTeam: spotlightMatch.awayTeam,
        }
      : null,
    spotlightMatch,
    finishedMatches,
  };
}
