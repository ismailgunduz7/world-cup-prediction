-- Add an optional constraint to random mode: the 3 assigned teams must come
-- from distinct World Cup groups. Stored per-player alongside the other
-- preferences and locked together with them once triggered.

ALTER TABLE random_mode_entries
  ADD COLUMN no_same_group BOOLEAN NOT NULL DEFAULT FALSE;

-- The trigger RPC gains a p_no_same_group argument. A new parameter changes the
-- function signature, so the old 4-arg version is dropped first to avoid a
-- dangling overload.
DROP FUNCTION IF EXISTS trigger_random_selection(UUID, TEXT, SMALLINT[], INT[]);

CREATE OR REPLACE FUNCTION trigger_random_selection(
  p_user_id UUID,
  p_condition TEXT,
  p_tiers SMALLINT[],
  p_no_same_group BOOLEAN,
  p_team_ids INT[]
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO random_mode_entries (
    user_id, condition, allowed_tiers, no_same_group, is_triggered, reroll_used, updated_at
  )
  VALUES (p_user_id, p_condition, p_tiers, p_no_same_group, TRUE, FALSE, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET condition = EXCLUDED.condition,
        allowed_tiers = EXCLUDED.allowed_tiers,
        no_same_group = EXCLUDED.no_same_group,
        is_triggered = TRUE,
        reroll_used = FALSE,
        reroll_slot = NULL,
        reroll_from_team_id = NULL,
        reroll_to_team_id = NULL,
        updated_at = NOW();

  DELETE FROM random_mode_teams WHERE user_id = p_user_id;

  INSERT INTO random_mode_teams (user_id, team_id, slot)
  SELECT p_user_id, team_id, ordinality::SMALLINT
  FROM unnest(p_team_ids) WITH ORDINALITY AS t(team_id, ordinality);
END;
$$;
