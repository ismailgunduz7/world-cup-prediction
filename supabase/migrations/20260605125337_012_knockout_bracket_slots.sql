ALTER TABLE matches
  ALTER COLUMN home_team_id DROP NOT NULL,
  ALTER COLUMN away_team_id DROP NOT NULL;

ALTER TABLE matches
  ADD COLUMN bracket_match_number SMALLINT UNIQUE,
  ADD COLUMN home_slot TEXT,
  ADD COLUMN away_slot TEXT;

CREATE INDEX idx_matches_bracket_match_number ON matches(bracket_match_number);

ALTER TABLE matches
  ADD CONSTRAINT matches_group_requires_teams
  CHECK (
    stage <> 'group'
    OR (home_team_id IS NOT NULL AND away_team_id IS NOT NULL)
  );
