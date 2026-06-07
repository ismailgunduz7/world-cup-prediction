import '../lib/load-env.js';
import { supabase } from '../lib/config.js';
import type { MatchRow } from '../lib/types.js';
import {
  generateRealisticMatchScore,
} from './realistic-match-scores.js';
import { clearBestThirdRankings, maybeAutoComputeBestThirdRankings } from '../services/best-third-service.js';
import { maybeGenerateKnockoutBracket, syncBracketFromMatchResult } from '../services/knockout-bracket-service.js';
import {
  finalizeGroupRankings,
  rebuildGroupStandingsFromMatches,
  recalculateAllPoints,
  resetGroupStandingsValues,
  syncKnockoutAdvancementFromMatch,
  updateGroupStandingsFromMatch,
} from '../services/scoring-engine.js';

const GROUP_CODES = 'ABCDEFGHIJKL'.split('');
const MAX_SELECTIONS = 3;

type Options = {
  selections: boolean;
  matchdays: number[];
  reset: boolean;
  resetOnly: boolean;
  resetKnockout: boolean;
  clearSelections: boolean;
  dryRun: boolean;
  skipFinalize: boolean;
  realistic: boolean;
  withKnockout: boolean;
};

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    selections: true,
    matchdays: [1, 2, 3],
    reset: false,
    resetOnly: false,
    resetKnockout: false,
    clearSelections: false,
    dryRun: false,
    skipFinalize: false,
    realistic: false,
    withKnockout: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--skip-selections') opts.selections = false;
    else if (arg === '--skip-finalize') opts.skipFinalize = true;
    else if (arg === '--realistic') opts.realistic = true;
    else if (arg === '--with-knockout') opts.withKnockout = true;
    else if (arg === '--reset-knockout') opts.resetKnockout = true;
    else if (arg === '--keep-knockout') opts.resetKnockout = false;
    else if (arg === '--reset-only') {
      opts.resetOnly = true;
      opts.reset = true;
      opts.selections = false;
      opts.matchdays = [];
    } else if (arg === '--clear-selections') opts.clearSelections = true;
    else if (arg === '--reset') opts.reset = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--matchday') {
      const value = argv[++i];
      if (!value) throw new Error('--matchday için 1, 2 veya 3 belirtin');
      const day = Number(value);
      if (![1, 2, 3].includes(day)) throw new Error('Maç haftası yalnızca 1, 2 veya 3 olabilir');
      opts.matchdays = [day];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Bilinmeyen argüman: ${arg}`);
    }
  }

  if (opts.resetOnly && !argv.includes('--keep-knockout') && !argv.includes('--reset-knockout')) {
    opts.resetKnockout = true;
  }

  return opts;
}

function printHelp() {
  console.log(`
Kullanım:
  npm run seed-test-data -- --reset                    (sıfırla + test verisi doldur)
  npm run reset-tournament --                          (grup + eleme sıfırla, yarışmaya hazırla)
  npm run reset-tournament -- --clear-selections       (sıfırla + seçimleri sil)
  npm run reset-tournament -- --keep-knockout          (eleme maçlarını koru)
  cd server && npm run seed-test-data -- --reset-only

Seçenekler:
  --reset-only        Grup aşamasını sıfırla; maç skoru girme, seçim atama
  --reset-knockout    Eleme maçlarını (M73–M104) sil (--reset ile birlikte)
  --keep-knockout     --reset-only ile eleme maçlarını silme
  --clear-selections  Oyuncu takım seçimlerini de sil (--reset-only ile birlikte)
  --skip-selections   Rastgele takım seçimi yapma
  --skip-finalize     Maç skorları girilsin ama gruplar finalize edilmesin
  --realistic         Tier farkına göre gerçekçi skorlar (favori daha sık kazanır)
  --with-knockout     Grup sonrası varsa eleme maçlarını da oynat
  --matchday 1|2|3    Yalnızca belirtilen maç haftasını oynat (varsayılan: 1+2+3)
  --reset             Grup maç skorlarını ve puan durumunu sıfırla (sonrasında maç oynatır)
  --dry-run           Değişiklik yapmadan ne yapılacağını göster
  --help, -h          Bu yardım metni

