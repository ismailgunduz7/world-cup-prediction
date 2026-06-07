import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { getConfigValue } from '../services/tournament-config.js';

const scoringRulesRoutes = new Hono<{ Variables: AppVariables }>();

scoringRulesRoutes.use('*', authMiddleware, participantMiddleware);

scoringRulesRoutes.get('/', async (c) => {
  const [{ data: rules, error: rulesError }, scoringFlags] = await Promise.all([
    supabase
      .from('tier_scoring_rules')
      .select('*, rule_type:scoring_rule_types(*), tier:tiers(*)')
      .order('rule_type_id'),
    getConfigValue<{ group_stage_counts_as_round_advancement: boolean }>('scoring_flags', {
      group_stage_counts_as_round_advancement: false,
    }),
  ]);

  if (rulesError) throw rulesError;

  const activeRules = (rules ?? []).filter(
    (rule) => (rule.rule_type as { is_active?: boolean } | null)?.is_active !== false,
  );

  return c.json({
    rules: activeRules,
    scoringFlags,
  });
});

export default scoringRulesRoutes;
