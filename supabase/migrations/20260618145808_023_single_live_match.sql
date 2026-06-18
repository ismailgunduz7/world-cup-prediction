-- At most one match may be live at a time.
CREATE UNIQUE INDEX idx_matches_single_live ON matches (status) WHERE status = 'live';
