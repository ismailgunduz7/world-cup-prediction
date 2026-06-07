CREATE TABLE best_third_rankings (
  team_id INT PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  global_rank SMALLINT NOT NULL,
  is_advancing BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_best_third_rankings_global_rank ON best_third_rankings(global_rank);

INSERT INTO tournament_config (key, value)
VALUES ('best_third_rank_is_manual', '{"manual": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
