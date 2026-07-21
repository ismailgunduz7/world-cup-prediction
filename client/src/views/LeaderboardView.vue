<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import PlayerLeaderboardTable from '@/components/PlayerLeaderboardTable.vue';
import TabBar from '@/components/TabBar.vue';
import TeamSelectorsChip, { type SelectorGroup } from '@/components/TeamSelectorsChip.vue';
import { rankLabel, type PlayerLeaderboardEntry } from '@/utils/leaderboard';
import api from '@/api/client';

// Her yarışma kendi sekmesidir (`comp:<id>`); ayrıca global takım ve grup sekmeleri.
type LeaderboardTab = string;

type GroupStandingRow = {
  rank: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalDifference: number;
  points: number;
  isUserSelection: boolean;
  qualificationLabel: string | null;
};

type BestThirdRow = {
  globalRank: number;
  teamId: number;
  teamName: string;
  groupCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalDifference: number;
  points: number;
  isAdvancing: boolean;
  isUserSelection: boolean;
};

type BestThirdSummary = {
  isReady: boolean;
  isComputed: boolean;
  advancingCount: number;
  rows: BestThirdRow[];
};

type GroupStandings = {
  code: string;
  finishedMatches: number;
  totalMatches: number;
  isFinalized: boolean;
  standings: GroupStandingRow[];
};

type TeamEntry = {
  rank: number;
  teamId: number;
  name: string;
  groupCode: string;
  tierName: string | null;
  totalPoints: number;
  isUserSelection: boolean;
};

type CompetitionBlock = {
  id: string;
  name: string;
  randomModeEnabled: boolean;
  entries: PlayerLeaderboardEntry[];
  randomEntries: PlayerLeaderboardEntry[];
};

const toast = useToast();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const activeTab = ref<LeaderboardTab>('teams');
const competitions = ref<CompetitionBlock[]>([]);
const teamStandings = ref<TeamEntry[]>([]);
const groupStandings = ref<GroupStandings[]>([]);
const bestThirds = ref<BestThirdSummary | null>(null);

// Her yarışma kendi sekmesi; rastgele mod açıksa ayrı bir "… - Rastgele"
// sekmesi; ardından global takım ve grup sekmeleri.
const visibleTabs = computed(() => [
  ...competitions.value.flatMap((c) => {
    const items = [{ key: `comp:${c.id}`, label: c.name }];
    if (c.randomModeEnabled && c.randomEntries.length) {
      items.push({ key: `rand:${c.id}`, label: `${c.name} - Rastgele` });
    }
    return items;
  }),
  { key: 'teams', label: 'Takımlar' },
  { key: 'groups', label: 'Grup Puanları' },
]);

function isKnownTab(key: string): boolean {
  if (key === 'teams' || key === 'groups') return true;
  const m = key.match(/^(?:comp|rand):(.+)$/);
  return !!m && competitions.value.some((c) => c.id === m[1]);
}

function resolveInitialTab(): LeaderboardTab {
  // `?tab=<key>` aktif sekmeyi taşır (teams | groups | comp:<id> | rand:<id>);
  // geri-navigasyon ve paylaşılabilir link için.
  const tab = route.query.tab;
  if (typeof tab === 'string' && isKnownTab(tab)) return tab;
  return competitions.value[0] ? `comp:${competitions.value[0].id}` : 'teams';
}

onMounted(async () => {
  const [{ data: leaderboardData }, { data: groupsData }, { data: bestThirdData }] = await Promise.all([
    api.get('/leaderboard'),
    api.get('/groups/standings'),
    api.get('/groups/best-thirds'),
  ]);

  competitions.value = leaderboardData.competitions;
  teamStandings.value = leaderboardData.teamStandings;
  groupStandings.value = groupsData.groups;
  bestThirds.value = bestThirdData.bestThirds;

  activeTab.value = resolveInitialTab();
  loading.value = false;
});

// Aktif sekmeyi URL'ye yansıt ki takım/oyuncu sayfasından "Geri" dönünce aynı
// sekme açılsın (aksi halde daima ilk yarışma sekmesine düşüyordu).
watch(activeTab, (tab) => {
  if (!tab || loading.value) return;
  if (route.query.tab === tab) return;
  router.replace({ query: { ...route.query, tab } });
});

// Takım id → o takımı seçen oyuncular (yarışma bazında). `pick` gerçek seçimleri
// (comp.entries), random atamaları (comp.randomEntries) haritalayabilir.
function buildSelectorsMap(pick: (comp: CompetitionBlock) => PlayerLeaderboardEntry[]) {
  const map = new Map<number, SelectorGroup[]>();
  for (const comp of competitions.value) {
    for (const entry of pick(comp)) {
      for (const sel of entry.selections) {
        let groups = map.get(sel.teamId);
        if (!groups) {
          groups = [];
          map.set(sel.teamId, groups);
        }
        let group = groups.find((g) => g.competitionName === comp.name);
        if (!group) {
          group = { competitionName: comp.name, players: [] };
          groups.push(group);
        }
        group.players.push(entry.displayName);
      }
    }
  }
  return map;
}

