import { supabase } from '../lib/config.js';
import { clearBestThirdRankings } from './best-third-service.js';
import { getConfigValue } from './tournament-config.js';
import { pointsBasisScore } from '../lib/match-basis.js';
import { STAGE_LABELS } from '../lib/stage-labels.js';
import type { MatchRow, MatchStage, ScoringRuleTypeRow, TeamRow, TierScoringRuleRow } from '../lib/types.js';

type RuleMap = Map<string, number>;

const KNOCKOUT_STAGES: MatchStage[] = [
  'round_of_32',
  'round_of_16',
  'quarter_final',
  'semi_final',
  'final',
];

async function loadActiveRules(): Promise<{
  ruleTypes: ScoringRuleTypeRow[];
  tierRules: TierScoringRuleRow[];
  ruleMap: RuleMap;
}> {
  const [{ data: ruleTypes, error: rtError }, { data: tierRules, error: trError }] = await Promise.all([
    supabase.from('scoring_rule_types').select('*').eq('is_active', true),
    supabase.from('tier_scoring_rules').select('*'),
  ]);

  if (rtError) throw rtError;
  if (trError) throw trError;

  const ruleMap: RuleMap = new Map();
  for (const rule of tierRules ?? []) {
    ruleMap.set(`${rule.rule_type_id}:${rule.tier_id}`, Number(rule.points));
  }

  return {
    ruleTypes: ruleTypes ?? [],
    tierRules: tierRules ?? [],
    ruleMap,
  };
}

function getRulePoints(ruleMap: RuleMap, ruleTypeId: number, tierId: number): number {
  return ruleMap.get(`${ruleTypeId}:${tierId}`) ?? 0;
}

