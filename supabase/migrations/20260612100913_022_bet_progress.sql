-- Bet progress: tournament-wide corner/yellow card over targets and per-match stats.

CREATE TABLE bet_progress_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  target_corners INT NOT NULL DEFAULT 991 CHECK (target_corners > 0),
  target_yellow_cards INT NOT NULL DEFAULT 381 CHECK (target_yellow_cards > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE bet_progress_config IS 'Singleton config for bet progress targets (corners / yellow cards over)';

INSERT INTO bet_progress_config (target_corners, target_yellow_cards) VALUES (991, 381);

CREATE TABLE match_bet_stats (
  match_id INT PRIMARY KEY REFERENCES matches (id) ON DELETE CASCADE,
  home_corners SMALLINT NOT NULL DEFAULT 0 CHECK (home_corners >= 0),
  away_corners SMALLINT NOT NULL DEFAULT 0 CHECK (away_corners >= 0),
  home_yellow_cards SMALLINT NOT NULL DEFAULT 0 CHECK (home_yellow_cards >= 0),
  away_yellow_cards SMALLINT NOT NULL DEFAULT 0 CHECK (away_yellow_cards >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE match_bet_stats IS 'Per-match corner and yellow card counts for bet progress tracking';
