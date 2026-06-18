<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
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
import { rankLabel, type PlayerLeaderboardEntry } from '@/utils/leaderboard';
import api from '@/api/client';

type LeaderboardTab = 'players' | 'teams' | 'groups' | 'random';

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

const tabs: { key: LeaderboardTab; label: string }[] = [
  { key: 'players', label: 'Oyuncular' },
  { key: 'teams', label: 'Takımlar' },
  { key: 'groups', label: 'Grup Puanları' },
];

const randomTab = { key: 'random' as const, label: 'Rastgele' };

type TeamEntry = {
  rank: number;
  teamId: number;
  name: string;
  groupCode: string;
  tierName: string | null;
  totalPoints: number;
  isUserSelection: boolean;
};

const toast = useToast();
const route = useRoute();
const router = useRouter();
const loading = ref(true);
const randomModeEnabled = ref(false);
const activeTab = ref<LeaderboardTab>('players');
const entries = ref<PlayerLeaderboardEntry[]>([]);
const randomEntries = ref<PlayerLeaderboardEntry[]>([]);
const teamStandings = ref<TeamEntry[]>([]);
const groupStandings = ref<GroupStandings[]>([]);
const bestThirds = ref<BestThirdSummary | null>(null);

const visibleTabs = computed(() =>
  randomModeEnabled.value ? [...tabs, randomTab] : tabs,
);

function resolveInitialTab(): LeaderboardTab {
  const tab = route.query.tab;
  if (tab === 'teams') return 'teams';
  if (tab === 'groups') return 'groups';
  if (tab === 'random' && randomModeEnabled.value) return 'random';
  return 'players';
}

onMounted(async () => {
  const [{ data: leaderboardData }, { data: groupsData }, { data: bestThirdData }, { data: statusData }] =
    await Promise.all([
      api.get('/leaderboard'),
      api.get('/groups/standings'),
      api.get('/groups/best-thirds'),
      api.get('/tournament/status'),
    ]);

  entries.value = leaderboardData.entries;
  teamStandings.value = leaderboardData.teamStandings;
  groupStandings.value = groupsData.groups;
  bestThirds.value = bestThirdData.bestThirds;
  randomModeEnabled.value = statusData.randomModeEnabled !== false;

  if (randomModeEnabled.value) {
    const { data } = await api.get('/random-mode/leaderboard');
    randomEntries.value = data.entries;
  }

  activeTab.value = resolveInitialTab();
  loading.value = false;
});

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
    query: { from: 'leaderboard' },
  });
}

function onTeamRowClick(event: { data: TeamEntry }) {
  router.push({
    name: 'team-matches',
    params: { id: event.data.teamId },
    query: { from: 'leaderboard' },
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
    params: { id: entry.username },
    query: { from: 'leaderboard' },
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
    params: { id: entry.username },
    query: { from: 'random-leaderboard', mode: 'random' },
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

        <div v-show="activeTab === 'players'" class="leaderboard-tab-panel" role="tabpanel">
          <PlayerLeaderboardTable :entries="entries" @select="onPlayerSelect" />
        </div>

        <div v-show="activeTab === 'random'" class="leaderboard-tab-panel" role="tabpanel">
          <PlayerLeaderboardTable
            :entries="randomEntries"
            empty-selections-label="Atama yapılmadı"
            team-link-from="random-leaderboard"
            @select="onRandomPlayerSelect"
          />
        </div>

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
                <span class="name-cell">{{ data.name }}</span>
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