function getRuleTypeId(ruleTypes: ScoringRuleTypeRow[], code: string): number | null {
  return ruleTypes.find((r) => r.code === code)?.id ?? null;
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function formatPerGoalDescription(stage: MatchStage, label: string, count: number, perGoal: number) {
  return `${STAGE_LABELS[stage]} - ${label} (${count}) başına ${formatSigned(perGoal)} puan`;
}

function matchOutcome(homeScore: number, awayScore: number, isHome: boolean): 'win' | 'draw' | 'loss' {
  if (homeScore === awayScore) return 'draw';
  const won = isHome ? homeScore > awayScore : awayScore > homeScore;
  return won ? 'win' : 'loss';
}

async function buildMatchPointEntries(
  match: MatchRow,
  homeTeam: TeamRow,
  awayTeam: TeamRow,
  ruleTypes: ScoringRuleTypeRow[],
  ruleMap: RuleMap,
  knockoutResultOver120: boolean,
) {
  // Puan esası skoru (ayar açıkken uzatma maçlarında 120', aksi halde 90'). G/B/M
  // ve atılan/yenilen gol bu esas skor üzerinden; kazanan/tur atlama bundan bağımsız.
  const { home: homeScore, away: awayScore } = pointsBasisScore(match, knockoutResultOver120);

  if (homeScore === null || awayScore === null) return [];
  const entries: Array<{
    team_id: number;
    rule_type_id: number;
    match_id: number;
    source_key: string;
    points: number;
    description_tr: string;
    earned_at: string;
  }> = [];

  const winId = getRuleTypeId(ruleTypes, 'win');
  const drawId = getRuleTypeId(ruleTypes, 'draw');
  const lossId = getRuleTypeId(ruleTypes, 'loss');
  const goalsScoredId = getRuleTypeId(ruleTypes, 'goals_scored');
  const goalsConcededId = getRuleTypeId(ruleTypes, 'goals_conceded');

  const teams = [
    { team: homeTeam, isHome: true, scored: homeScore, conceded: awayScore },
    { team: awayTeam, isHome: false, scored: awayScore, conceded: homeScore },
  ];

  for (const { team, isHome, scored, conceded } of teams) {
    const outcome = matchOutcome(homeScore, awayScore, isHome);
    const outcomeRuleId = outcome === 'win' ? winId : outcome === 'draw' ? drawId : lossId;
    const outcomeCode = outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss';
    const outcomeLabel = outcome === 'win' ? 'Galibiyet' : outcome === 'draw' ? 'Beraberlik' : 'Mağlubiyet';

    if (outcomeRuleId) {
      const points = getRulePoints(ruleMap, outcomeRuleId, team.tier_id);
      entries.push({
        team_id: team.id,
        rule_type_id: outcomeRuleId,
        match_id: match.id,
        source_key: `match:${match.id}:${team.id}:${outcomeCode}`,
        points,
        description_tr: `${STAGE_LABELS[match.stage]} - ${outcomeLabel}`,
        earned_at: match.scheduled_at,
      });
    }

    if (goalsScoredId && scored > 0) {
      const perGoal = getRulePoints(ruleMap, goalsScoredId, team.tier_id);
      entries.push({
        team_id: team.id,
        rule_type_id: goalsScoredId,
        match_id: match.id,
        source_key: `match:${match.id}:${team.id}:goals_scored`,
        points: perGoal * scored,
        description_tr: formatPerGoalDescription(match.stage, 'Attığı gol', scored, perGoal),
        earned_at: match.scheduled_at,
      });
    }

    if (goalsConcededId && conceded > 0) {
      const perGoal = getRulePoints(ruleMap, goalsConcededId, team.tier_id);
      entries.push({
        team_id: team.id,
        rule_type_id: goalsConcededId,
        match_id: match.id,
        source_key: `match:${match.id}:${team.id}:goals_conceded`,
        points: perGoal * conceded,
        description_tr: formatPerGoalDescription(match.stage, 'Yediği gol', conceded, perGoal),
        earned_at: match.scheduled_at,
      });
    }
  }

  return entries;
}

async function buildGroupPointEntries(
  ruleTypes: ScoringRuleTypeRow[],
  ruleMap: RuleMap,
) {
  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('*, team:teams(id, name_tr, tier_id, group_code)')
    .eq('is_finalized', true);

  if (error) throw error;

  const winnerId = getRuleTypeId(ruleTypes, 'group_winner');
  const runnerUpId = getRuleTypeId(ruleTypes, 'group_runner_up');
  const thirdId = getRuleTypeId(ruleTypes, 'group_third');

  const entries: Array<{
    team_id: number;
    rule_type_id: number;
    match_id: null;
    source_key: string;
    points: number;
    description_tr: string;
    earned_at: string | null;
  }> = [];

  for (const standing of standings ?? []) {
    const team = standing.team as { id: number; name_tr: string; tier_id: number; group_code: string };
    if (!team || standing.rank === null) continue;

    const rankRules: Array<{ rank: number; ruleId: number | null; label: string; code: string }> = [
      { rank: 1, ruleId: winnerId, label: 'Grup Liderliği', code: 'group_winner' },
      { rank: 2, ruleId: runnerUpId, label: 'Grup İkinciliği', code: 'group_runner_up' },
      { rank: 3, ruleId: thirdId, label: 'Grup Üçüncülüğü', code: 'group_third' },
    ];

    const matched = rankRules.find((r) => r.rank === standing.rank);
    if (!matched?.ruleId) continue;

    const points = getRulePoints(ruleMap, matched.ruleId, team.tier_id);
    entries.push({
      team_id: team.id,
      rule_type_id: matched.ruleId,
      match_id: null,
      source_key: `group:${team.group_code}:${team.id}:${matched.code}`,
      points,
      description_tr: `Grup ${team.group_code} - ${matched.label}`,
      earned_at: null,
    });
  }

  return entries;
}

async function buildKnockoutAdvancementEntries(
  ruleTypes: ScoringRuleTypeRow[],
  ruleMap: RuleMap,
  groupStageCounts: boolean,
) {
  const advanceId = getRuleTypeId(ruleTypes, 'round_advance');
  if (!advanceId) return [];

  const { data: advancements, error } = await supabase.from('knockout_advancements').select('*');
  if (error) throw error;

  const { data: teams, error: teamError } = await supabase.from('teams').select('*');
  if (teamError) throw teamError;

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t as TeamRow]));
  const entries: Array<{
    team_id: number;
    rule_type_id: number;
    match_id: number | null;
    source_key: string;
    points: number;
    description_tr: string;
    earned_at: string | null;
  }> = [];

  for (const adv of advancements ?? []) {
    if (!groupStageCounts && adv.stage === 'group') continue;
    if (!KNOCKOUT_STAGES.includes(adv.stage as MatchStage) && adv.stage !== 'group') continue;

    const team = teamMap.get(adv.team_id);
    if (!team) continue;

    const points = getRulePoints(ruleMap, advanceId, team.tier_id);
    entries.push({
      team_id: team.id,
      rule_type_id: advanceId,
      match_id: adv.match_id,
      source_key: adv.source_key,
      points,
      description_tr: `${STAGE_LABELS[adv.stage as MatchStage]} geçişi`,
      earned_at: adv.advanced_at,
    });
  }

  return entries;
}