const selectorsByTeam = computed(() => buildSelectorsMap((c) => c.entries));
const randomSelectorsByTeam = computed(() => buildSelectorsMap((c) => c.randomEntries));

function teamSelectors(teamId: number): SelectorGroup[] {
  return selectorsByTeam.value.get(teamId) ?? [];
}

function teamRandomSelectors(teamId: number): SelectorGroup[] {
  return randomSelectorsByTeam.value.get(teamId) ?? [];
}

function teamRowClass(data: TeamEntry) {
  return data.isUserSelection ? 'row-highlight' : '';
}

function groupStandingRowClass(data: GroupStandingRow) {
  return data.isUserSelection ? 'row-highlight' : '';
}

function bestThirdRowClass(data: BestThirdRow) {
  return data.isUserSelection ? 'row-highlight' : '';
}

function isGroupRankQualified(row: { rank: number; qualificationLabel: string | null }) {
  return row.rank <= 3 && (row.qualificationLabel?.startsWith('Son 32') ?? false);
}

function rankBadgeClass(qualified: boolean) {
  return ['rank-badge', { 'rank-badge--qualified': qualified }];
}

function formatGoalDifference(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function onGroupTeamClick(teamId: number) {
  router.push({
    name: 'team-matches',
    params: { id: teamId },
    query: { from: 'leaderboard', tab: activeTab.value },
  });
}

function onTeamRowClick(event: { data: TeamEntry }) {
  router.push({
    name: 'team-matches',
    params: { id: event.data.teamId },
    query: { from: 'leaderboard', tab: activeTab.value },
  });
}

function onPlayerSelect(entry: PlayerLeaderboardEntry) {
  if (!entry.hasSelections) {
    toast.add({
      severity: 'info',
      summary: 'Seçim yapılmadı',
      detail: `${entry.displayName} henüz seçimlerini tamamlamadı`,
      life: 3500,
    });
    return;
  }

  router.push({
    name: 'player-points',
    params: { id: entry.slug },
    query: { from: 'leaderboard', tab: activeTab.value },
  });
}

function onRandomPlayerSelect(entry: PlayerLeaderboardEntry) {
  if (!entry.hasSelections) {
    toast.add({
      severity: 'info',
      summary: 'Atama yapılmadı',
      detail: `${entry.displayName} henüz rastgele atama yapmadı`,
      life: 3500,
    });
    return;
  }

  router.push({
    name: 'player-points',
    params: { id: entry.slug },
    query: { from: 'random-leaderboard', mode: 'random', tab: activeTab.value },
  });
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader title="Puan Durumu" subtitle="Oyuncu sıralaması, takım puanları ve grup tabloları" />

    <Card class="leaderboard-card">
      <template #content>
        <TabBar v-model="activeTab" :tabs="visibleTabs" aria-label="Puan durumu sekmeleri" />

        <template v-for="comp in competitions" :key="comp.id">
          <div
            v-show="activeTab === `comp:${comp.id}`"
            class="leaderboard-tab-panel"
            role="tabpanel"
          >
            <PlayerLeaderboardTable :entries="comp.entries" @select="onPlayerSelect" />
          </div>

          <div
            v-if="comp.randomModeEnabled && comp.randomEntries.length"
            v-show="activeTab === `rand:${comp.id}`"
            class="leaderboard-tab-panel"
            role="tabpanel"
          >
            <PlayerLeaderboardTable
              :entries="comp.randomEntries"
              empty-selections-label="Atama yapılmadı"
              team-link-from="random-leaderboard"
              @select="onRandomPlayerSelect"
            />
          </div>
        </template>

        <div v-show="activeTab === 'teams'" class="leaderboard-tab-panel" role="tabpanel">
          <DataTable
            :value="teamStandings"
            striped-rows
            :row-class="teamRowClass"
            responsive-layout="scroll"
            class="teams-table"
            @row-click="onTeamRowClick"
          >
            <Column header="#" style="width: 4rem">
              <template #body="{ data }">
                <span class="rank-cell">{{ rankLabel(data.rank) }}</span>
              </template>
            </Column>
            <Column field="name" header="Takım">
              <template #body="{ data }">
                <span class="team-name-cell">
                  <span class="name-cell">{{ data.name }}</span>
                  <TeamSelectorsChip
                    v-if="teamSelectors(data.teamId).length"
                    :groups="teamSelectors(data.teamId)"
                  />
                  <TeamSelectorsChip
                    v-if="teamRandomSelectors(data.teamId).length"
                    :groups="teamRandomSelectors(data.teamId)"
                    variant="random"
                  />
                </span>
              </template>
            </Column>
            <Column header="Tier" style="width: 8rem">
              <template #body="{ data }">
                <Tag v-if="data.tierName" :value="data.tierName" severity="info" class="table-tag" />
              </template>
            </Column>
            <Column header="Grup" style="min-width: 6.5rem; width: 6.5rem">
              <template #body="{ data }">
                <Tag :value="`Grup ${data.groupCode}`" severity="secondary" class="table-tag" />
              </template>
            </Column>
            <Column field="totalPoints" header="Toplam Puan" style="width: 8rem">
              <template #body="{ data }">
                <strong>{{ data.totalPoints }}</strong>
              </template>
            </Column>
          </DataTable>
        </div>

        <div v-show="activeTab === 'groups'" class="leaderboard-tab-panel groups-panel" role="tabpanel">
          <div class="groups-grid">
            <Card v-for="group in groupStandings" :key="group.code" class="group-standings-card">
              <template #title>Grup {{ group.code }}</template>
              <template #content>
                <DataTable
                  :value="group.standings"
                  size="small"
                  responsive-layout="scroll"
                  :row-class="groupStandingRowClass"
                  @row-click="(event) => onGroupTeamClick(event.data.teamId)"
                >
                  <Column header="#" style="width: 2.75rem">
                    <template #body="{ data }">
                      <span :class="rankBadgeClass(isGroupRankQualified(data))">{{ data.rank }}</span>
                    </template>
                  </Column>
                  <Column header="Takım">
                    <template #body="{ data }">
                      <span class="name-cell">{{ data.teamName }}</span>
                    </template>
                  </Column>
                  <Column field="played" header="O" style="width: 2.5rem" />
                  <Column field="won" header="G" style="width: 2.5rem" />
                  <Column field="drawn" header="B" style="width: 2.5rem" />
                  <Column field="lost" header="M" style="width: 2.5rem" />
                  <Column header="Av" style="width: 3rem">
                    <template #body="{ data }">
                      {{ formatGoalDifference(data.goalDifference) }}
                    </template>
                  </Column>
                  <Column field="points" header="P" style="width: 2.5rem">
                    <template #body="{ data }">
                      <strong>{{ data.points }}</strong>
                    </template>
                  </Column>
                </DataTable>
              </template>
            </Card>
          </div>

          <Card v-if="bestThirds?.isComputed" class="best-thirds-card mt-3">
            <template #title>
              <div class="group-card-header">
                <span>En İyi 3.ler</span>
                <Tag :value="`${bestThirds.advancingCount}/8`" severity="success" />
              </div>
            </template>
            <template #content>
              <DataTable
                :value="bestThirds.rows"
                size="small"
                responsive-layout="scroll"
                :row-class="bestThirdRowClass"
                @row-click="(event) => onGroupTeamClick(event.data.teamId)"
              >
                <Column header="#" style="width: 2.75rem">
                  <template #body="{ data }">
                    <span :class="rankBadgeClass(data.isAdvancing)">{{ data.globalRank }}</span>
                  </template>
                </Column>
                <Column header="Takım">
                  <template #body="{ data }">
                    <span class="name-cell">{{ data.teamName }}</span>
                    <Tag :value="`Grup ${data.groupCode}`" severity="secondary" class="ml-2 table-tag" />
                  </template>
                </Column>
                <Column field="played" header="O" style="width: 2.5rem" />
                <Column field="won" header="G" style="width: 2.5rem" />
                <Column field="drawn" header="B" style="width: 2.5rem" />
                <Column field="lost" header="M" style="width: 2.5rem" />
                <Column header="Av" style="width: 3rem">
                  <template #body="{ data }">
                    {{ formatGoalDifference(data.goalDifference) }}
                  </template>
                </Column>
                <Column field="points" header="P" style="width: 2.5rem">
                  <template #body="{ data }">
                    <strong>{{ data.points }}</strong>
                  </template>
                </Column>
              </DataTable>
            </template>
          </Card>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.leaderboard-card :deep(.p-card-body) {
  padding-top: 0.85rem;
}

.leaderboard-tab-panel {
  padding-top: 0.25rem;
}


.rank-cell {
  font-weight: 600;
  min-width: 2rem;
  display: inline-block;
  text-align: center;
}

.name-cell {
  font-weight: 500;
}

.team-name-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.ml-2 {
  margin-left: 0.5rem;
}

.table-tag {
  flex-shrink: 0;
}

.table-tag :deep(.p-tag-label) {
  white-space: nowrap;
}

.teams-table :deep(.p-datatable-tbody > tr),
.group-standings-card :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.groups-panel {
  padding-top: 0.25rem;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.group-standings-card :deep(.p-card-title) {
  font-size: 1rem;
}

.group-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.table-tag {
  font-size: 0.72rem;
}

.best-thirds-card :deep(.p-card-title) {
  font-size: 1rem;
}

@media (max-width: 768px) {
  .groups-grid {
    grid-template-columns: 1fr;
  }
}
</style>
