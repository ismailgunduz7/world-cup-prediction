-- Replace global single-live index with rules that allow two simultaneous
-- live matches in the same group during the final group-stage matchday (5. and 6. Maç).

DROP INDEX IF EXISTS idx_matches_single_live;

CREATE OR REPLACE FUNCTION matches_live_status_check()
RETURNS TRIGGER AS $$
DECLARE
  other RECORD;
  target_match_num INT;
  target_is_group_final BOOLEAN;
  other_match_num INT;
  other_is_group_final BOOLEAN;
  same_group_final_count INT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'live'::match_status THEN
    RETURN NEW;
  END IF;

  target_match_num := NULL;
  IF NEW.round_label IS NOT NULL THEN
    target_match_num := (regexp_match(NEW.round_label, '(\d+)\.\s*Maç'))[1]::INT;
  END IF;

  target_is_group_final :=
    NEW.stage = 'group'
    AND NEW.group_code IS NOT NULL
    AND target_match_num IN (5, 6);

  IF NOT target_is_group_final THEN
    IF EXISTS (
      SELECT 1
      FROM matches
      WHERE status = 'live'::match_status
        AND id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'matches_live_constraint:single_live_match_violation';
    END IF;

    RETURN NEW;
  END IF;

  FOR other IN
    SELECT id, stage, group_code, round_label
    FROM matches
    WHERE status = 'live'::match_status
      AND id <> NEW.id
  LOOP
    other_match_num := NULL;
    IF other.round_label IS NOT NULL THEN
      other_match_num := (regexp_match(other.round_label, '(\d+)\.\s*Maç'))[1]::INT;
    END IF;

    other_is_group_final :=
      other.stage = 'group'
      AND other.group_code IS NOT NULL
      AND other_match_num IN (5, 6);

    IF NOT other_is_group_final OR other.group_code IS DISTINCT FROM NEW.group_code THEN
      RAISE EXCEPTION 'matches_live_constraint:single_live_match_violation';
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO same_group_final_count
  FROM matches
  WHERE status = 'live'::match_status
    AND id <> NEW.id
    AND stage = 'group'
    AND group_code = NEW.group_code
    AND round_label IS NOT NULL
    AND (regexp_match(round_label, '(\d+)\.\s*Maç'))[1]::INT IN (5, 6);

  IF same_group_final_count >= 2 THEN
    RAISE EXCEPTION 'matches_live_constraint:group_final_live_limit';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_live_status_check_trigger ON matches;

CREATE TRIGGER matches_live_status_check_trigger
  BEFORE INSERT OR UPDATE OF status ON matches
  FOR EACH ROW
  EXECUTE FUNCTION matches_live_status_check();