type MedalEntry = {
  team_id: number;
  rule_type_id: number;
  match_id: number | null;
  source_key: string;
  points: number;
  description_tr: string;
  earned_at: string | null;
};

async function buildMedalEntries(ruleTypes: ScoringRuleTypeRow[], ruleMap: RuleMap) {
  const entries: MedalEntry[] = [];

  const { data: finalMatch, error } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'final')
    .eq('status', 'finished')
    .maybeSingle();

  if (error) throw error;

  const goldId = getRuleTypeId(ruleTypes, 'gold_medal');
  const silverId = getRuleTypeId(ruleTypes, 'silver_medal');

  if (finalMatch && finalMatch.winner_team_id !== null && goldId && silverId) {
    const loserId =
      finalMatch.winner_team_id === finalMatch.home_team_id
        ? finalMatch.away_team_id
        : finalMatch.home_team_id;

    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .in('id', [finalMatch.winner_team_id, loserId]);

    if (teamError) throw teamError;

    const teamMap = new Map((teams ?? []).map((t) => [t.id, t as TeamRow]));
    const winner = teamMap.get(finalMatch.winner_team_id);
    const loser = teamMap.get(loserId);

    if (winner && loser) {
      entries.push(
        {
          team_id: winner.id,
          rule_type_id: goldId,
          match_id: finalMatch.id,
          source_key: `medal:gold:${winner.id}`,
          points: getRulePoints(ruleMap, goldId, winner.tier_id),
          description_tr: 'Altın Madalya - Şampiyon',
          earned_at: finalMatch.scheduled_at,
        },
        {
          team_id: loser.id,
          rule_type_id: silverId,
          match_id: finalMatch.id,
          source_key: `medal:silver:${loser.id}`,
          points: getRulePoints(ruleMap, silverId, loser.tier_id),
          description_tr: 'Gümüş Madalya - İkinci',
          earned_at: finalMatch.scheduled_at,
        },
      );
    }
  }

  const { data: thirdPlaceMatch, error: thirdError } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'third_place')
    .eq('status', 'finished')
    .maybeSingle();

  if (thirdError) throw thirdError;

  const bronzeId = getRuleTypeId(ruleTypes, 'bronze_medal');

  if (thirdPlaceMatch && thirdPlaceMatch.winner_team_id !== null && bronzeId) {
    const { data: bronzeTeam, error: bronzeTeamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', thirdPlaceMatch.winner_team_id)
      .maybeSingle();

    if (bronzeTeamError) throw bronzeTeamError;

    if (bronzeTeam) {
      const team = bronzeTeam as TeamRow;
      entries.push({
        team_id: team.id,
        rule_type_id: bronzeId,
        match_id: thirdPlaceMatch.id,
        source_key: `medal:bronze:${team.id}`,
        points: getRulePoints(ruleMap, bronzeId, team.tier_id),
        description_tr: 'Bronz Madalya - Üçüncü',
        earned_at: thirdPlaceMatch.scheduled_at,
      });
    }
  }

  return entries;
}

