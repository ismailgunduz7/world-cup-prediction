-- Eleme turu maçlarında uzatma (120') ve penaltı sonuçlarını ayrı tutmak için
-- yeni kolonlar. home_score/away_score her zaman 90' (normal süre) skorunu (puan
-- esasını) tutmaya devam eder. ET/penaltı kolonları yalnızca eleme maçlarında
-- ve gerektiğinde doldurulur; aksi halde NULL.

ALTER TABLE matches
  ADD COLUMN home_score_aet SMALLINT,   -- uzatma sonu (120') skoru, nullable
  ADD COLUMN away_score_aet SMALLINT,
  ADD COLUMN home_penalties SMALLINT,   -- penaltı atışları, nullable
  ADD COLUMN away_penalties SMALLINT;

-- Yeni global puan bayrağını mevcut scoring_flags değerine ekle (jsonb merge,
-- mevcut anahtarları korur). true iken eleme puanları (G/B/M + gol) 120' (uzatma
-- sonu) skoru üzerinden hesaplanır; false iken 90' skoru üzerinden.
UPDATE tournament_config
  SET value = value || '{"knockout_result_over_120": false}'::jsonb,
      updated_at = NOW()
  WHERE key = 'scoring_flags';
