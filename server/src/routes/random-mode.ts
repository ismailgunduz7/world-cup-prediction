import { Hono } from 'hono';
import { z } from 'zod';
import { supabase } from '../lib/config.js';
import { authMiddleware, participantMiddleware, type AppVariables } from '../middleware/auth.js';
import { areSelectionsLocked } from '../services/tournament-config.js';
import { isRandomModeEnabledForUser } from '../services/random-mode-service.js';

const SLOT_COUNT = 3;

type RandomCondition = 'fully_random' | 'exclude_own' | 'never_picked';

const randomModeRoutes = new Hono<{ Variables: AppVariables }>();

randomModeRoutes.use('*', authMiddleware, participantMiddleware);

/**
 * Computes the pool of team ids a user is allowed to be randomly assigned,
 * given a condition + tier filter. Pool computation lives here (server side,
 * authoritative) so a client can never influence which teams it gets.
 * `never_picked` only excludes teams selected by players in the same
 * competition (real-mode selections, not random assignments).
 */
type PoolTeam = { id: number; group_code: string };

async function computeEligiblePool(
  userId: string,
  competitionId: string | null,
  condition: RandomCondition,
  allowedTiers: number[],
  excludeTeamIds: number[],
): Promise<PoolTeam[]> {
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, tier_id, group_code')
    .eq('is_active', true)
    .in('tier_id', allowedTiers);

  if (teamError) throw teamError;

  const excluded = new Set<number>(excludeTeamIds);

  if (condition === 'exclude_own') {
    const { data: own, error } = await supabase
      .from('team_selections')
      .select('team_id')
      .eq('user_id', userId);
    if (error) throw error;
    for (const s of own ?? []) excluded.add(s.team_id);
  } else if (condition === 'never_picked' && competitionId) {
    const { data: competitionUsers, error: usersError } = await supabase
      .from('users')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('is_admin', false);
    if (usersError) throw usersError;

    const competitionUserIds = (competitionUsers ?? []).map((u) => u.id);
    if (competitionUserIds.length > 0) {
      const { data: picked, error } = await supabase
        .from('team_selections')
        .select('team_id')
        .in('user_id', competitionUserIds);
      if (error) throw error;
      for (const s of picked ?? []) excluded.add(s.team_id);
    }
  }

  return (teams ?? [])
    .filter((t) => !excluded.has(t.id))
    .map((t) => ({ id: t.id, group_code: t.group_code }));
}

function pickRandom<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/**
 * Picks `count` team ids from the pool. When `noSameGroup` is set, each pick
 * comes from a distinct World Cup group: groups are shuffled, then one random
 * team is drawn from each until `count` is reached. Returns fewer than `count`
 * ids only when the pool can't satisfy the constraint.
 */
function pickTeams(pool: PoolTeam[], count: number, noSameGroup: boolean): number[] {
  if (!noSameGroup) {
    return pickRandom(pool, count).map((t) => t.id);
  }

  const byGroup = new Map<string, number[]>();
  for (const t of pool) {
    const list = byGroup.get(t.group_code) ?? [];
    list.push(t.id);
    byGroup.set(t.group_code, list);
  }

  const groups = pickRandom([...byGroup.keys()], count);
  return groups.map((g) => {
    const ids = byGroup.get(g)!;
    return ids[Math.floor(Math.random() * ids.length)];
  });
}

type TeamDTO = { id: number; name: string; groupCode: string; tierName: string | null };

async function loadTeams(teamIds: number[]): Promise<TeamDTO[]> {
  if (teamIds.length === 0) return [];
  const { data: teams, error: teamError } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(name_tr)')
    .in('id', teamIds);
  if (teamError) throw teamError;
  return (teams ?? []).map((t) => {
    const tier = Array.isArray(t.tier) ? t.tier[0] ?? null : t.tier;
    return { id: t.id, name: t.name_tr, groupCode: t.group_code, tierName: tier?.name_tr ?? null };
  });
}

