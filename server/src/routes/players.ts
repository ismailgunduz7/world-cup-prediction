import { Hono } from 'hono';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';

const playerRoutes = new Hono<{ Variables: AppVariables }>();

playerRoutes.use('*', authMiddleware, participantMiddleware);

playerRoutes.get('/:userId/points', async (c) => {
  const userId = c.req.param('userId');

  const { data: player, error: playerError } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('id', userId)
    .eq('is_admin', false)
    .maybeSingle();

  if (playerError) throw playerError;
  if (!player) {
    return c.json({ error: 'Oyuncu bulunamadı' }, 404);
  }

  const { data: selections, error: selError } = await supabase
    .from('team_selections')
    .select('*, team:teams(*, tier:tiers(*))')
    .eq('user_id', userId)
    .order('selected_at');

  if (selError) throw selError;

  const teamIds = (selections ?? []).map((s) => s.team_id);
  if (teamIds.length === 0) {
    return c.json({
      player: {
        id: player.id,
        displayName: player.display_name,
        username: player.username,
        totalScore: 0,
      },
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
    .select('*, rule_type:scoring_rule_types(code, name_tr, category)')
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
      const team = selection.team as {
        id: number;
        name_tr: string;
        group_code: string;
        tier: { id: number; code: string; name_tr: string };
      };
      const teamId = team.id;

      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select(
          '*, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)',
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

      const finishedMatches = (matches ?? []).map((match) => {
        const breakdown = pointsByMatch.get(match.id) ?? [];
        const matchPoints = breakdown.reduce((sum, e) => sum + Number(e.points), 0);
        return {
          ...match,
          point_breakdown: breakdown,
          match_points: matchPoints,
        };
      });

      const bonusEntries = teamEntries.filter((entry) => entry.match_id === null);

      return {
        team: {
          ...team,
          total_points: pointsMap.get(teamId) ?? 0,
        },
        selectedAt: selection.selected_at,
        finishedMatches,
        bonusEntries,
        matchPointsTotal: finishedMatches.reduce((sum, m) => sum + m.match_points, 0),
        bonusPointsTotal: bonusEntries.reduce((sum, e) => sum + Number(e.points), 0),
      };
    }),
  );

  const totalScore = teams.reduce((sum, t) => sum + t.team.total_points, 0);

  return c.json({
    player: {
      id: player.id,
      displayName: player.display_name,
      username: player.username,
      totalScore,
    },
    hasSelections: true,
    teams,
  });
});

export default playerRoutes;