Sıfırlama (--reset / --reset-only) şunları temizler:
  • Grup maç skorları (scheduled durumuna döner)
  • Grup puan tabloları
  • Takım puan kayıtları ve eleme turu ilerlemeleri
  • En iyi 3.ler sıralaması
  • Eleme maçları (--reset-only varsayılan; --reset-knockout ile --reset'te de)

Maç haftaları:
  1 → tüm gruplardaki 1. ve 2. maçlar (24 maç)
  2 → tüm gruplardaki 3. ve 4. maçlar (24 maç)
  3 → tüm gruplardaki 5. ve 6. maçlar (24 maç); sonrasında gruplar finalize edilir (--skip-finalize ile atlanır)
`);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomScore(): number {
  return Math.floor(Math.random() * 5);
}

async function loadTeamTiers(): Promise<Map<number, number>> {
  const { data, error } = await supabase.from('teams').select('id, tier_id');
  if (error) throw error;
  return new Map((data ?? []).map((team) => [team.id, team.tier_id]));
}

function generateMatchScores(
  match: MatchRow,
  teamTiers: Map<number, number>,
  realistic: boolean,
): { homeScore: number; awayScore: number } {
  if (!realistic) {
    return { homeScore: randomScore(), awayScore: randomScore() };
  }

  if (match.home_team_id === null || match.away_team_id === null) {
    return { homeScore: randomScore(), awayScore: randomScore() };
  }

  const homeTier = teamTiers.get(match.home_team_id);
  const awayTier = teamTiers.get(match.away_team_id);
  if (homeTier === undefined || awayTier === undefined) {
    return { homeScore: randomScore(), awayScore: randomScore() };
  }

  return generateRealisticMatchScore(homeTier, awayTier);
}

function getMatchNumber(roundLabel: string | null): number | null {
  if (!roundLabel) return null;
  const match = roundLabel.match(/(\d+)\.\s*Maç/u);
  return match ? Number(match[1]) : null;
}

function getMatchday(roundLabel: string | null): number | null {
  const matchNumber = getMatchNumber(roundLabel);
  if (!matchNumber) return null;
  return Math.ceil(matchNumber / 2);
}

async function resetGroupStage() {
  console.log('Grup aşaması sıfırlanıyor...');

  const { error: matchError } = await supabase
    .from('matches')
    .update({
      home_score: null,
      away_score: null,
      winner_team_id: null,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('stage', 'group');

  if (matchError) throw matchError;

  await resetGroupStandingsValues();

  await clearBestThirdRankings();

  const { data: staleStandings, error: verifyError } = await supabase
    .from('group_standings')
    .select('team_id, played')
    .gt('played', 0);

  if (verifyError) throw verifyError;
  if ((staleStandings ?? []).length > 0) {
    throw new Error('Grup puan durumu sıfırlanamadı');
  }

  const { error: pointsError } = await supabase.from('team_point_entries').delete().gte('id', 1);
  if (pointsError) throw pointsError;

  const { error: knockoutError } = await supabase.from('knockout_advancements').delete().gte('id', 1);
  if (knockoutError) throw knockoutError;

  console.log('Grup maçları, puan durumları ve puan kayıtları sıfırlandı.');
}

async function clearKnockoutMatches(): Promise<number> {
  const { count, error: countError } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .neq('stage', 'group');

  if (countError) throw countError;

  if (!count) {
    console.log('Silinecek eleme maçı yok.');
    return 0;
  }

  const { error } = await supabase.from('matches').delete().neq('stage', 'group');
  if (error) throw error;

  console.log(`${count} eleme maçı silindi.`);
  return count;
}

async function clearAllSelections() {
  const { count, error: countError } = await supabase
    .from('team_selections')
    .select('*', { count: 'exact', head: true });

  if (countError) throw countError;

  if (!count) {
    console.log('Silinecek takım seçimi yok.');
    return;
  }

  const { error } = await supabase.from('team_selections').delete().gte('id', 1);
  if (error) throw error;

  console.log(`${count} takım seçimi silindi.`);
}

async function assignRandomSelections(dryRun: boolean) {
  const [{ data: users, error: userError }, { data: teams, error: teamError }] = await Promise.all([
    supabase.from('users').select('id, username, display_name').eq('is_admin', false).order('username'),
    supabase.from('teams').select('id, name_tr').eq('is_active', true),
  ]);

  if (userError) throw userError;
  if (teamError) throw teamError;

  if (!users?.length) {
    console.log('Katılımcı kullanıcı bulunamadı. Seçim atlanıyor.');
    return;
  }

  if ((teams ?? []).length < MAX_SELECTIONS) {
    throw new Error(`En az ${MAX_SELECTIONS} takım gerekli`);
  }

  console.log(`\n${users.length} kullanıcı için rastgele takım seçimi:`);

  for (const user of users) {
    const picked = shuffle(teams ?? []).slice(0, MAX_SELECTIONS);
    const names = picked.map((t) => t.name_tr).join(', ');
    console.log(`  • ${user.display_name} (@${user.username}): ${names}`);

    if (dryRun) continue;

    const { error: deleteError } = await supabase.from('team_selections').delete().eq('user_id', user.id);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from('team_selections').insert(
      picked.map((team) => ({
        user_id: user.id,
        team_id: team.id,
      })),
    );

    if (insertError) throw insertError;
  }
}

async function loadGroupMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'group')
    .order('scheduled_at');

  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

async function assertPreviousMatchdayFinished(matchday: number, matches: MatchRow[]) {
  if (matchday <= 1) return;

  const previousMatchday = matchday - 1;
  const pending = matches.filter((match) => {
    const day = getMatchday(match.round_label);
    return day === previousMatchday && match.status !== 'finished';
  });

  if (pending.length > 0) {
    throw new Error(
      `Maç haftası ${matchday} için önce hafta ${previousMatchday} tamamlanmalı (${pending.length} maç bitmemiş).`,
    );
  }
}

async function finishMatch(
  match: MatchRow,
  homeScore: number,
  awayScore: number,
  dryRun: boolean,
  skipFinished: boolean,
) {
  if (skipFinished && match.status === 'finished') {
    console.log(`  ${match.round_label ?? `Maç #${match.id}`}: atlandı (zaten bitti)`);
    return;
  }

  const winner =
    homeScore > awayScore ? match.home_team_id : awayScore > homeScore ? match.away_team_id : null;

  const outcomeNote =
    homeScore === awayScore
      ? ' (beraberlik)'
      : winner === null
        ? ' (takım atanmadı)'
        : '';

  console.log(
    `  ${match.round_label ?? `Maç #${match.id}`}: ${homeScore}-${awayScore}${outcomeNote}`,
  );

  if (dryRun) return;

  const { data: updated, error } = await supabase
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winner,
      status: 'finished',
      updated_at: new Date().toISOString(),
    })
    .eq('id', match.id)
    .select('*')
    .single();

  if (error) throw error;

  const matchRow = updated as MatchRow;
  await updateGroupStandingsFromMatch(matchRow);
  await syncKnockoutAdvancementFromMatch(matchRow);
  await syncBracketFromMatchResult(matchRow);
}

async function playMatchday(
  matchday: number,
  teamTiers: Map<number, number>,
  realistic: boolean,
  dryRun: boolean,
  skipFinished: boolean,
) {
  const matches = await loadGroupMatches();
  const dayMatches = matches.filter((match) => getMatchday(match.round_label) === matchday);

  if (dayMatches.length === 0) {
    console.log(`Maç haftası ${matchday}: oynatılacak maç bulunamadı.`);
    return;
  }

  await assertPreviousMatchdayFinished(matchday, matches);

  console.log(`\nMaç haftası ${matchday} (${dayMatches.length} maç)${realistic ? ' [gerçekçi]' : ''}:`);

  for (const match of dayMatches) {
    const { homeScore, awayScore } = generateMatchScores(match, teamTiers, realistic);
    await finishMatch(match, homeScore, awayScore, dryRun, skipFinished);
  }

  if (!dryRun) {
    await rebuildGroupStandingsFromMatches();
    const result = await recalculateAllPoints();
    console.log(`  → Puanlar yeniden hesaplandı (${result.entriesCount} kayıt)`);
  }
}

async function loadKnockoutMatches(): Promise<MatchRow[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .neq('stage', 'group')
    .order('bracket_match_number');

  if (error) throw error;
  return (data ?? []) as MatchRow[];
}

async function reloadMatch(matchId: number): Promise<MatchRow | null> {
  const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
  if (error) throw error;
  return (data as MatchRow | null) ?? null;
}

function ensureKnockoutWinner(
  match: MatchRow,
  homeScore: number,
  awayScore: number,
): { homeScore: number; awayScore: number } {
  if (match.stage === 'group' || homeScore !== awayScore) {
    return { homeScore, awayScore };
  }

  if (Math.random() < 0.5) {
    return { homeScore: homeScore + 1, awayScore };
  }

  return { homeScore, awayScore: awayScore + 1 };
}

async function playKnockoutMatches(
  teamTiers: Map<number, number>,
  realistic: boolean,
  dryRun: boolean,
  skipFinished: boolean,
) {
  const matches = await loadKnockoutMatches();

  if (matches.length === 0) {
    console.log('\nEleme maçı bulunamadı (--with-knockout atlandı).');
    return;
  }

  const toPlay = skipFinished ? matches.filter((match) => match.status !== 'finished') : matches;
  if (toPlay.length === 0) {
    console.log('\nOynatılacak eleme maçı kalmadı.');
    return;
  }

  console.log(`\nEleme aşaması (${toPlay.length} maç)${realistic ? ' [gerçekçi]' : ''}:`);

  for (const queued of toPlay) {
    const match = await reloadMatch(queued.id);
    if (!match) continue;

    if (match.home_team_id === null || match.away_team_id === null) {
      console.log(
        `  ${match.round_label ?? `Maç #${match.id}`}: atlandı (takımlar henüz atanmadı)`,
      );
      continue;
    }

    let { homeScore, awayScore } = generateMatchScores(match, teamTiers, realistic);
    ({ homeScore, awayScore } = ensureKnockoutWinner(match, homeScore, awayScore));
    await finishMatch(match, homeScore, awayScore, dryRun, skipFinished);
  }

  if (!dryRun) {
    const result = await recalculateAllPoints();
    console.log(`  → Puanlar yeniden hesaplandı (${result.entriesCount} kayıt)`);
  }
}

async function finalizeAllGroups(dryRun: boolean) {
  console.log('\nGrup sıralamaları finalize ediliyor...');

  for (const code of GROUP_CODES) {
    if (dryRun) {
      console.log(`  • Grup ${code}`);
      continue;
    }
    await finalizeGroupRankings(code);
  }

  if (!dryRun) {
    await maybeAutoComputeBestThirdRankings();
    await maybeGenerateKnockoutBracket();
    const result = await recalculateAllPoints();
    console.log(`  → Grup puanları hesaplandı (${result.entriesCount} kayıt)`);
    console.log('  → En iyi 3.ler sıralaması güncellendi');
  }
}

async function printLeaderboardSummary() {
  const [{ data: users }, { data: selections }, { data: totals }, { data: teams }] = await Promise.all([
    supabase.from('users').select('id, display_name').eq('is_admin', false).order('display_name'),
    supabase.from('team_selections').select('user_id, team_id'),
    supabase.from('team_total_points').select('*'),
    supabase.from('teams').select('id, name_tr'),
  ]);

  const pointsMap = new Map((totals ?? []).map((row) => [row.team_id, Number(row.total_points)]));
  const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name_tr]));
  const byUser = new Map<string, number[]>();

  for (const selection of selections ?? []) {
    const list = byUser.get(selection.user_id) ?? [];
    list.push(selection.team_id);
    byUser.set(selection.user_id, list);
  }

  const rows = (users ?? []).map((user) => {
    const teamIds = byUser.get(user.id) ?? [];
    const totalScore = teamIds.reduce((sum, teamId) => sum + (pointsMap.get(teamId) ?? 0), 0);
    const teamNames = teamIds.map((id) => teamMap.get(id) ?? `#${id}`).join(', ');
    return { name: user.display_name, totalScore, teamNames };
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);

  console.log('\nOyuncu puan özeti:');
  for (const [index, row] of rows.entries()) {
    console.log(`  ${index + 1}. ${row.name}: ${row.totalScore} puan [${row.teamNames || 'seçim yok'}]`);
  }

  const topTeams = [...(teams ?? [])]
    .map((team) => ({ name: team.name_tr, points: pointsMap.get(team.id) ?? 0 }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'tr'))
    .slice(0, 5);

  console.log('\nEn yüksek puanlı 5 takım:');
  for (const [index, team] of topTeams.entries()) {
    console.log(`  ${index + 1}. ${team.name}: ${team.points} puan`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.dryRun) {
    console.log('DRY RUN: Veritabanına yazılmayacak\n');
  }

  if (opts.realistic) {
    console.log('Gerçekçi skor modu: tier farkı büyükse favori daha sık kazanır, yakın tier maçları daha sürprize açık.\n');
  }

  const teamTiers = await loadTeamTiers();

  if (opts.reset && !opts.dryRun) {
    await resetGroupStage();
  } else if (opts.reset) {
    console.log('(--reset: grup aşaması sıfırlanacak)\n');
  }

  if (opts.resetKnockout && !opts.dryRun) {
    await clearKnockoutMatches();
  } else if (opts.resetKnockout) {
    console.log('(--reset-knockout: eleme maçları silinecek)\n');
  }

  if (opts.clearSelections && !opts.dryRun) {
    await clearAllSelections();
  } else if (opts.clearSelections) {
    console.log('(--clear-selections: takım seçimleri silinecek)\n');
  }

  if (opts.resetOnly) {
    console.log('\nTurnuva verisi temizlendi. Maç fikstürü ve kullanıcılar korundu.');
    console.log('Tamamlandı.');
    return;
  }

  if (opts.selections) {
    await assignRandomSelections(opts.dryRun);
  }

  const matches = await loadGroupMatches();
  if (matches.length === 0) {
    throw new Error('Grup maçı bulunamadı. Önce 008_seed_group_matches migration\'ını çalıştırın.');
  }

  for (const matchday of [...opts.matchdays].sort()) {
    await playMatchday(matchday, teamTiers, opts.realistic, opts.dryRun, !opts.reset);
  }

  if (opts.matchdays.includes(3) && !opts.skipFinalize) {
    const freshMatches = await loadGroupMatches();
    const md3Matches = freshMatches.filter((match) => getMatchday(match.round_label) === 3);
    const allFinished = md3Matches.length > 0 && md3Matches.every((match) => match.status === 'finished');

    if (allFinished || opts.dryRun) {
      if (!opts.dryRun) {
        await rebuildGroupStandingsFromMatches();
      }
      await finalizeAllGroups(opts.dryRun);
    } else {
      console.warn('\nMaç haftası 3 henüz bitmedi. Grup finalize atlandı.');
    }
  } else if (opts.matchdays.includes(3) && opts.skipFinalize) {
    console.log('\n--skip-finalize: grup sıralamaları finalize edilmedi.');
  }

  if (opts.withKnockout) {
    await playKnockoutMatches(teamTiers, opts.realistic, opts.dryRun, !opts.reset);
  }

  if (!opts.dryRun) {
    await printLeaderboardSummary();
  }

  console.log('\nTamamlandı.');
}

main().catch((err) => {
  console.error('\nHata:', err instanceof Error ? err.message : err);
  process.exit(1);
});
