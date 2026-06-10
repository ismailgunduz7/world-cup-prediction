import { Hono } from 'hono';
import { z } from 'zod';
import { supabase } from '../lib/config.js';
import { authMiddleware, adminMiddleware, type AppVariables } from '../middleware/auth.js';
import { createUser, deleteUser, updateUser } from '../services/auth-service.js';
import {
  finalizeGroupRankings,
  rebuildGroupStandingsFromMatches,
  rebuildGroupStandingsPreservingFinalization,
  recalculateAllPoints,
  setGroupRankingsManually,
  syncKnockoutAdvancementFromMatch,
} from '../services/scoring-engine.js';
import { setConfigValue } from '../services/tournament-config.js';
import { getGroupStandingsSummaries } from '../services/group-standings-service.js';
import { buildPlayerLeaderboard } from '../services/leaderboard-service.js';
import {
  computeBestThirdRankings,
  getBestThirdSummary,
  maybeAutoComputeBestThirdRankings,
  setBestThirdRankingsManually,
} from '../services/best-third-service.js';
import {
  getEligibleTeamsForStage,
  getRoundOf32QualifierCount,
  validateTeamsEligibleForStage,
} from '../services/knockout-eligibility-service.js';
import {
  generateKnockoutBracket,
  hasKnockoutBracket,
  maybeGenerateKnockoutBracket,
  maybeSyncKnockoutRoundOf32,
  syncKnockoutRoundOf32,
  syncBracketFromMatchResult,
} from '../services/knockout-bracket-service.js';
import type { MatchRow, MatchStage } from '../lib/types.js';

const adminRoutes = new Hono<{ Variables: AppVariables }>();

adminRoutes.use('*', authMiddleware, adminMiddleware);

adminRoutes.get('/dashboard', async (c) => {
  const [{ data: users }, { data: rules }, { data: config }, { count: matchCount }, { data: competitions }] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, username, display_name, is_admin, competition_id, created_at')
        .order('created_at'),
      supabase.from('tier_scoring_rules').select('*, rule_type:scoring_rule_types(*), tier:tiers(*)').order('rule_type_id'),
      supabase.from('tournament_config').select('*').order('key'),
      supabase.from('matches').select('*', { count: 'exact', head: true }),
      supabase.from('competitions').select('*').order('created_at'),
    ]);

  return c.json({
    users: users ?? [],
    rules: rules ?? [],
    config: config ?? [],
    matchCount: matchCount ?? 0,
    competitions: competitions ?? [],
  });
});

adminRoutes.post('/users', async (c) => {
  const schema = z.object({
    username: z.string().min(2).max(50),
    password: z.string().min(6).max(128),
    displayName: z.string().min(2).max(100),
    isAdmin: z.boolean().optional(),
    competitionId: z.string().uuid().nullable().optional(),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz kullanıcı bilgileri' }, 400);
  }

  if (parsed.data.competitionId && !(await competitionExists(parsed.data.competitionId))) {
    return c.json({ error: 'Geçersiz yarışma' }, 400);
  }

  try {
    const user = await createUser(parsed.data);
    return c.json({ user }, 201);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Kullanıcı oluşturulamadı' }, 400);
  }
});

const updateUserSchema = z
  .object({
    username: z.string().min(2).max(50),
    displayName: z.string().min(2).max(100),
    isAdmin: z.boolean(),
    password: z.string().max(128).optional(),
    competitionId: z.string().uuid().nullable().optional(),
  })
  .refine((data) => !data.password || data.password.length === 0 || data.password.length >= 6, {
    message: 'Şifre en az 6 karakter olmalıdır',
    path: ['password'],
  });

adminRoutes.put('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const currentAdmin = c.get('user');

  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz kullanıcı bilgileri' }, 400);
  }

  if (userId === currentAdmin.id && !parsed.data.isAdmin) {
    return c.json({ error: 'Kendi yönetici yetkinizi kaldıramazsınız' }, 400);
  }

  if (parsed.data.competitionId && !(await competitionExists(parsed.data.competitionId))) {
    return c.json({ error: 'Geçersiz yarışma' }, 400);
  }

  try {
    const user = await updateUser(userId, parsed.data);
    return c.json({ user });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Kullanıcı güncellenemedi' }, 400);
  }
});

