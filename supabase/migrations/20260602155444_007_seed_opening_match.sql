-- Seed opening match for selection lock calculation (Mexico vs South Africa, Jun 11 2026)

INSERT INTO matches (
  external_id,
  home_team_id,
  away_team_id,
  stage,
  group_code,
  round_label,
  scheduled_at,
  status
)
SELECT
  'wc2026-opener',
  home.id,
  away.id,
  'group',
  'A',
  'Grup A - 1. Maç',
  '2026-06-11T19:00:00Z'::timestamptz,
  'scheduled'
FROM teams home
JOIN teams away ON away.name_tr = 'Güney Afrika'
WHERE home.name_tr = 'Meksika';
