import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { toMatchSummary, toPointEntry } from '../lib/serializers.js';

const playerRoutes = new Hono<{ Variables: AppVariables }>();

playerRoutes.use('*', authMiddleware, participantMiddleware);

playerRoutes.get('/:username/points', async (c) => {
  const username = c.req.param('username');
  const mode = c.req.query('mode') === 'random' ? 'random' : 'real';

  const { data: player, error: playerError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('username', username)
    .eq('is_admin', false)
    .maybeSingle();

  if (playerError) throw playerError;
  if (!player) {
    return c.json({ error: 'Oyuncu bulunamadı' }, 404);
  }

  // Both modes reuse the same point-breakdown logic; only the source of the
  // player's teams differs (real picks vs. randomly-assigned teams).
  const { data: selections, error: selError } =
    mode === 'random'
      ? await supabase
          .from('random_mode_teams')
          .select('team_id, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
          .eq('user_id', player.id)
          .order('slot')
      : await supabase
          .from('team_selections')
          .select('team_id, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
          .eq('user_id', player.id)
          .order('selected_at');

  if (selError) throw selError;

  const teamIds = (selections ?? []).map((s) => s.team_id);
  if (teamIds.length === 0) {
    return c.json({
      player: { displayName: player.display_name, totalScore: 0 },
      hasSelections: false,
      teams: [],
    });
  }

  const { data: totals, error: totalError } = await supabase
    .from('team_total_points')
    .select('*')
    .in('team_id', teamIds);

  if (totalError) throw totalError;

  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const { data: allPointEntries, error: peError } = await supabase
    .from('team_point_entries')
    .select('team_id, match_id, points, description_tr, rule_type:scoring_rule_types(code, name_tr)')
    .in('team_id', teamIds)
    .order('earned_at', { nullsFirst: false });

  if (peError) throw peError;

  const entriesByTeam = new Map<number, typeof allPointEntries>();
  for (const entry of allPointEntries ?? []) {
    const list = entriesByTeam.get(entry.team_id) ?? [];
    list.push(entry);
    entriesByTeam.set(entry.team_id, list);
  }

  const teams = await Promise.all(
    (selections ?? []).map(async (selection) => {
      const raw = (Array.isArray(selection.team) ? selection.team[0] : selection.team) as {
        id: number;
        name_tr: string;
        group_code: string;
        tier: { name_tr: string } | { name_tr: string }[] | null;
      };
      const tier = Array.isArray(raw.tier) ? raw.tier[0] ?? null : raw.tier;
      const teamId = raw.id;

      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(
          'id, stage, status, scheduled_at, home_score, away_score, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr)',
        )
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'finished')
        .order('scheduled_at');

      if (matchError) throw matchError;

      const teamEntries = entriesByTeam.get(teamId) ?? [];
      const pointsByMatch = new Map<number, typeof teamEntries>();

      for (const entry of teamEntries) {
        if (!entry.match_id) continue;
        const list = pointsByMatch.get(entry.match_id) ?? [];
        list.push(entry);
        pointsByMatch.set(entry.match_id, list);
      }

      const finishedMatches = (matches ?? []).map((match) =>
        toMatchSummary(match as never, (pointsByMatch.get(match.id) ?? []) as never),
      );

      const bonusEntries = teamEntries
        .filter((entry) => entry.match_id === null)
        .map((entry) => toPointEntry(entry as never));

      return {
        team: {
          id: teamId,
          name: raw.name_tr,
          groupCode: raw.group_code,
          tierName: tier?.name_tr ?? null,
          totalPoints: pointsMap.get(teamId) ?? 0,
        },
        finishedMatches,
        bonusEntries,
      };
    }),
  );

  const totalScore = teams.reduce((sum, t) => sum + t.team.totalPoints, 0);

  return c.json({
    player: { displayName: player.display_name, totalScore },
    hasSelections: true,
    teams,
  });
});

export default playerRoutes;
