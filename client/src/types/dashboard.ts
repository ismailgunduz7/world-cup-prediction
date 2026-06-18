export type DashboardStatus = {
  selectionsLocked: boolean;
  tournamentStarted: boolean;
  selectionLockAt: string | null;
  tournamentStartAt: string | null;
};

export type DashboardMe = {
  rank: number | null;
  totalScore: number;
  playerCount: number;
  pointsToLeader: number | null;
  pointsToNext: number | null;
  hasSelections: boolean;
};

export type DashboardTeam = {
  teamId: number;
  name: string;
  groupCode: string;
  tierName: string;
  totalPoints: number;
  qualificationLabel: string | null;
  lastMatch: {
    matchId: number;
    opponent: string;
    score: string | null;
    result: 'win' | 'draw' | 'loss' | null;
    pointsEarned: number;
    playedAt: string;
    stageLabel: string;
  } | null;
  nextMatch: {
    matchId: number;
    opponent: string;
    scheduledAt: string;
    stageLabel: string;
  } | null;
};

export type DashboardUpcoming = {
  matchId: number;
  teamId: number;
  teamName: string;
  opponent: string;
  scheduledAt: string;
  stageLabel: string;
};

export type DashboardLiveMatch = {
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

export type DashboardLeaderSummary = {
  leaderName: string;
  leaderScore: number;
  isCurrentUserLeader: boolean;
  chaserName: string | null;
  chaserScore: number | null;
  leadOverChaser: number | null;
};

export type DashboardMiniLeaderboardEntry =
  | {
      isGap?: false;
      rank: number;
      displayName: string;
      totalScore: number;
      isCurrentUser: boolean;
    }
  | {
      isGap: true;
    };

export type DashboardActivity = {
  matchId: number;
  teamId: number;
  teamName: string;
  opponent: string;
  score: string | null;
  pointsEarned: number;
  playedAt: string;
  stageLabel: string;
  breakdown: Array<{ description: string; points: number }>;
};

export type DashboardGroupProgress = {
  code: string;
  isFinalized: boolean;
  standings: Array<{
    rank: number;
    teamId: number;
    teamName: string;
    played: number;
    points: number;
    goalDifference: number;
    qualificationLabel: string | null;
    isUserSelection: boolean;
  }>;
};

export type DashboardData = {
  status: DashboardStatus;
  me: DashboardMe;
  teams: DashboardTeam[];
  upcoming: DashboardUpcoming[];
  liveMatches: DashboardLiveMatch[];
  leaderSummary: DashboardLeaderSummary | null;
  miniLeaderboard: DashboardMiniLeaderboardEntry[];
  recentActivity: DashboardActivity[];
  groupProgress: DashboardGroupProgress[];
};

export type GuideTeam = {
  id: number;
  name: string;
  groupCode: string;
  tier: { id: number; name: string } | null;
};

export type GuideTier = { id: number; name: string };

export type GuideGroup = { code: string; teams: GuideTeam[] };
