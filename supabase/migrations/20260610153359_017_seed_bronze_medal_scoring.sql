-- Add bronze medal scoring rule (awarded to the third place match winner).
-- Tier point values start at 0 as placeholders; they are configured from the
-- admin panel.

INSERT INTO scoring_rule_types (id, code, name_tr, description_tr, category, sort_order) VALUES
  (12, 'bronze_medal', 'Bronz Madalya', '3.lük maçı kazananına verilen puan', 'medal', 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tier_scoring_rules (rule_type_id, tier_id, points) VALUES
  -- Bronz madalya (placeholder)
  (12, 1, 0), (12, 2, 0), (12, 3, 0), (12, 4, 0), (12, 5, 0)
ON CONFLICT (rule_type_id, tier_id) DO NOTHING;