export async function recalculateAllPoints(): Promise<{ entriesCount: number }> {
  const { ruleTypes, ruleMap } = await loadActiveRules();
  const scoringFlags = await getConfigValue<{
    group_stage_counts_as_round_advancement: boolean;
    knockout_result_over_120?: boolean;
  }>('scoring_flags', {
    group_stage_counts_as_round_advancement: false,
    knockout_result_over_120: false,
  });

  const { data: finishedMatches, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'finished');

  if (matchError) throw matchError;

  const { data: teams, error: teamError } = await supabase.from('teams').select('*');
  if (teamError) throw teamError;

  const teamMap = new Map((teams ?? []).map((t) => [t.id, t as TeamRow]));
  const allEntries: Array<{
    team_id: number;
    rule_type_id: number;
    match_id: number | null;
    source_key: string;
    points: number;
    description_tr: string;
    earned_at: string | null;
  }> = [];

  for (const match of finishedMatches ?? []) {
    const homeTeam = teamMap.get(match.home_team_id);
    const awayTeam = teamMap.get(match.away_team_id);
    if (!homeTeam || !awayTeam) continue;

    const matchEntries = await buildMatchPointEntries(
      match as MatchRow,
      homeTeam,
      awayTeam,
      ruleTypes,
      ruleMap,
      scoringFlags.knockout_result_over_120 ?? false,
    );
    allEntries.push(...matchEntries);
  }

  const groupEntries = await buildGroupPointEntries(ruleTypes, ruleMap);
  allEntries.push(...groupEntries);

  const knockoutEntries = await buildKnockoutAdvancementEntries(
    ruleTypes,
    ruleMap,
    scoringFlags.group_stage_counts_as_round_advancement,
  );
  allEntries.push(...knockoutEntries);

  const medalEntries = await buildMedalEntries(ruleTypes, ruleMap);
  allEntries.push(...medalEntries);

  const { error: deleteError } = await supabase
    .from('team_point_entries')
    .delete()
    .neq('id', 0);

  if (deleteError) throw deleteError;

  if (allEntries.length > 0) {
    const { error: insertError } = await supabase.from('team_point_entries').insert(allEntries);
    if (insertError) throw insertError;
  }

  return { entriesCount: allEntries.length };
}

export async function syncKnockoutAdvancementFromMatch(match: MatchRow): Promise<void> {
  if (match.status !== 'finished' || !match.winner_team_id) return;
  if (match.stage === 'group' || match.stage === 'third_place') return;

  const sourceKey = `advance:${match.stage}:${match.winner_team_id}`;
  const { error } = await supabase.from('knockout_advancements').upsert(
    {
      team_id: match.winner_team_id,
      stage: match.stage,
      match_id: match.id,
      source_key: sourceKey,
      advanced_at: match.scheduled_at,
    },
    { onConflict: 'source_key' },
  );

  if (error) throw error;
}

