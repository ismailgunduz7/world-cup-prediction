<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';

type LeaderboardTab = 'players' | 'teams' | 'groups';

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

type PlayerEntry = {
  rank: number;
  userId: string;
  displayName: string;
  totalScore: number;
  isCurrentUser: boolean;
  hasSelections: boolean;
  selections: Array<{ team: { name_tr: string; total_points: number }; selectedAt: string }>;
};

type TeamEntry = {
  rank: number;
  teamId: number;
  name: string;
  groupCode: string;
  tier: { name_tr: string };
  totalPoints: number;
  isUserSelection: boolean;
};

const toast = useToast();
const router = useRouter();
const loading = ref(true);
const activeTab = ref<LeaderboardTab>('players');
const entries = ref<PlayerEntry[]>([]);
const teamStandings = ref<TeamEntry[]>([]);
const groupStandings = ref<GroupStandings[]>([]);
const bestThirds = ref<BestThirdSummary | null>(null);

onMounted(async () => {
  const [{ data: leaderboardData }, { data: groupsData }, { data: bestThirdData }] = await Promise.all([
    api.get('/leaderboard'),
    api.get('/groups/standings'),
    api.get('/groups/best-thirds'),
  ]);
  entries.value = leaderboardData.entries;
  teamStandings.value = leaderboardData.teamStandings;
  groupStandings.value = groupsData.groups;
  bestThirds.value = bestThirdData.bestThirds;
  loading.value = false;
});

function formatSelections(entry: PlayerEntry) {
  if (!entry.hasSelections) return 'Seçim yapılmadı';
  return entry.selections
    .map((s) => `${s.team.name_tr} (${s.team.total_points}p)`)
    .join(', ');
}

function playerRowClass(data: PlayerEntry) {
  return data.isCurrentUser ? 'row-highlight' : '';
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
    query: { from: 'leaderboard' },
  });
}

function rankLabel(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function onTeamRowClick(event: { data: TeamEntry }) {
  router.push({
    name: 'team-matches',
    params: { id: event.data.teamId },
    query: { from: 'leaderboard' },
  });
}

function onPlayerRowClick(event: { data: PlayerEntry }) {
  const entry = event.data;
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
    params: { id: entry.userId },
    query: { from: 'leaderboard' },
  });
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader title="Puan Durumu" subtitle="Oyuncu sıralaması, takım puanları ve grup tabloları" />

    <Card class="leaderboard-card">
      <template #content>
        <nav class="leaderboard-tabs" role="tablist" aria-label="Puan durumu sekmeleri">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="leaderboard-tab"
            :class="{ 'is-active': activeTab === tab.key }"
            :aria-selected="activeTab === tab.key"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>

        <div v-show="activeTab === 'players'" class="leaderboard-tab-panel" role="tabpanel">
          <DataTable
            :value="entries"
            striped-rows
            :row-class="playerRowClass"
            responsive-layout="scroll"
            class="players-table"
            @row-click="onPlayerRowClick"
          >
            <Column header="#" style="width: 4rem">
              <template #body="{ data }">
                <span class="rank-cell">{{ rankLabel(data.rank) }}</span>
              </template>
            </Column>
            <Column header="Oyuncu" body-class="player-name-col">
              <template #body="{ data }">
                <span class="name-cell">{{ data.displayName }}</span>
              </template>
            </Column>
            <Column field="totalScore" header="Toplam Puan" style="width: 8rem">
              <template #body="{ data }">
                <strong>{{ data.totalScore }}</strong>
              </template>
            </Column>
            <Column header="Seçilen Takımlar" header-class="selections-col" body-class="selections-col">
              <template #body="{ data }">
                <span :class="{ 'text-muted': !data.hasSelections }">
                  {{ formatSelections(data) }}
                </span>
              </template>
            </Column>
          </DataTable>
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
                <Tag :value="data.tier.name_tr" severity="info" class="table-tag" />
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
                <span>En İyi 3.ler — Son 32'ye Katılan 8 Takım</span>
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

.leaderboard-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.leaderboard-tabs::-webkit-scrollbar {
  display: none;
}

.leaderboard-tab {
  appearance: none;
  border: none;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  padding: 0.75rem 1rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.leaderboard-tab:hover {
  color: var(--color-text);
}

.leaderboard-tab.is-active {
  color: var(--color-primary-hover);
  border-bottom-color: var(--color-primary);
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
.players-table :deep(.p-datatable-tbody > tr),
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

@media (max-width: 640px) {
  .leaderboard-card :deep(.selections-col) {
    display: none;
  }
}
</style>
