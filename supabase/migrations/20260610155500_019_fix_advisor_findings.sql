-- Address Supabase database linter (Advisors) findings.
--
-- Context: the only DB client is the service_role key (server-side), and auth is
-- custom JWT rather than Supabase Auth. So the many "RLS enabled, no policy" INFO
-- findings are intentional/safe and are left untouched. This migration fixes the
-- one ERROR, the search_path warnings, and removes a leftover public function.

-- 1) ERROR security_definer_view: recreate team_total_points as SECURITY INVOKER
-- so it runs with the querying role's permissions instead of the view owner's.
DROP VIEW IF EXISTS public.team_total_points;

CREATE VIEW public.team_total_points
WITH (security_invoker = true) AS
SELECT
  team_id,
  COALESCE(SUM(points), 0)::NUMERIC(6, 2) AS total_points
FROM public.team_point_entries
GROUP BY team_id;

-- 2) WARN function_search_path_mutable: pin search_path so it can't be hijacked
-- by the caller's session settings. Empty search_path + schema-qualified names is
-- the most defensive option (pg_catalog is always implicitly searched). With an
-- empty search_path the previously-unqualified table names no longer resolve, so
-- the bodies are re-created with public.-qualified names.
CREATE OR REPLACE FUNCTION public.set_team_selections(p_user_id UUID, p_team_ids INT[])
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.team_selections WHERE user_id = p_user_id;

  INSERT INTO public.team_selections (user_id, team_id)
  SELECT p_user_id, team_id
  FROM unnest(p_team_ids) AS team_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_random_selection(
  p_user_id UUID,
  p_condition TEXT,
  p_tiers SMALLINT[],
  p_no_same_group BOOLEAN,
  p_team_ids INT[]
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.random_mode_entries (
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

  DELETE FROM public.random_mode_teams WHERE user_id = p_user_id;

  INSERT INTO public.random_mode_teams (user_id, team_id, slot)
  SELECT p_user_id, team_id, ordinality::SMALLINT
  FROM unnest(p_team_ids) WITH ORDINALITY AS t(team_id, ordinality);
END;
$$;

CREATE OR REPLACE FUNCTION public.reroll_random_selection(
  p_user_id UUID,
  p_slot SMALLINT,
  p_new_team_id INT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_old_team_id INT;
BEGIN
  SELECT team_id INTO v_old_team_id
  FROM public.random_mode_teams
  WHERE user_id = p_user_id AND slot = p_slot;

  UPDATE public.random_mode_teams
    SET team_id = p_new_team_id, selected_at = NOW()
    WHERE user_id = p_user_id AND slot = p_slot;

  UPDATE public.random_mode_entries
    SET reroll_used = TRUE,
        reroll_slot = p_slot,
        reroll_from_team_id = v_old_team_id,
        reroll_to_team_id = p_new_team_id,
        updated_at = NOW()
    WHERE user_id = p_user_id;
END;
$$;

-- 3) WARN anon/authenticated_security_definer_function_executable: rls_auto_enable
-- backs the `ensure_rls` event trigger that auto-enables RLS on newly created
-- tables, so it must stay. The warning is only that it is callable via the public
-- REST API (/rest/v1/rpc/rls_auto_enable). Revoking EXECUTE removes it from the
-- exposed API; the event trigger fires on DDL events regardless of these grants.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
