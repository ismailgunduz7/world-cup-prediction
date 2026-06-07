export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  is_admin: boolean;
  created_at: string;
};

export type TierRow = {
  id: number;
  code: string;
  name_tr: string;
  sort_order: number;
};

export type TeamRow = {
  id: number;
  name_tr: string;
  tier_id: number;
  group_code: string;
  fifa_code: string | null;
  external_id: string | null;
  is_active: boolean;
};

export type ScoringRuleTypeRow = {
  id: number;
  code: string;
  name_tr: string;
  description_tr: string | null;
  category: 'match' | 'group' | 'knockout' | 'medal';
  is_active: boolean;
  sort_order: number;
};

export type TierScoringRuleRow = {
  id: number;
  rule_type_id: number;
  tier_id: number;
  points: number;
  is_active: boolean;
};

export type MatchRow = {
  id: number;
  external_id: string | null;
  home_team_id: number | null;
  away_team_id: number | null;
  stage: MatchStage;
  group_code: string | null;
  round_label: string | null;
  scheduled_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: number | null;
  bracket_match_number: number | null;
  home_slot: string | null;
  away_slot: string | null;
};

export type MatchStage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'third_place'
  | 'final';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export type TeamPointEntryRow = {
  id: number;
  team_id: number;
  rule_type_id: number;
  match_id: number | null;
  source_key: string;
  points: number;
  description_tr: string;
  earned_at: string | null;
  created_at: string;
};

export type TeamSelectionRow = {
  id: number;
  user_id: string;
  team_id: number;
  selected_at: string;
};

export type GroupStandingRow = {
  id: number;
  team_id: number;
  group_code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  rank: number | null;
  is_finalized: boolean;
  rank_is_manual: boolean;
};

export type TournamentConfigRow = {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
};

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  isAdmin: boolean;
};

export type TeamWithTier = TeamRow & {
  tier: TierRow;
  total_points?: number;
};

export type MatchWithTeams = MatchRow & {
  home_team: Pick<TeamRow, 'id' | 'name_tr' | 'tier_id' | 'group_code'>;
  away_team: Pick<TeamRow, 'id' | 'name_tr' | 'tier_id' | 'group_code'>;
};

export type PointEntryWithRule = TeamPointEntryRow & {
  rule_type: Pick<ScoringRuleTypeRow, 'code' | 'name_tr' | 'category'>;
  tier_code?: string;
};