export async function resetGroupStandingsValues(): Promise<void> {
  const { data: rows, error: selectError } = await supabase.from('group_standings').select('id');
  if (selectError) throw selectError;
  if (!rows?.length) return;

  const { error } = await supabase
    .from('group_standings')
    .update({
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      rank: null,
      is_finalized: false,
      rank_is_manual: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', rows.map((row) => row.id));

  if (error) throw error;
}

export async function rebuildGroupStandingsFromMatches(): Promise<void> {
  await resetGroupStandingsValues();
  await clearBestThirdRankings();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .eq('stage', 'group')
    .eq('status', 'finished')
    .order('scheduled_at');

  if (error) throw error;

  for (const match of matches ?? []) {
    await updateGroupStandingsFromMatch(match as MatchRow);
  }
}

/**
 * Rebuilds standings from scratch (which clears all finalization state) but
 * then re-finalizes every group that was fully finalized beforehand, so that
 * editing or deleting a single group match does not silently wipe group /
 * knockout / medal points for groups that were already locked in.
 *
 * Re-finalization uses the automatic ranking rules — any prior manual ordering
 * is intentionally dropped because the underlying results just changed.
 */
export async function rebuildGroupStandingsPreservingFinalization(): Promise<void> {
  const { data: before, error } = await supabase
    .from('group_standings')
    .select('group_code, is_finalized');
  if (error) throw error;

  const perGroup = new Map<string, { total: number; finalized: number }>();
  for (const row of before ?? []) {
    const stat = perGroup.get(row.group_code) ?? { total: 0, finalized: 0 };
    stat.total += 1;
    if (row.is_finalized) stat.finalized += 1;
    perGroup.set(row.group_code, stat);
  }

  await rebuildGroupStandingsFromMatches();

  for (const [code, stat] of perGroup) {
    if (stat.total > 0 && stat.finalized === stat.total) {
      await finalizeGroupRankings(code, { forceAuto: true });
    }
  }
}

export async function updateGroupStandingsFromMatch(match: MatchRow): Promise<void> {
  if (match.stage !== 'group' || match.status !== 'finished') return;
  if (match.home_score === null || match.away_score === null) return;

  const teamIds = [match.home_team_id, match.away_team_id];
  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('*')
    .in('team_id', teamIds);

  if (error) throw error;

  const standingMap = new Map((standings ?? []).map((s) => [s.team_id, s]));

  const updates = [
    { teamId: match.home_team_id, scored: match.home_score, conceded: match.away_score },
    { teamId: match.away_team_id, scored: match.away_score, conceded: match.home_score },
  ];

  for (const { teamId, scored, conceded } of updates) {
    const current = standingMap.get(teamId);
    if (!current) continue;

    let won = current.won;
    let drawn = current.drawn;
    let lost = current.lost;
    let points = current.points;

    if (scored > conceded) {
      won += 1;
      points += 3;
    } else if (scored === conceded) {
      drawn += 1;
      points += 1;
    } else {
      lost += 1;
    }

    const goalsFor = current.goals_for + scored;
    const goalsAgainst = current.goals_against + conceded;

    const { error: updateError } = await supabase
      .from('group_standings')
      .update({
        played: current.played + 1,
        won,
        drawn,
        lost,
        goals_for: goalsFor,
        goals_against: goalsAgainst,
        goal_difference: goalsFor - goalsAgainst,
        points,
        updated_at: new Date().toISOString(),
      })
      .eq('team_id', teamId);

    if (updateError) throw updateError;
  }
}

function sortGroupStandingsByAutoRules(
  list: Array<{
    id: number;
    points: number;
    goal_difference: number;
    goals_for: number;
    team: { name_tr: string };
  }>,
) {
  return [...list].sort((a, b) => {
    return (
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      String(a.team.name_tr).localeCompare(String(b.team.name_tr), 'tr')
    );
  });
}

function groupRankOrderDiffersFromAuto(
  list: Array<{
    id: number;
    rank: number | null;
    is_finalized: boolean;
    points: number;
    goal_difference: number;
    goals_for: number;
    team: { name_tr: string };
  }>,
) {
  if (!list.every((standing) => standing.is_finalized && standing.rank !== null)) {
    return false;
  }

  const autoOrder = sortGroupStandingsByAutoRules(list).map((standing) => standing.id);
  const currentOrder = [...list]
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((standing) => standing.id);

  return autoOrder.join(',') !== currentOrder.join(',');
}

export async function finalizeGroupRankings(
  groupCode: string,
  options?: { forceAuto?: boolean },
): Promise<void> {
  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('*, team:teams(id, name_tr)')
    .eq('group_code', groupCode);

  if (error) throw error;

  const list = standings ?? [];
  const hasManualRank = list.some((standing) => standing.rank_is_manual);
  const preserveManualOrder =
    !options?.forceAuto && (hasManualRank || groupRankOrderDiffersFromAuto(list));

  if (preserveManualOrder) {
    for (const standing of list) {
      if (standing.rank === null) {
        throw new Error('Manuel sıralamada eksik sıra bilgisi var');
      }

      const { error: updateError } = await supabase
        .from('group_standings')
        .update({
          is_finalized: true,
          rank_is_manual: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', standing.id);

      if (updateError) throw updateError;
    }
    return;
  }

  const sorted = sortGroupStandingsByAutoRules(list);

  for (let i = 0; i < sorted.length; i++) {
    const standing = sorted[i];
    const { error: updateError } = await supabase
      .from('group_standings')
      .update({
        rank: i + 1,
        is_finalized: true,
        rank_is_manual: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', standing.id);

    if (updateError) throw updateError;
  }
}

export async function setGroupRankingsManually(
  groupCode: string,
  teamIdsInRankOrder: number[],
): Promise<void> {
  const { data: standings, error } = await supabase
    .from('group_standings')
    .select('team_id')
    .eq('group_code', groupCode);

  if (error) throw error;

  const groupTeamIds = new Set((standings ?? []).map((standing) => standing.team_id));
  if (teamIdsInRankOrder.length !== groupTeamIds.size) {
    throw new Error('Sıralamaya gruptaki tüm takımlar dahil edilmeli');
  }

  const uniqueIds = new Set(teamIdsInRankOrder);
  if (uniqueIds.size !== teamIdsInRankOrder.length) {
    throw new Error('Aynı takım birden fazla sırada olamaz');
  }

  for (const teamId of teamIdsInRankOrder) {
    if (!groupTeamIds.has(teamId)) {
      throw new Error('Geçersiz takım');
    }
  }

  for (let i = 0; i < teamIdsInRankOrder.length; i++) {
    const { error: updateError } = await supabase
      .from('group_standings')
      .update({
        rank: i + 1,
        is_finalized: true,
        rank_is_manual: true,
        updated_at: new Date().toISOString(),
      })
      .eq('group_code', groupCode)
      .eq('team_id', teamIdsInRankOrder[i]);

    if (updateError) throw updateError;
  }
}
