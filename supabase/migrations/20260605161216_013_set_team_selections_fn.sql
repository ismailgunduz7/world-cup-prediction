-- Atomic replacement of a user's team selections.
-- Wrapping the delete + insert in a single function makes the swap atomic:
-- a failure mid-way rolls back, so a user can never be left with zero
-- selections (the previous delete-then-insert in the API was not atomic).

CREATE OR REPLACE FUNCTION set_team_selections(p_user_id UUID, p_team_ids INT[])
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM team_selections WHERE user_id = p_user_id;

  INSERT INTO team_selections (user_id, team_id)
  SELECT p_user_id, team_id
  FROM unnest(p_team_ids) AS team_id;
END;
$$;
