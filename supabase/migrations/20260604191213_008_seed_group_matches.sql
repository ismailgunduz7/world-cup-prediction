-- Seed all 72 group stage matches (2026 FIFA World Cup)
-- Source: FIFA official schedule (fifa.com), times in UTC
-- Replaces the partial opener seed from migration 007

DELETE FROM matches WHERE stage = 'group';

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
  v.external_id,
  home.id,
  away.id,
  'group',
  v.group_code,
  v.round_label,
  v.scheduled_at::timestamptz,
  'scheduled'
FROM (VALUES
  -- Grup A
  ('wc2026-gs-A-01', 'Meksika', 'Güney Afrika', 'A', 'Grup A - 1. Maç', '2026-06-11T19:00:00Z'),
  ('wc2026-gs-A-02', 'Güney Kore', 'Çekya', 'A', 'Grup A - 2. Maç', '2026-06-12T02:00:00Z'),
  ('wc2026-gs-A-03', 'Çekya', 'Güney Afrika', 'A', 'Grup A - 3. Maç', '2026-06-18T16:00:00Z'),
  ('wc2026-gs-A-04', 'Meksika', 'Güney Kore', 'A', 'Grup A - 4. Maç', '2026-06-19T01:00:00Z'),
  ('wc2026-gs-A-05', 'Çekya', 'Meksika', 'A', 'Grup A - 5. Maç', '2026-06-25T01:00:00Z'),
  ('wc2026-gs-A-06', 'Güney Afrika', 'Güney Kore', 'A', 'Grup A - 6. Maç', '2026-06-25T01:00:00Z'),

  -- Grup B
  ('wc2026-gs-B-01', 'Kanada', 'Bosna-Hersek', 'B', 'Grup B - 1. Maç', '2026-06-12T19:00:00Z'),
  ('wc2026-gs-B-02', 'Katar', 'İsviçre', 'B', 'Grup B - 2. Maç', '2026-06-13T19:00:00Z'),
  ('wc2026-gs-B-03', 'İsviçre', 'Bosna-Hersek', 'B', 'Grup B - 3. Maç', '2026-06-18T19:00:00Z'),
  ('wc2026-gs-B-04', 'Kanada', 'Katar', 'B', 'Grup B - 4. Maç', '2026-06-18T22:00:00Z'),
  ('wc2026-gs-B-05', 'İsviçre', 'Kanada', 'B', 'Grup B - 5. Maç', '2026-06-24T19:00:00Z'),
  ('wc2026-gs-B-06', 'Bosna-Hersek', 'Katar', 'B', 'Grup B - 6. Maç', '2026-06-24T19:00:00Z'),

  -- Grup C
  ('wc2026-gs-C-01', 'Brezilya', 'Fas', 'C', 'Grup C - 1. Maç', '2026-06-13T22:00:00Z'),
  ('wc2026-gs-C-02', 'Haiti', 'İskoçya', 'C', 'Grup C - 2. Maç', '2026-06-14T01:00:00Z'),
  ('wc2026-gs-C-03', 'İskoçya', 'Fas', 'C', 'Grup C - 3. Maç', '2026-06-19T22:00:00Z'),
  ('wc2026-gs-C-04', 'Brezilya', 'Haiti', 'C', 'Grup C - 4. Maç', '2026-06-20T00:30:00Z'),
  ('wc2026-gs-C-05', 'İskoçya', 'Brezilya', 'C', 'Grup C - 5. Maç', '2026-06-24T22:00:00Z'),
  ('wc2026-gs-C-06', 'Fas', 'Haiti', 'C', 'Grup C - 6. Maç', '2026-06-24T22:00:00Z'),

  -- Grup D
  ('wc2026-gs-D-01', 'ABD', 'Paraguay', 'D', 'Grup D - 1. Maç', '2026-06-13T01:00:00Z'),
  ('wc2026-gs-D-02', 'Avustralya', 'Türkiye', 'D', 'Grup D - 2. Maç', '2026-06-14T04:00:00Z'),
  ('wc2026-gs-D-03', 'ABD', 'Avustralya', 'D', 'Grup D - 3. Maç', '2026-06-19T19:00:00Z'),
  ('wc2026-gs-D-04', 'Türkiye', 'Paraguay', 'D', 'Grup D - 4. Maç', '2026-06-20T03:00:00Z'),
  ('wc2026-gs-D-05', 'Türkiye', 'ABD', 'D', 'Grup D - 5. Maç', '2026-06-26T02:00:00Z'),
  ('wc2026-gs-D-06', 'Paraguay', 'Avustralya', 'D', 'Grup D - 6. Maç', '2026-06-26T02:00:00Z'),

  -- Grup E
  ('wc2026-gs-E-01', 'Almanya', 'Curaçao', 'E', 'Grup E - 1. Maç', '2026-06-14T17:00:00Z'),
  ('wc2026-gs-E-02', 'Fildişi Sahili', 'Ekvador', 'E', 'Grup E - 2. Maç', '2026-06-14T23:00:00Z'),
  ('wc2026-gs-E-03', 'Almanya', 'Fildişi Sahili', 'E', 'Grup E - 3. Maç', '2026-06-20T20:00:00Z'),
  ('wc2026-gs-E-04', 'Ekvador', 'Curaçao', 'E', 'Grup E - 4. Maç', '2026-06-21T00:00:00Z'),
  ('wc2026-gs-E-05', 'Curaçao', 'Fildişi Sahili', 'E', 'Grup E - 5. Maç', '2026-06-25T20:00:00Z'),
  ('wc2026-gs-E-06', 'Ekvador', 'Almanya', 'E', 'Grup E - 6. Maç', '2026-06-25T20:00:00Z'),

  -- Grup F
  ('wc2026-gs-F-01', 'Hollanda', 'Japonya', 'F', 'Grup F - 1. Maç', '2026-06-14T20:00:00Z'),
  ('wc2026-gs-F-02', 'İsveç', 'Tunus', 'F', 'Grup F - 2. Maç', '2026-06-15T02:00:00Z'),
  ('wc2026-gs-F-03', 'Hollanda', 'İsveç', 'F', 'Grup F - 3. Maç', '2026-06-20T17:00:00Z'),
  ('wc2026-gs-F-04', 'Tunus', 'Japonya', 'F', 'Grup F - 4. Maç', '2026-06-21T04:00:00Z'),
  ('wc2026-gs-F-05', 'Japonya', 'İsveç', 'F', 'Grup F - 5. Maç', '2026-06-25T23:00:00Z'),
  ('wc2026-gs-F-06', 'Tunus', 'Hollanda', 'F', 'Grup F - 6. Maç', '2026-06-25T23:00:00Z'),

  -- Grup G
  ('wc2026-gs-G-01', 'Belçika', 'Mısır', 'G', 'Grup G - 1. Maç', '2026-06-15T19:00:00Z'),
  ('wc2026-gs-G-02', 'İran', 'Yeni Zelanda', 'G', 'Grup G - 2. Maç', '2026-06-16T01:00:00Z'),
  ('wc2026-gs-G-03', 'Belçika', 'İran', 'G', 'Grup G - 3. Maç', '2026-06-21T19:00:00Z'),
  ('wc2026-gs-G-04', 'Yeni Zelanda', 'Mısır', 'G', 'Grup G - 4. Maç', '2026-06-22T01:00:00Z'),
  ('wc2026-gs-G-05', 'Mısır', 'İran', 'G', 'Grup G - 5. Maç', '2026-06-27T03:00:00Z'),
  ('wc2026-gs-G-06', 'Yeni Zelanda', 'Belçika', 'G', 'Grup G - 6. Maç', '2026-06-27T03:00:00Z'),

  -- Grup H
  ('wc2026-gs-H-01', 'İspanya', 'Yeşil Burun Adaları', 'H', 'Grup H - 1. Maç', '2026-06-15T16:00:00Z'),
  ('wc2026-gs-H-02', 'Suudi Arabistan', 'Uruguay', 'H', 'Grup H - 2. Maç', '2026-06-15T22:00:00Z'),
  ('wc2026-gs-H-03', 'İspanya', 'Suudi Arabistan', 'H', 'Grup H - 3. Maç', '2026-06-21T16:00:00Z'),
  ('wc2026-gs-H-04', 'Uruguay', 'Yeşil Burun Adaları', 'H', 'Grup H - 4. Maç', '2026-06-21T22:00:00Z'),
  ('wc2026-gs-H-05', 'Yeşil Burun Adaları', 'Suudi Arabistan', 'H', 'Grup H - 5. Maç', '2026-06-27T00:00:00Z'),
  ('wc2026-gs-H-06', 'Uruguay', 'İspanya', 'H', 'Grup H - 6. Maç', '2026-06-27T00:00:00Z'),

  -- Grup I
  ('wc2026-gs-I-01', 'Fransa', 'Senegal', 'I', 'Grup I - 1. Maç', '2026-06-16T19:00:00Z'),
  ('wc2026-gs-I-02', 'Irak', 'Norveç', 'I', 'Grup I - 2. Maç', '2026-06-16T22:00:00Z'),
  ('wc2026-gs-I-03', 'Fransa', 'Irak', 'I', 'Grup I - 3. Maç', '2026-06-22T21:00:00Z'),
  ('wc2026-gs-I-04', 'Norveç', 'Senegal', 'I', 'Grup I - 4. Maç', '2026-06-23T00:00:00Z'),
  ('wc2026-gs-I-05', 'Norveç', 'Fransa', 'I', 'Grup I - 5. Maç', '2026-06-26T19:00:00Z'),
  ('wc2026-gs-I-06', 'Senegal', 'Irak', 'I', 'Grup I - 6. Maç', '2026-06-26T19:00:00Z'),

  -- Grup J
  ('wc2026-gs-J-01', 'Arjantin', 'Cezayir', 'J', 'Grup J - 1. Maç', '2026-06-17T01:00:00Z'),
  ('wc2026-gs-J-02', 'Avusturya', 'Ürdün', 'J', 'Grup J - 2. Maç', '2026-06-17T04:00:00Z'),
  ('wc2026-gs-J-03', 'Arjantin', 'Avusturya', 'J', 'Grup J - 3. Maç', '2026-06-22T17:00:00Z'),
  ('wc2026-gs-J-04', 'Ürdün', 'Cezayir', 'J', 'Grup J - 4. Maç', '2026-06-23T03:00:00Z'),
  ('wc2026-gs-J-05', 'Cezayir', 'Avusturya', 'J', 'Grup J - 5. Maç', '2026-06-28T02:00:00Z'),
  ('wc2026-gs-J-06', 'Ürdün', 'Arjantin', 'J', 'Grup J - 6. Maç', '2026-06-28T02:00:00Z'),

  -- Grup K
  ('wc2026-gs-K-01', 'Portekiz', 'Demokratik Kongo', 'K', 'Grup K - 1. Maç', '2026-06-17T17:00:00Z'),
  ('wc2026-gs-K-02', 'Özbekistan', 'Kolombiya', 'K', 'Grup K - 2. Maç', '2026-06-18T02:00:00Z'),
  ('wc2026-gs-K-03', 'Portekiz', 'Özbekistan', 'K', 'Grup K - 3. Maç', '2026-06-23T17:00:00Z'),
  ('wc2026-gs-K-04', 'Kolombiya', 'Demokratik Kongo', 'K', 'Grup K - 4. Maç', '2026-06-24T02:00:00Z'),
  ('wc2026-gs-K-05', 'Kolombiya', 'Portekiz', 'K', 'Grup K - 5. Maç', '2026-06-27T23:30:00Z'),
  ('wc2026-gs-K-06', 'Demokratik Kongo', 'Özbekistan', 'K', 'Grup K - 6. Maç', '2026-06-27T23:30:00Z'),

  -- Grup L
  ('wc2026-gs-L-01', 'İngiltere', 'Hırvatistan', 'L', 'Grup L - 1. Maç', '2026-06-17T20:00:00Z'),
  ('wc2026-gs-L-02', 'Gana', 'Panama', 'L', 'Grup L - 2. Maç', '2026-06-17T23:00:00Z'),
  ('wc2026-gs-L-03', 'İngiltere', 'Gana', 'L', 'Grup L - 3. Maç', '2026-06-23T20:00:00Z'),
  ('wc2026-gs-L-04', 'Panama', 'Hırvatistan', 'L', 'Grup L - 4. Maç', '2026-06-23T23:00:00Z'),
  ('wc2026-gs-L-05', 'Panama', 'İngiltere', 'L', 'Grup L - 5. Maç', '2026-06-27T21:00:00Z'),
  ('wc2026-gs-L-06', 'Hırvatistan', 'Gana', 'L', 'Grup L - 6. Maç', '2026-06-27T21:00:00Z')
) AS v(external_id, home_name, away_name, group_code, round_label, scheduled_at)
JOIN teams home ON home.name_tr = v.home_name
JOIN teams away ON away.name_tr = v.away_name;
