-- Tournament configuration defaults

INSERT INTO tournament_config (key, value) VALUES
  (
    'selection_lock',
    '{"mode":"before_first_match","offset_hours":1}'::jsonb
  ),
  (
    'scoring_flags',
    '{"group_stage_counts_as_round_advancement":false}'::jsonb
  ),
  (
    'tournament_start',
    '{"scheduled_at":"2026-06-11T19:00:00Z"}'::jsonb
  );
