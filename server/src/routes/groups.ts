import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { getBestThirdSummary } from '../services/best-third-service.js';
import { getGroupStandingsSummaries } from '../services/group-standings-service.js';

const groupRoutes = new Hono<{ Variables: AppVariables }>();

groupRoutes.use('*', authMiddleware, participantMiddleware);

groupRoutes.get('/standings', async (c) => {
  const user = c.get('user');
  const groups = await getGroupStandingsSummaries();

  const { data: selections, error } = await supabase
    .from('team_selections')
    .select('team_id')
    .eq('user_id', user.id);

  if (error) throw error;

  const selectedTeamIds = new Set((selections ?? []).map((selection) => selection.team_id));

  return c.json({
    groups: groups.map((group) => ({
      ...group,
      standings: group.standings.map((standing) => ({
        ...standing,
        isUserSelection: selectedTeamIds.has(standing.teamId),
      })),
    })),
  });
});

groupRoutes.get('/best-thirds', async (c) => {
  const user = c.get('user');
  const summary = await getBestThirdSummary();

  const { data: selections, error } = await supabase
    .from('team_selections')
    .select('team_id')
    .eq('user_id', user.id);

  if (error) throw error;

  const selectedTeamIds = new Set((selections ?? []).map((selection) => selection.team_id));

  return c.json({
    bestThirds: {
      ...summary,
      rows: summary.rows.map((row) => ({
        ...row,
        isUserSelection: selectedTeamIds.has(row.teamId),
      })),
    },
  });
});

export default groupRoutes;