async function getEntryWithTeams(userId: string) {
  const [{ data: entry, error: entryError }, { data: slots, error: slotError }] = await Promise.all([
    supabase.from('random_mode_entries').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('random_mode_teams').select('team_id, slot').eq('user_id', userId).order('slot'),
  ]);
  if (entryError) throw entryError;
  if (slotError) throw slotError;

  const teamRows = await loadTeams((slots ?? []).map((s) => s.team_id));
  const teamById = new Map(teamRows.map((t) => [t.id, t]));
  const teams = (slots ?? []).map((s) => ({ slot: s.slot, team: teamById.get(s.team_id) ?? null }));

  return { entry, teams };
}

randomModeRoutes.get('/mine', async (c) => {
  const user = c.get('user');
  const [{ entry, teams }, enabled, selectionsLocked] = await Promise.all([
    getEntryWithTeams(user.id),
    isRandomModeEnabledForUser(user.competitionId),
    areSelectionsLocked(),
  ]);

  return c.json({
    enabled,
    selectionsLocked,
    isTriggered: entry?.is_triggered ?? false,
    rerollUsed: entry?.reroll_used ?? false,
    condition: entry?.condition ?? null,
    allowedTiers: entry?.allowed_tiers ?? null,
    noSameGroup: entry?.no_same_group ?? false,
    teams,
    slotCount: SLOT_COUNT,
  });
});

randomModeRoutes.post('/trigger', async (c) => {
  const user = c.get('user');

  if (!(await isRandomModeEnabledForUser(user.competitionId))) {
    return c.json({ error: 'Rastgele mod şu anda kapalı' }, 403);
  }
  if (await areSelectionsLocked()) {
    return c.json({ error: 'Seçimler kilitlendi, rastgele atama yapılamaz' }, 403);
  }

  const { data: existing, error: existingError } = await supabase
    .from('random_mode_entries')
    .select('is_triggered')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.is_triggered) {
    return c.json({ error: 'Rastgele seçim zaten yapılmış' }, 409);
  }

  const schema = z.object({
    condition: z.enum(['fully_random', 'exclude_own', 'never_picked']),
    allowedTiers: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    noSameGroup: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz koşul veya tier filtresi' }, 400);
  }

  const allowedTiers = [...new Set(parsed.data.allowedTiers)];
  const noSameGroup = parsed.data.noSameGroup;
  const pool = await computeEligiblePool(
    user.id,
    user.competitionId,
    parsed.data.condition,
    allowedTiers,
    [],
  );

  if (noSameGroup) {
    const distinctGroups = new Set(pool.map((t) => t.group_code)).size;
    if (distinctGroups < SLOT_COUNT) {
      return c.json(
        {
          error: `Aynı grup koşuluyla en az ${SLOT_COUNT} farklı grup gerekiyor (uygun grup: ${distinctGroups})`,
        },
        400,
      );
    }
  } else if (pool.length < SLOT_COUNT) {
    return c.json(
      { error: `Seçilen koşul ve filtrelerle en az ${SLOT_COUNT} takım kalmıyor (havuz: ${pool.length})` },
      400,
    );
  }

  const teamIds = pickTeams(pool, SLOT_COUNT, noSameGroup);
  const { error: rpcError } = await supabase.rpc('trigger_random_selection', {
    p_user_id: user.id,
    p_condition: parsed.data.condition,
    p_tiers: allowedTiers,
    p_no_same_group: noSameGroup,
    p_team_ids: teamIds,
  });
  if (rpcError) throw rpcError;

  const { entry, teams } = await getEntryWithTeams(user.id);
  return c.json({
    isTriggered: entry?.is_triggered ?? true,
    rerollUsed: entry?.reroll_used ?? false,
    condition: entry?.condition,
    allowedTiers: entry?.allowed_tiers,
    noSameGroup: entry?.no_same_group ?? false,
    teams,
  });
});

