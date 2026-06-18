import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

// Statik referans verisi (takımlar, tier'lar, puanlama kuralları) oturum
// boyunca değişmez. Birden çok view aynı veriyi ayrı ayrı çekmesin diye burada
// bir kez yüklenip bellekte tutulur; logout'ta `reset()` ile temizlenir.

export type ReferenceTeam = {
  id: number;
  name: string;
  groupCode: string;
  tier: { id: number; name: string } | null;
};
export type ReferenceGroup = { code: string; teams: ReferenceTeam[] };
export type ReferenceTier = { id: number; name: string };
export type TeamsData = { groups: ReferenceGroup[]; tiers: ReferenceTier[] };

export type ScoringRule = {
  id: number;
  points: number;
  ruleType: {
    id: number;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  };
  tier: { id: number; name: string; sortOrder: number };
};
export type ScoringRulesData = {
  rules: ScoringRule[];
  scoringFlags: {
    group_stage_counts_as_round_advancement: boolean;
    knockout_result_over_120: boolean;
  };
};

export const useReferenceStore = defineStore('reference', () => {
  const teams = ref<TeamsData | null>(null);
  const scoringRules = ref<ScoringRulesData | null>(null);

  // Aynı anda mount olan iki view tek istek paylaşsın diye uçuştaki promise'i
  // tutuyoruz (in-flight dedup).
  let teamsInflight: Promise<TeamsData> | null = null;
  let scoringRulesInflight: Promise<ScoringRulesData> | null = null;

  async function ensureTeams(): Promise<TeamsData> {
    if (teams.value) return teams.value;
    if (teamsInflight) return teamsInflight;
    teamsInflight = api
      .get('/teams')
      .then(({ data }) => {
        const value: TeamsData = { groups: data.groups, tiers: data.tiers };
        teams.value = value;
        return value;
      })
      .finally(() => {
        teamsInflight = null;
      });
    return teamsInflight;
  }

  async function ensureScoringRules(): Promise<ScoringRulesData> {
    if (scoringRules.value) return scoringRules.value;
    if (scoringRulesInflight) return scoringRulesInflight;
    scoringRulesInflight = api
      .get('/scoring-rules')
      .then(({ data }) => {
        const value: ScoringRulesData = { rules: data.rules, scoringFlags: data.scoringFlags };
        scoringRules.value = value;
        return value;
      })
      .finally(() => {
        scoringRulesInflight = null;
      });
    return scoringRulesInflight;
  }

  function reset() {
    teams.value = null;
    scoringRules.value = null;
    teamsInflight = null;
    scoringRulesInflight = null;
  }

  return { teams, scoringRules, ensureTeams, ensureScoringRules, reset };
});
