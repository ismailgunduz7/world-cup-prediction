-- Competitions: admin-managed player groups for running the same tournament with
-- isolated sets of players. Each user may belong to at most one competition;
-- players only ever see other players within their own competition. Random mode
-- is toggled per competition (the previous global random_mode flag is retired).

CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,            -- short slug, e.g. "aile", "arkadas", "ofis"
  name TEXT NOT NULL,                  -- admin-facing label
  random_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE competitions IS 'Admin-managed player groups; isolates which players see each other';

ALTER TABLE users
  ADD COLUMN competition_id UUID REFERENCES competitions(id) ON DELETE SET NULL;

CREATE INDEX idx_users_competition_id ON users(competition_id);

-- Random mode is now per-competition; drop the retired global feature flag.
DELETE FROM tournament_config WHERE key = 'random_mode';
