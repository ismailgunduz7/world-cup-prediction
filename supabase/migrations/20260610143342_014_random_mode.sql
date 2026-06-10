-- Random mode: an alternative game where each player is assigned 3 random teams
-- according to a chosen condition + tier filter. Scoring reuses team_total_points,
-- so this only stores the players' configuration and their assigned teams.

CREATE TABLE random_mode_entries (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  condition TEXT NOT NULL CHECK (condition IN ('fully_random', 'exclude_own', 'never_picked')),
  allowed_tiers SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
  is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  reroll_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE random_mode_entries IS 'Per-user random mode config (condition + tier filter), locked once triggered';

CREATE TABLE random_mode_teams (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 3),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slot),
  UNIQUE (user_id, team_id)
);

CREATE INDEX idx_random_mode_teams_user_id ON random_mode_teams(user_id);

-- Atomic trigger: writes the locked config + the 3 assigned teams in one shot.
-- Mirrors set_team_selections (013): pool computation stays in the API, but the
-- write is wrapped so a failure can't leave a half-populated entry.
CREATE OR REPLACE FUNCTION trigger_random_selection(
  p_user_id UUID,
  p_condition TEXT,
  p_tiers SMALLINT[],
  p_team_ids INT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO random_mode_entries (user_id, condition, allowed_tiers, is_triggered, reroll_used, updated_at)
  VALUES (p_user_id, p_condition, p_tiers, TRUE, FALSE, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET condition = EXCLUDED.condition,
        allowed_tiers = EXCLUDED.allowed_tiers,
        is_triggered = TRUE,
        reroll_used = FALSE,
        updated_at = NOW();

  DELETE FROM random_mode_teams WHERE user_id = p_user_id;

  INSERT INTO random_mode_teams (user_id, team_id, slot)
  SELECT p_user_id, team_id, ordinality::SMALLINT
  FROM unnest(p_team_ids) WITH ORDINALITY AS t(team_id, ordinality);
END;
$$;

-- Atomic reroll: replaces a single slot's team and marks the reroll as used.
CREATE OR REPLACE FUNCTION reroll_random_selection(
  p_user_id UUID,
  p_slot SMALLINT,
  p_new_team_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE random_mode_teams
    SET team_id = p_new_team_id, selected_at = NOW()
    WHERE user_id = p_user_id AND slot = p_slot;

  UPDATE random_mode_entries
    SET reroll_used = TRUE, updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;

-- Global feature flag so admins can enable/disable random mode site-wide.
INSERT INTO tournament_config (key, value)
VALUES ('random_mode', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;
