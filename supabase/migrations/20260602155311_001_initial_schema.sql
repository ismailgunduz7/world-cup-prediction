-- Core schema: users, auth tokens, tournament config

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

CREATE TABLE tournament_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tournament_config IS 'Dynamic tournament settings such as selection lock time and scoring flags';

CREATE TABLE tiers (
  id SMALLINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_tr TEXT NOT NULL,
  sort_order SMALLINT NOT NULL
);

CREATE TABLE scoring_rule_types (
  id SMALLINT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_tr TEXT NOT NULL,
  description_tr TEXT,
  category TEXT NOT NULL CHECK (category IN ('match', 'group', 'knockout', 'medal')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE tier_scoring_rules (
  id SERIAL PRIMARY KEY,
  rule_type_id SMALLINT NOT NULL REFERENCES scoring_rule_types(id) ON DELETE CASCADE,
  tier_id SMALLINT NOT NULL REFERENCES tiers(id) ON DELETE CASCADE,
  points NUMERIC(6, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (rule_type_id, tier_id)
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name_tr TEXT NOT NULL UNIQUE,
  tier_id SMALLINT NOT NULL REFERENCES tiers(id),
  group_code CHAR(1) NOT NULL CHECK (group_code BETWEEN 'A' AND 'L'),
  fifa_code TEXT,
  external_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_teams_tier_id ON teams(tier_id);
CREATE INDEX idx_teams_group_code ON teams(group_code);

CREATE TYPE match_stage AS ENUM (
  'group',
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'third_place',
  'final'
);

CREATE TYPE match_status AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');

CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  external_id TEXT UNIQUE,
  home_team_id INT NOT NULL REFERENCES teams(id),
  away_team_id INT NOT NULL REFERENCES teams(id),
  stage match_stage NOT NULL DEFAULT 'group',
  group_code CHAR(1),
  round_label TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status match_status NOT NULL DEFAULT 'scheduled',
  home_score SMALLINT,
  away_score SMALLINT,
  winner_team_id INT REFERENCES teams(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (home_team_id <> away_team_id)
);

CREATE INDEX idx_matches_scheduled_at ON matches(scheduled_at);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_home_team ON matches(home_team_id);
CREATE INDEX idx_matches_away_team ON matches(away_team_id);

CREATE TABLE group_standings (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  group_code CHAR(1) NOT NULL,
  played SMALLINT NOT NULL DEFAULT 0,
  won SMALLINT NOT NULL DEFAULT 0,
  drawn SMALLINT NOT NULL DEFAULT 0,
  lost SMALLINT NOT NULL DEFAULT 0,
  goals_for SMALLINT NOT NULL DEFAULT 0,
  goals_against SMALLINT NOT NULL DEFAULT 0,
  goal_difference SMALLINT NOT NULL DEFAULT 0,
  points SMALLINT NOT NULL DEFAULT 0,
  rank SMALLINT,
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_selections (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, team_id)
);

CREATE INDEX idx_team_selections_user_id ON team_selections(user_id);

CREATE TABLE team_point_entries (
  id BIGSERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rule_type_id SMALLINT NOT NULL REFERENCES scoring_rule_types(id),
  match_id INT REFERENCES matches(id) ON DELETE SET NULL,
  source_key TEXT NOT NULL,
  points NUMERIC(6, 2) NOT NULL,
  description_tr TEXT NOT NULL,
  earned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, source_key)
);

CREATE INDEX idx_team_point_entries_team_id ON team_point_entries(team_id);
CREATE INDEX idx_team_point_entries_match_id ON team_point_entries(match_id);

CREATE TABLE knockout_advancements (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage match_stage NOT NULL,
  match_id INT REFERENCES matches(id) ON DELETE SET NULL,
  source_key TEXT NOT NULL UNIQUE,
  advanced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, stage)
);

CREATE VIEW team_total_points AS
SELECT
  team_id,
  COALESCE(SUM(points), 0)::NUMERIC(6, 2) AS total_points
FROM team_point_entries
GROUP BY team_id;