randomModeRoutes.post('/reroll', async (c) => {
  const user = c.get('user');

  if (!(await isRandomModeEnabledForUser(user.competitionId))) {
    return c.json({ error: 'Rastgele mod şu anda kapalı' }, 403);
  }
  if (await areSelectionsLocked()) {
    return c.json({ error: 'Seçimler kilitlendi, yeniden atama yapılamaz' }, 403);
  }

  const schema = z.object({ slot: z.number().int().min(1).max(SLOT_COUNT) });
  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz slot' }, 400);
  }

  const { data: entry, error: entryError } = await supabase
    .from('random_mode_entries')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (entryError) throw entryError;

  if (!entry?.is_triggered) {
    return c.json({ error: 'Önce rastgele seçim yapmalısınız' }, 400);
  }
  if (entry.reroll_used) {
    return c.json({ error: 'Yeniden atma hakkınızı zaten kullandınız' }, 409);
  }

  const { data: slots, error: slotError } = await supabase
    .from('random_mode_teams')
    .select('team_id, slot, team:teams(group_code)')
    .eq('user_id', user.id);
  if (slotError) throw slotError;
  if (!(slots ?? []).some((s) => s.slot === parsed.data.slot)) {
    return c.json({ error: 'Geçersiz slot' }, 400);
  }

  const currentTeamIds = (slots ?? []).map((s) => s.team_id);
  let pool = await computeEligiblePool(
    user.id,
    user.competitionId,
    entry.condition as RandomCondition,
    entry.allowed_tiers as number[],
    currentTeamIds,
  );

  // With the no-same-group constraint the replacement must also avoid the
  // groups of the two teams that stay; the replaced slot's group frees up.
  if (entry.no_same_group) {
    const otherGroups = new Set(
      (slots ?? [])
        .filter((s) => s.slot !== parsed.data.slot)
        .map((s) => (s.team as unknown as { group_code: string }).group_code),
    );
    pool = pool.filter((t) => !otherGroups.has(t.group_code));
  }

  if (pool.length < 1) {
    return c.json({ error: 'Yeniden atanacak uygun başka takım kalmadı' }, 400);
  }

  const [newTeamId] = pickRandom(pool, 1).map((t) => t.id);
  const { error: rpcError } = await supabase.rpc('reroll_random_selection', {
    p_user_id: user.id,
    p_slot: parsed.data.slot,
    p_new_team_id: newTeamId,
  });
  if (rpcError) throw rpcError;

  const { entry: updated, teams } = await getEntryWithTeams(user.id);
  return c.json({ rerollUsed: updated?.reroll_used ?? true, teams });
});

randomModeRoutes.get('/leaderboard', async (c) => {
  const user = c.get('user');

  // Players only see others within their own competition; unassigned users see
  // an empty leaderboard.
  if (!user.competitionId) {
    return c.json({ entries: [] });
  }

  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('is_admin', false)
    .eq('competition_id', user.competitionId)
    .order('display_name');
  if (userError) throw userError;

  const userIds = (users ?? []).map((u) => u.id);
  if (userIds.length === 0) {
    return c.json({ entries: [] });
  }

  const { data: slots, error: slotError } = await supabase
    .from('random_mode_teams')
    .select('user_id, slot, team:teams(id, name_tr)')
    .in('user_id', userIds)
    .order('slot');
  if (slotError) throw slotError;

  const { data: totals, error: totalError } = await supabase.from('team_total_points').select('*');
  if (totalError) throw totalError;
  const pointsMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  type SlotRow = {
    user_id: string;
    slot: number;
    team: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
  };

  const byUser = new Map<string, SlotRow[]>();
  for (const row of (slots ?? []) as SlotRow[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const entries = (users ?? []).map((u) => {
    const userSlots = byUser.get(u.id) ?? [];
    const teams = userSlots.map((s) => (Array.isArray(s.team) ? s.team[0] ?? null : s.team));
    const totalScore = teams.reduce((sum, team) => sum + (team ? pointsMap.get(team.id) ?? 0 : 0), 0);
    return {
      username: u.username,
      displayName: u.display_name,
      isCurrentUser: u.id === user.id,
      totalScore,
      hasSelections: userSlots.length > 0,
      selections: teams.map((team) => ({
        name: team?.name_tr ?? '—',
        points: team ? pointsMap.get(team.id) ?? 0 : 0,
      })),
    };
  });

  entries.sort((a, b) => b.totalScore - a.totalScore);

  return c.json({ entries: entries.map((e, index) => ({ ...e, rank: index + 1 })) });
});

export default randomModeRoutes;
