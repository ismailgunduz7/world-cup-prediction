-- Record which team was replaced by which during the single allowed reroll,
-- so the admin panel can show "team X → team Y" for a player. Because only one
-- reroll is permitted per player, a single set of columns on the entry suffices.

ALTER TABLE random_mode_entries
  ADD COLUMN reroll_slot SMALLINT,
  ADD COLUMN reroll_from_team_id INT REFERENCES teams(id),
  ADD COLUMN reroll_to_team_id INT REFERENCES teams(id);

-- Capture the replaced team before overwriting the slot, and persist the
-- before/after teams on the entry alongside the reroll flag.
CREATE OR REPLACE FUNCTION reroll_random_selection(
  p_user_id UUID,
  p_slot SMALLINT,
  p_new_team_id INT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_team_id INT;
BEGIN
  SELECT team_id INTO v_old_team_id
  FROM random_mode_teams
  WHERE user_id = p_user_id AND slot = p_slot;

  UPDATE random_mode_teams
    SET team_id = p_new_team_id, selected_at = NOW()
    WHERE user_id = p_user_id AND slot = p_slot;

  UPDATE random_mode_entries
    SET reroll_used = TRUE,
        reroll_slot = p_slot,
        reroll_from_team_id = v_old_team_id,
        reroll_to_team_id = p_new_team_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;
