import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { getConfigValue } from '../services/tournament-config.js';
import { unwrapOne } from '../lib/serializers.js';

const scoringRulesRoutes = new Hono<{ Variables: AppVariables }>();

scoringRulesRoutes.use('*', authMiddleware, participantMiddleware);

scoringRulesRoutes.get('/', async (c) => {
  const [{ data: rules, error: rulesError }, scoringFlags] = await Promise.all([
    supabase
      .from('tier_scoring_rules')
      .select(
        'id, points, rule_type:scoring_rule_types(id, name_tr, description_tr, sort_order, is_active), tier:tiers(id, name_tr, sort_order)',
      )
      .order('rule_type_id'),
    getConfigValue<{
      group_stage_counts_as_round_advancement: boolean;
      knockout_result_over_120: boolean;
    }>('scoring_flags', {
      group_stage_counts_as_round_advancement: false,
      knockout_result_over_120: false,
    }),
  ]);

  if (rulesError) throw rulesError;

  type RuleRow = {
    id: number;
    points: number | string;
    rule_type:
      | { id: number; name_tr: string; description_tr: string | null; sort_order: number; is_active: boolean }
      | null;
    tier: { id: number; name_tr: string; sort_order: number } | null;
  };

  const mappedRules = ((rules ?? []) as unknown as RuleRow[])
    .map((rule) => {
      const ruleType = unwrapOne(rule.rule_type);
      const tier = unwrapOne(rule.tier);
      if (!ruleType || !tier) return null;
      return {
        id: rule.id,
        points: Number(rule.points),
        ruleType: {
          id: ruleType.id,
          name: ruleType.name_tr,
          description: ruleType.description_tr,
          sortOrder: ruleType.sort_order,
          isActive: ruleType.is_active,
        },
        tier: { id: tier.id, name: tier.name_tr, sortOrder: tier.sort_order },
      };
    })
    .filter((rule): rule is NonNullable<typeof rule> => rule !== null && rule.ruleType.isActive);

  return c.json({
    rules: mappedRules,
    scoringFlags,
  });
});

export default scoringRulesRoutes;