adminRoutes.delete('/users/:id', async (c) => {
  const userId = c.req.param('id');
  const currentAdmin = c.get('user');

  if (userId === currentAdmin.id) {
    return c.json({ error: 'Kendi hesabınızı silemezsiniz' }, 400);
  }

  try {
    await deleteUser(userId);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Kullanıcı silinemedi' }, 400);
  }
});

// --- Competitions -----------------------------------------------------------

async function competitionExists(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('competitions').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return !!data;
}

const competitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Anahtar yalnızca küçük harf, rakam ve tire içerebilir'),
  name: z.string().trim().min(2).max(100),
  randomModeEnabled: z.boolean().optional().default(false),
});

adminRoutes.get('/competitions', async (c) => {
  const [{ data: competitions, error: compError }, { data: members, error: memberError }] =
    await Promise.all([
      supabase.from('competitions').select('*').order('created_at'),
      supabase.from('users').select('competition_id').eq('is_admin', false),
    ]);

  if (compError) throw compError;
  if (memberError) throw memberError;

  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.competition_id) counts.set(m.competition_id, (counts.get(m.competition_id) ?? 0) + 1);
  }

  return c.json({
    competitions: (competitions ?? []).map((comp) => ({
      ...comp,
      memberCount: counts.get(comp.id) ?? 0,
    })),
  });
});

adminRoutes.post('/competitions', async (c) => {
  const parsed = competitionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz yarışma bilgisi' }, 400);
  }

  const { data, error } = await supabase
    .from('competitions')
    .insert({
      key: parsed.data.key,
      name: parsed.data.name,
      random_mode_enabled: parsed.data.randomModeEnabled,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Bu anahtar zaten kullanılıyor' }, 400);
    throw error;
  }

  return c.json({ competition: data }, 201);
});

adminRoutes.put('/competitions/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = competitionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Geçersiz yarışma bilgisi' }, 400);
  }

  const { data, error } = await supabase
    .from('competitions')
    .update({
      key: parsed.data.key,
      name: parsed.data.name,
      random_mode_enabled: parsed.data.randomModeEnabled,
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Bu anahtar zaten kullanılıyor' }, 400);
    throw error;
  }
  if (!data) return c.json({ error: 'Yarışma bulunamadı' }, 404);

  return c.json({ competition: data });
});

adminRoutes.delete('/competitions/:id', async (c) => {
  const id = c.req.param('id');
  // Members are detached automatically via the ON DELETE SET NULL foreign key.
  const { error } = await supabase.from('competitions').delete().eq('id', id);
  if (error) throw error;
  return c.json({ success: true });
});

// Admin monitoring: view a competition's leaderboard exactly as its players see it.
adminRoutes.get('/competitions/:id/leaderboard', async (c) => {
  const id = c.req.param('id');
  if (!(await competitionExists(id))) {
    return c.json({ error: 'Yarışma bulunamadı' }, 404);
  }
  const entries = await buildPlayerLeaderboard(id, null);
  return c.json({ entries });
});

