-- Reorder medal scoring rule IDs: 10→11, 11→12, 12→10
-- (bronze becomes 10, silver becomes 11, gold becomes 12)
-- FK constraints are dropped temporarily because child rows cannot reference
-- temporary parent IDs until those parents exist.

BEGIN;

ALTER TABLE tier_scoring_rules
  DROP CONSTRAINT tier_scoring_rules_rule_type_id_fkey;

ALTER TABLE team_point_entries
  DROP CONSTRAINT team_point_entries_rule_type_id_fkey;

-- Phase 1: move to temporary IDs (parents first, then children)
UPDATE scoring_rule_types SET id = 100, sort_order = 100 WHERE id = 10;
UPDATE scoring_rule_types SET id = 101, sort_order = 101 WHERE id = 11;
UPDATE scoring_rule_types SET id = 102, sort_order = 102 WHERE id = 12;

UPDATE tier_scoring_rules SET rule_type_id = 100 WHERE rule_type_id = 10;
UPDATE tier_scoring_rules SET rule_type_id = 101 WHERE rule_type_id = 11;
UPDATE tier_scoring_rules SET rule_type_id = 102 WHERE rule_type_id = 12;

UPDATE team_point_entries SET rule_type_id = 100 WHERE rule_type_id = 10;
UPDATE team_point_entries SET rule_type_id = 101 WHERE rule_type_id = 11;
UPDATE team_point_entries SET rule_type_id = 102 WHERE rule_type_id = 12;

-- Phase 2: assign final IDs (bronze→10, silver→11, gold→12)
UPDATE scoring_rule_types SET id = 10, sort_order = 10 WHERE id = 102;
UPDATE tier_scoring_rules SET rule_type_id = 10 WHERE rule_type_id = 102;
UPDATE team_point_entries SET rule_type_id = 10 WHERE rule_type_id = 102;

UPDATE scoring_rule_types SET id = 11, sort_order = 11 WHERE id = 100;
UPDATE tier_scoring_rules SET rule_type_id = 11 WHERE rule_type_id = 100;
UPDATE team_point_entries SET rule_type_id = 11 WHERE rule_type_id = 100;

UPDATE scoring_rule_types SET id = 12, sort_order = 12 WHERE id = 101;
UPDATE tier_scoring_rules SET rule_type_id = 12 WHERE rule_type_id = 101;
UPDATE team_point_entries SET rule_type_id = 12 WHERE rule_type_id = 101;

ALTER TABLE tier_scoring_rules
  ADD CONSTRAINT tier_scoring_rules_rule_type_id_fkey
  FOREIGN KEY (rule_type_id) REFERENCES scoring_rule_types(id) ON DELETE CASCADE;

ALTER TABLE team_point_entries
  ADD CONSTRAINT team_point_entries_rule_type_id_fkey
  FOREIGN KEY (rule_type_id) REFERENCES scoring_rule_types(id);

COMMIT;
