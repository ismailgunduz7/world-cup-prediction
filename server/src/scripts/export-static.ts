/**
 * ONE-OFF, READ-ONLY static export.
 *
 * Turnuva bittikten sonra tüm veritabanı içeriğini, herkese açık statik bir
 * siteye gömülecek JSON dosyaları olarak dışa aktarır. Hiçbir tabloyu
 * değiştirmez; yalnızca mevcut servisleri/sorguları okuyup FE'nin beklediği DTO
 * şekillerini üretir. Çalıştırma:  npm run export-static -w server
 *
 * GÜVENLİK: password_hash, refresh_tokens, username ve gerçek e-postalar ASLA
 * dışa aktarılmaz. Oyuncular yalnızca opak `slug` + displayName ile tanınır.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from '../lib/config.js';
import { unwrapOne, toMatchSummary, toPointEntry } from '../lib/serializers.js';
import { getStageLabel } from '../lib/stage-labels.js';
import {
  buildPlayerLeaderboard,
  buildRandomModeLeaderboard,
  loadTeamPointsMap,
} from '../services/leaderboard-service.js';
import { getGroupStandingsSummaries } from '../services/group-standings-service.js';
import { getBestThirdSummary } from '../services/best-third-service.js';
import { getBetProgressSummary } from '../services/bet-progress-service.js';
import { getConfigValue, getSelectionLockAt } from '../services/tournament-config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
// Statik veri iki client'ın da public klasörüne yazılır (build sırasında
// olduğu gibi kopyalanır ve /data/*.json olarak servis edilir).
const CLIENT_DATA = path.join(REPO_ROOT, 'client', 'public', 'data');
const BET_DATA = path.join(REPO_ROOT, 'bet-client', 'public', 'data');

const FIXTURE_STATUSES = ['live', 'scheduled', 'finished', 'postponed'];

/** displayName -> URL-güvenli opak slug (username sızdırmadan link için). */
function slugify(name: string): string {
  const map: Record<string, string> = {
    ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u',
    Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u',
  };
  return name
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function writeJson(dir: string, name: string, data: unknown): Promise<void> {
  await writeFile(path.join(dir, `${name}.json`), JSON.stringify(data), 'utf8');
}

/**
 * Standart yarışma sıralaması ("1224"): eşit skorlular aynı sırayı paylaşır,
 * sonraki sıra atlanır. Örn. 100-90-80-80-70 → 1-2-3-3-5. Girdi skora göre
 * azalan sıralı olmalıdır.
 */
function applyStandardRanks<T>(sorted: T[], scoreOf: (item: T) => number): (T & { rank: number })[] {
  let lastScore: number | null = null;
  let lastRank = 0;
  return sorted.map((item, index) => {
    const score = scoreOf(item);
    const rank = lastScore !== null && score === lastScore ? lastRank : index + 1;
    lastScore = score;
    lastRank = rank;
    return { ...item, rank };
  });
}

async function main() {
  // Temiz başlangıç.
  await rm(CLIENT_DATA, { recursive: true, force: true });
  await mkdir(path.join(CLIENT_DATA, 'players'), { recursive: true });
  await mkdir(path.join(CLIENT_DATA, 'teams'), { recursive: true });
  await mkdir(BET_DATA, { recursive: true });

  // ---- Oyuncu slug haritası (competition + username sızdırmadan) ----
  const { data: players, error: playersError } = await supabase
    .from('users')
    .select('id, username, display_name, competition_id')
    .eq('is_admin', false)
    .order('display_name');
  if (playersError) throw playersError;

  const slugByUserId = new Map<string, string>();
  const usedSlugs = new Set<string>();
  for (const p of players ?? []) {
    let slug = slugify(p.display_name) || 'oyuncu';
    let n = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(p.display_name)}-${n++}`;
    usedSlugs.add(slug);
    slugByUserId.set(p.id, slug);
  }
  // username -> slug (player-points sorgusu username ile çalışıyor).
  const slugByUsername = new Map<string, string>();
  for (const p of players ?? []) slugByUsername.set(p.username, slugByUserId.get(p.id)!);

  // ---- Referans: takımlar + tier'lar + gruplar ----
  const [{ data: tiers }, { data: teams }] = await Promise.all([
    supabase.from('tiers').select('id, name_tr').order('sort_order'),
    supabase
      .from('teams')
      .select('id, name_tr, group_code, tier:tiers(id, name_tr)')
      .eq('is_active', true)
      .order('name_tr'),
  ]);
  type TeamRow = {
    id: number;
    name_tr: string;
    group_code: string;
    tier: { id: number; name_tr: string } | { id: number; name_tr: string }[] | null;
  };
  const teamDtos = ((teams ?? []) as TeamRow[]).map((t) => {
    const tier = unwrapOne(t.tier);
    return { id: t.id, name: t.name_tr, groupCode: t.group_code, tier: tier ? { id: tier.id, name: tier.name_tr } : null };
  });
  const groups = [...new Set(teamDtos.map((t) => t.groupCode))].sort().map((code) => ({
    code,
    teams: teamDtos.filter((t) => t.groupCode === code),
  }));
  const lockAt = await getSelectionLockAt();
  await writeJson(CLIENT_DATA, 'teams', {
    tiers: (tiers ?? []).map((t) => ({ id: t.id, name: t.name_tr })),
    groups,
    meta: { selectionsLocked: true, tournamentStarted: true, selectionLockAt: lockAt?.toISOString() ?? null },
  });

  // ---- Turnuva durumu (artık sabit: bitti) ----
  await writeJson(CLIENT_DATA, 'tournament-status', {
    selectionsLocked: true,
    tournamentStarted: true,
    selectionLockAt: lockAt?.toISOString() ?? null,
    adminPathConfigured: false,
    randomModeEnabled: true,
  });

  // ---- Fikstür (tüm maçlar) ----
  const { data: matchRows, error: matchError } = await supabase
    .from('matches')
    .select(
      'id, stage, group_code, round_label, status, scheduled_at, home_score, away_score, home_score_aet, away_score_aet, home_penalties, away_penalties, winner_team_id, home_team:teams!matches_home_team_id_fkey(id, name_tr), away_team:teams!matches_away_team_id_fkey(id, name_tr)',
    )
    .in('status', FIXTURE_STATUSES)
    .order('scheduled_at', { ascending: true });
  if (matchError) throw matchError;
  const matches = (matchRows ?? []).map((m: Record<string, unknown>) => {
    const homeTeam = unwrapOne(m.home_team as { id: number; name_tr: string } | null);
    const awayTeam = unwrapOne(m.away_team as { id: number; name_tr: string } | null);
    return {
      id: m.id,
      stage: m.stage,
      stageLabel: getStageLabel(m.stage as never),
      groupCode: m.group_code,
      roundLabel: m.round_label,
      status: m.status,
      scheduledAt: m.scheduled_at,
      homeTeam: { id: homeTeam?.id ?? null, name: homeTeam?.name_tr ?? '—' },
      awayTeam: { id: awayTeam?.id ?? null, name: awayTeam?.name_tr ?? '—' },
      homeScore: m.home_score,
      awayScore: m.away_score,
      homeScoreAet: m.home_score_aet,
      awayScoreAet: m.away_score_aet,
      homePenalties: m.home_penalties,
      awayPenalties: m.away_penalties,
      winnerTeamId: m.winner_team_id,
    };
  });
  await writeJson(CLIENT_DATA, 'matches', { matches });

  // ---- Puanlama kuralları ----
  const [{ data: ruleRows }, scoringFlags] = await Promise.all([
    supabase
      .from('tier_scoring_rules')
      .select(
        'id, points, rule_type:scoring_rule_types(id, name_tr, description_tr, sort_order, is_active), tier:tiers(id, name_tr, sort_order)',
      )
      .order('rule_type_id'),
    getConfigValue<{ group_stage_counts_as_round_advancement: boolean; knockout_result_over_120: boolean }>(
      'scoring_flags',
      { group_stage_counts_as_round_advancement: false, knockout_result_over_120: false },
    ),
  ]);
  const rules = ((ruleRows ?? []) as unknown as Array<Record<string, unknown>>)
    .map((rule) => {
      const ruleType = unwrapOne(rule.rule_type as never) as
        | { id: number; name_tr: string; description_tr: string | null; sort_order: number; is_active: boolean }
        | null;
      const tier = unwrapOne(rule.tier as never) as { id: number; name_tr: string; sort_order: number } | null;
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
    .filter((r): r is NonNullable<typeof r> => r !== null && r.ruleType.isActive);
  await writeJson(CLIENT_DATA, 'scoring-rules', { rules, scoringFlags });

  // ---- Grup sıralamaları + en iyi 3.ler (isUserSelection kaldırıldı) ----
  const groupStandings = await getGroupStandingsSummaries();
  const bestThirds = await getBestThirdSummary();
  await writeJson(CLIENT_DATA, 'groups', { groups: groupStandings, bestThirds });

  // ---- Liderlik: takım standings (global) + competition başına oyuncu sıralaması ----
  const pointsMap = await loadTeamPointsMap();
  const { data: standTeams } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(name_tr)')
    .eq('is_active', true);
  const teamStandings = ((standTeams ?? []) as TeamRow[])
    .map((team) => {
      const tier = unwrapOne(team.tier);
      return {
        teamId: team.id,
        name: team.name_tr,
        groupCode: team.group_code,
        tierName: tier?.name_tr ?? null,
        totalPoints: pointsMap.get(team.id) ?? 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name, 'tr'));
  const rankedTeamStandings = applyStandardRanks(teamStandings, (t) => t.totalPoints);

  const { data: competitions, error: compError } = await supabase
    .from('competitions')
    .select('id, name, random_mode_enabled')
    .order('name');
  if (compError) throw compError;

  // username -> slug map için ters çeviri; entry'lerdeki username'i slug ile
  // değiştirip username'i düşürüyoruz.
  const stripEntry = (e: { username: string; displayName: string; rank: number; totalScore: number; hasSelections: boolean; selections: unknown[] }) => ({
    rank: e.rank,
    slug: slugByUsername.get(e.username) ?? slugify(e.displayName),
    displayName: e.displayName,
    totalScore: e.totalScore,
    hasSelections: e.hasSelections,
    selections: e.selections,
  });

  const competitionBlocks = [];
  const usedCompSlugs = new Set<string>();
  for (const comp of competitions ?? []) {
    // Public id, iç UUID yerine okunabilir bir slug (temiz, paylaşılabilir URL
    // `?tab=comp:<slug>`; DB sorguları yine gerçek UUID `comp.id` kullanır).
    let publicId = slugify(comp.name) || 'yarisma';
    let n = 2;
    while (usedCompSlugs.has(publicId)) publicId = `${slugify(comp.name)}-${n++}`;
    usedCompSlugs.add(publicId);

    const realEntries = await buildPlayerLeaderboard(comp.id, null, pointsMap);
    const randomEntries = comp.random_mode_enabled
      ? await buildRandomModeLeaderboard(comp.id, '', pointsMap)
      : [];
    // Servis ranklarını, eşit skorlular aynı sırayı paylaşacak şekilde yeniden ata.
    const rankedReal = applyStandardRanks(realEntries, (e) => e.totalScore);
    const rankedRandom = applyStandardRanks(randomEntries, (e) => e.totalScore);
    competitionBlocks.push({
      id: publicId,
      name: comp.name,
      randomModeEnabled: comp.random_mode_enabled,
      entries: rankedReal.map(stripEntry),
      randomEntries: rankedRandom.map(stripEntry),
    });
  }
  await writeJson(CLIENT_DATA, 'leaderboard', {
    teamStandings: rankedTeamStandings,
    competitions: competitionBlocks,
  });

  // ---- Oyuncu detay panoları (real + random) ----
  for (const player of players ?? []) {
    const slug = slugByUserId.get(player.id)!;
    await writeJson(CLIENT_DATA, `players/${slug}`, await buildPlayerDetail(player.id, player.display_name, 'real'));
    // Random mode her iki competition'da da açık; random detayını da üret.
    await writeJson(CLIENT_DATA, `players/${slug}.random`, await buildPlayerDetail(player.id, player.display_name, 'random'));
  }

  // ---- Takım maç detayları (/takim/:id) ----
  for (const t of teamDtos) {
    await writeJson(CLIENT_DATA, `teams/${t.id}`, await buildTeamDetail(t.id));
  }

  // ---- Bet-progress (bet-client) ----
  const betSummary = await getBetProgressSummary();
  await writeJson(BET_DATA, 'bet-progress', betSummary);

  console.log(`✓ Export tamam.`);
  console.log(`  competitions: ${competitionBlocks.length}, players: ${players?.length}, teams: ${teamDtos.length}, matches: ${matches.length}`);
  console.log(`  → ${CLIENT_DATA}`);
  console.log(`  → ${BET_DATA}`);
  process.exit(0);
}

/** routes/players.ts :username/points mantığının birebir kopyası (opak slug ile). */
async function buildPlayerDetail(userId: string, displayName: string, mode: 'real' | 'random') {
  const { data: selections } =
    mode === 'random'
      ? await supabase
          .from('random_mode_teams')
          .select('team_id, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
          .eq('user_id', userId)
          .order('slot')
      : await supabase
          .from('team_selections')
          .select('team_id, team:teams(id, name_tr, group_code, tier:tiers(name_tr))')
          .eq('user_id', userId)
          .order('selected_at');

  const teamIds = (selections ?? []).map((s) => s.team_id);
  if (teamIds.length === 0) {
    return { player: { displayName, totalScore: 0 }, hasSelections: false, teams: [] };
  }

  const { data: totals } = await supabase.from('team_total_points').select('*').in('team_id', teamIds);
  const pMap = new Map((totals ?? []).map((t) => [t.team_id, Number(t.total_points)]));

  const { data: allPointEntries } = await supabase
    .from('team_point_entries')
    .select('team_id, match_id, points, description_tr, rule_type:scoring_rule_types(code, name_tr)')
    .in('team_id', teamIds)
    .order('earned_at', { nullsFirst: false });
  const entriesByTeam = new Map<number, NonNullable<typeof allPointEntries>>();
  for (const entry of allPointEntries ?? []) {
    const list = entriesByTeam.get(entry.team_id) ?? [];
    list.push(entry);
    entriesByTeam.set(entry.team_id, list);
  }

  const { data: allMatches } = await supabase
    .from('matches')
    .select(
      'id, stage, status, scheduled_at, home_score, away_score, home_score_aet, away_score_aet, home_penalties, away_penalties, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr)',
    )
    .or(`home_team_id.in.(${teamIds.join(',')}),away_team_id.in.(${teamIds.join(',')})`)
    .eq('status', 'finished')
    .order('scheduled_at');
  const matchesByTeam = new Map<number, NonNullable<typeof allMatches>>();
  for (const match of allMatches ?? []) {
    for (const teamId of teamIds) {
      if (match.home_team_id === teamId || match.away_team_id === teamId) {
        const list = matchesByTeam.get(teamId) ?? [];
        list.push(match);
        matchesByTeam.set(teamId, list);
      }
    }
  }

  const teams = (selections ?? []).map((selection) => {
    const raw = unwrapOne(selection.team) as {
      id: number;
      name_tr: string;
      group_code: string;
      tier: { name_tr: string } | { name_tr: string }[] | null;
    };
    const tier = unwrapOne(raw.tier);
    const teamId = raw.id;
    const teamEntries = entriesByTeam.get(teamId) ?? [];
    const pointsByMatch = new Map<number, typeof teamEntries>();
    for (const entry of teamEntries) {
      if (!entry.match_id) continue;
      const list = pointsByMatch.get(entry.match_id) ?? [];
      list.push(entry);
      pointsByMatch.set(entry.match_id, list);
    }
    const finishedMatches = (matchesByTeam.get(teamId) ?? []).map((match) =>
      toMatchSummary(match as never, (pointsByMatch.get(match.id) ?? []) as never),
    );
    const bonusEntries = teamEntries.filter((e) => e.match_id === null).map((e) => toPointEntry(e as never));
    return {
      team: { id: teamId, name: raw.name_tr, groupCode: raw.group_code, tierName: tier?.name_tr ?? null, totalPoints: pMap.get(teamId) ?? 0 },
      finishedMatches,
      bonusEntries,
    };
  });

  const totalScore = teams.reduce((sum, t) => sum + t.team.totalPoints, 0);
  return { player: { displayName, totalScore }, hasSelections: true, teams };
}

/** routes/teams.ts :id/matches mantığının birebir kopyası. */
async function buildTeamDetail(teamId: number) {
  const { data: team } = await supabase
    .from('teams')
    .select('id, name_tr, group_code, tier:tiers(name_tr)')
    .eq('id', teamId)
    .eq('is_active', true)
    .maybeSingle();
  if (!team) return null;
  const tier = Array.isArray(team.tier) ? team.tier[0] ?? null : team.tier;

  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, stage, status, scheduled_at, home_score, away_score, home_score_aet, away_score_aet, home_penalties, away_penalties, home_team:teams!matches_home_team_id_fkey(name_tr), away_team:teams!matches_away_team_id_fkey(name_tr)',
    )
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .order('scheduled_at');

  const { data: allTeamPoints } = await supabase
    .from('team_point_entries')
    .select('match_id, points, description_tr, rule_type:scoring_rule_types(code, name_tr)')
    .eq('team_id', teamId)
    .order('earned_at', { nullsFirst: false });
  const pointsByMatch = new Map<number, NonNullable<typeof allTeamPoints>>();
  for (const entry of allTeamPoints ?? []) {
    if (!entry.match_id) continue;
    const list = pointsByMatch.get(entry.match_id) ?? [];
    list.push(entry);
    pointsByMatch.set(entry.match_id, list);
  }
  const matchDtos = (matches ?? []).map((match) =>
    toMatchSummary(match as never, (pointsByMatch.get(match.id) ?? []) as never),
  );
  const bonusEntries = (allTeamPoints ?? []).filter((e) => e.match_id === null).map((e) => toPointEntry(e as never));
  const totalPoints = (allTeamPoints ?? []).reduce((sum, e) => sum + Number(e.points), 0);

  return {
    team: { name: team.name_tr, groupCode: team.group_code, tierName: tier?.name_tr ?? null },
    totalPoints,
    matches: matchDtos,
    bonusEntries,
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