adminRoutes.put('/rules/bulk', async (c) => {
  const schema = z.object({
    updates: z
      .array(
        z.object({
          id: z.number(),
          points: z.number(),
        }),
      )
      .min(1),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz kural listesi' }, 400);
  }

  for (const update of parsed.data.updates) {
    const { error } = await supabase
      .from('tier_scoring_rules')
      .update({ points: update.points })
      .eq('id', update.id);

    if (error) throw error;
  }

  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.put('/rules/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const schema = z.object({
    points: z.number(),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Geçersiz kural' }, 400);
  }

  const { error } = await supabase
    .from('tier_scoring_rules')
    .update({
      points: parsed.data.points,
    })
    .eq('id', id);

  if (error) throw error;

  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.put('/rule-types/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const schema = z.object({ isActive: z.boolean() });
  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz istek' }, 400);

  const { error } = await supabase
    .from('scoring_rule_types')
    .update({ is_active: parsed.data.isActive })
    .eq('id', id);

  if (error) throw error;

  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.put('/config/:key', async (c) => {
  const key = c.req.param('key');
  const body = await c.req.json();
  if (!body.value || typeof body.value !== 'object') {
    return c.json({ error: 'Geçersiz config değeri' }, 400);
  }

  if (key === 'selection_lock') {
    const schema = z.object({
      mode: z.enum(['before_first_match', 'manual']),
      offset_hours: z.number().min(0).max(168),
    });
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return c.json({ error: 'Geçersiz seçim kilidi ayarı' }, 400);
    await setConfigValue(key, parsed.data);
    return c.json({ success: true });
  }

  if (key === 'selection_lock_manual') {
    const schema = z.object({
      locked_at: z.string().datetime().nullable(),
    });
    const parsed = schema.safeParse(body.value);
    if (!parsed.success) return c.json({ error: 'Geçersiz kilit tarihi' }, 400);
    await setConfigValue(key, parsed.data);
    return c.json({ success: true });
  }

  await setConfigValue(key, body.value);

  if (key === 'scoring_flags') {
    const result = await recalculateAllPoints();
    return c.json({ success: true, recalculated: result });
  }

  return c.json({ success: true });
});

adminRoutes.post('/recalculate', async (c) => {
  const result = await recalculateAllPoints();
  return c.json({ success: true, ...result });
});

adminRoutes.get('/teams', async (c) => {
  const { data, error } = await supabase
    .from('teams')
    .select('id, name_tr, group_code')
    .eq('is_active', true)
    .order('name_tr');

  if (error) throw error;
  return c.json({ teams: data ?? [] });
});

adminRoutes.get('/teams/eligible', async (c) => {
  const stage = c.req.query('stage');
  const schema = z.enum([
    'group',
    'round_of_32',
    'round_of_16',
    'quarter_final',
    'semi_final',
    'third_place',
    'final',
  ]);

  const parsed = schema.safeParse(stage);
  if (!parsed.success) return c.json({ error: 'Geçersiz tur' }, 400);

  const teams = await getEligibleTeamsForStage(parsed.data as MatchStage);
  const qualifierCount =
    parsed.data === 'round_of_32' ? await getRoundOf32QualifierCount() : null;

  return c.json({
    teams,
    stage: parsed.data,
    qualifierCount,
    requiredQualifiers: parsed.data === 'round_of_32' ? 32 : null,
  });
});

adminRoutes.get('/matches', async (c) => {
  const { data, error } = await supabase
    .from('matches')
    .select('*, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)')
    .order('scheduled_at');

  if (error) throw error;
  return c.json({ matches: data ?? [] });
});

adminRoutes.post('/matches', async (c) => {
  const schema = z.object({
    homeTeamId: z.number().int(),
    awayTeamId: z.number().int(),
    stage: z.enum(['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']),
    groupCode: z.string().length(1).optional(),
    roundLabel: z.string().optional(),
    scheduledAt: z.string().datetime(),
    externalId: z.string().optional(),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz maç bilgisi' }, 400);

  const eligibilityError = await validateTeamsEligibleForStage(
    parsed.data.stage as MatchStage,
    parsed.data.homeTeamId,
    parsed.data.awayTeamId,
  );
  if (eligibilityError) return c.json({ error: eligibilityError }, 400);

  const { data, error } = await supabase
    .from('matches')
    .insert({
      home_team_id: parsed.data.homeTeamId,
      away_team_id: parsed.data.awayTeamId,
      stage: parsed.data.stage,
      group_code: parsed.data.groupCode ?? null,
      round_label: parsed.data.roundLabel ?? null,
      scheduled_at: parsed.data.scheduledAt,
      external_id: parsed.data.externalId ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return c.json({ match: data }, 201);
});

adminRoutes.put('/matches/:id/result', async (c) => {
  const id = Number(c.req.param('id'));
  const schema = z.object({
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0),
    status: z.enum(['finished', 'live', 'scheduled', 'postponed', 'cancelled']).optional(),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz skor' }, 400);

  const { data: existing } = await supabase.from('matches').select('*').eq('id', id).single();
  if (!existing) return c.json({ error: 'Maç bulunamadı' }, 404);

  if (existing.stage !== 'group' && existing.home_team_id && existing.away_team_id) {
    const eligibilityError = await validateTeamsEligibleForStage(
      existing.stage,
      existing.home_team_id,
      existing.away_team_id,
    );
    if (eligibilityError) {
      return c.json({ error: eligibilityError }, 400);
    }
  }

  if (parsed.data.homeScore === parsed.data.awayScore && existing.stage !== 'group') {
    return c.json({ error: 'Eleme maçlarında beraberlik olamaz' }, 400);
  }

  const winner =
    parsed.data.homeScore > parsed.data.awayScore
      ? existing.home_team_id
      : parsed.data.awayScore > parsed.data.homeScore
        ? existing.away_team_id
        : null;

  const { data: match, error } = await supabase
    .from('matches')
    .update({
      home_score: parsed.data.homeScore,
      away_score: parsed.data.awayScore,
      winner_team_id: winner,
      status: parsed.data.status ?? 'finished',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  const matchRow = match as MatchRow;
  if (matchRow.stage === 'group') {
    await rebuildGroupStandingsPreservingFinalization();
    await maybeAutoComputeBestThirdRankings();
    await maybeSyncKnockoutRoundOf32();
  }
  await syncKnockoutAdvancementFromMatch(matchRow);
  await syncBracketFromMatchResult(matchRow);
  const result = await recalculateAllPoints();

  return c.json({ match, recalculated: result });
});

adminRoutes.delete('/matches/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return c.json({ error: 'Geçersiz maç' }, 400);
  }

  const { data: existing, error: findError } = await supabase
    .from('matches')
    .select('id, stage')
    .eq('id', id)
    .maybeSingle();

  if (findError) throw findError;
  if (!existing) return c.json({ error: 'Maç bulunamadı' }, 404);

  const { error } = await supabase.from('matches').delete().eq('id', id);
  if (error) throw error;

  if (existing.stage === 'group') {
    await rebuildGroupStandingsPreservingFinalization();
    await maybeAutoComputeBestThirdRankings();
    await maybeSyncKnockoutRoundOf32();
  }

  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.get('/groups', async (c) => {
  const groups = await getGroupStandingsSummaries();

  return c.json({
    groups: groups.map((group) => ({
      ...group,
      canFinalize: group.totalMatches > 0 && group.finishedMatches === group.totalMatches,
    })),
  });
});

adminRoutes.post('/groups/rebuild-standings', async (c) => {
  await rebuildGroupStandingsFromMatches();
  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.post('/groups/:code/finalize', async (c) => {
  const code = c.req.param('code').toUpperCase();

  const { data: groupMatches, error: matchError } = await supabase
    .from('matches')
    .select('id, status')
    .eq('stage', 'group')
    .eq('group_code', code);

  if (matchError) throw matchError;

  if (!groupMatches?.length) {
    return c.json({ error: `Grup ${code} için maç bulunamadı` }, 404);
  }

  const unfinished = groupMatches.filter((match) => match.status !== 'finished');
  if (unfinished.length > 0) {
    return c.json(
      { error: `Grup ${code}: ${unfinished.length} maç henüz bitmedi. Tüm maçlar tamamlanmadan finalize edilemez.` },
      400,
    );
  }

  const forceAuto = c.req.query('forceAuto') === 'true';

  await finalizeGroupRankings(code, { forceAuto });
  await maybeAutoComputeBestThirdRankings();
  await maybeGenerateKnockoutBracket();
  await maybeSyncKnockoutRoundOf32();
  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.get('/groups/best-thirds', async (c) => {
  const summary = await getBestThirdSummary();
  return c.json({ bestThirds: summary });
});

adminRoutes.post('/groups/best-thirds/compute', async (c) => {
  try {
    await computeBestThirdRankings();
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Hesaplanamadı' }, 400);
  }

  const summary = await getBestThirdSummary();
  return c.json({ success: true, bestThirds: summary });
});

adminRoutes.put('/groups/best-thirds/rankings', async (c) => {
  const schema = z.object({
    teamIds: z.array(z.number().int()).min(1),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz sıralama' }, 400);

  try {
    await setBestThirdRankingsManually(parsed.data.teamIds);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sıralama kaydedilemedi' }, 400);
  }

  if (await hasKnockoutBracket()) {
    await syncKnockoutRoundOf32();
  } else {
    await maybeGenerateKnockoutBracket();
  }

  const summary = await getBestThirdSummary();
  return c.json({ success: true, bestThirds: summary });
});

adminRoutes.put('/groups/:code/rankings', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const schema = z.object({
    teamIds: z.array(z.number().int()).min(1),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz sıralama' }, 400);

  try {
    await setGroupRankingsManually(code, parsed.data.teamIds);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Sıralama kaydedilemedi' }, 400);
  }

  await maybeAutoComputeBestThirdRankings();
  await maybeGenerateKnockoutBracket();
  await maybeSyncKnockoutRoundOf32();
  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

adminRoutes.post('/knockout-bracket/sync', async (c) => {
  try {
    const result = await syncKnockoutRoundOf32();
    const recalculated = await recalculateAllPoints();
    return c.json({ success: true, ...result, recalculated });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Senkronizasyon başarısız' }, 400);
  }
});

adminRoutes.post('/knockout-bracket/generate', async (c) => {
  try {
    const result = await generateKnockoutBracket();
    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Turnuva ağacı oluşturulamadı' }, 400);
  }
});

adminRoutes.get('/knockout-bracket/status', async (c) => {
  const exists = await hasKnockoutBracket();
  return c.json({ exists });
});

adminRoutes.post('/advancements', async (c) => {
  const schema = z.object({
    teamId: z.number().int(),
    stage: z.enum(['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'final']),
    matchId: z.number().int().optional(),
    advancedAt: z.string().datetime().optional(),
  });

  const body = await c.req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Geçersiz veri' }, 400);

  const sourceKey = `advance:${parsed.data.stage}:${parsed.data.teamId}:manual`;
  const { error } = await supabase.from('knockout_advancements').upsert(
    {
      team_id: parsed.data.teamId,
      stage: parsed.data.stage,
      match_id: parsed.data.matchId ?? null,
      source_key: sourceKey,
      advanced_at: parsed.data.advancedAt ?? new Date().toISOString(),
    },
    { onConflict: 'source_key' },
  );

  if (error) throw error;
  const result = await recalculateAllPoints();
  return c.json({ success: true, recalculated: result });
});

// Random mode oversight: list every player's random entry + assigned teams,
// and allow resetting a single player's random selection.
adminRoutes.get('/random-selections', async (c) => {
  const [{ data: entries, error: entryError }, { data: slots, error: slotError }] = await Promise.all([
    supabase
      .from('random_mode_entries')
      .select(
        'user_id, condition, allowed_tiers, no_same_group, is_triggered, reroll_used, reroll_slot, updated_at, user:users(username, display_name), reroll_from:teams!reroll_from_team_id(name_tr), reroll_to:teams!reroll_to_team_id(name_tr)',
      )
      .order('updated_at', { ascending: false }),
    supabase
      .from('random_mode_teams')
      .select('user_id, slot, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
      .order('slot'),
  ]);

  if (entryError) throw entryError;
  if (slotError) throw slotError;

  const teamsByUser = new Map<string, unknown[]>();
  for (const row of slots ?? []) {
    const list = teamsByUser.get(row.user_id) ?? [];
    list.push({ slot: row.slot, team: row.team });
    teamsByUser.set(row.user_id, list);
  }

  const rows = (entries ?? []).map((e) => ({
    userId: e.user_id,
    username: (e.user as { username?: string } | null)?.username ?? null,
    displayName: (e.user as { display_name?: string } | null)?.display_name ?? null,
    condition: e.condition,
    allowedTiers: e.allowed_tiers,
    noSameGroup: e.no_same_group,
    isTriggered: e.is_triggered,
    rerollUsed: e.reroll_used,
    updatedAt: e.updated_at,
    teams: teamsByUser.get(e.user_id) ?? [],
    reroll: e.reroll_used
      ? {
          slot: e.reroll_slot,
          fromTeam: (e.reroll_from as { name_tr?: string } | null)?.name_tr ?? null,
          toTeam: (e.reroll_to as { name_tr?: string } | null)?.name_tr ?? null,
        }
      : null,
  }));

  return c.json({ rows });
});

adminRoutes.delete('/random-selections/:userId', async (c) => {
  const userId = c.req.param('userId');

  const { error: teamError } = await supabase.from('random_mode_teams').delete().eq('user_id', userId);
  if (teamError) throw teamError;

  const { error: entryError } = await supabase.from('random_mode_entries').delete().eq('user_id', userId);
  if (entryError) throw entryError;

  return c.json({ success: true });
});

export default adminRoutes;
