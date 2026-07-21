<script setup lang="ts">
import { onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import LeaderboardTeamCell from '@/components/LeaderboardTeamCell.vue';
import { useReferenceStore } from '@/stores/reference';
import type { ReferenceGroup } from '@/stores/reference';
import {
  rankLabel,
  teamSlots,
  type LeaderboardSelection,
  type PlayerLeaderboardEntry,
} from '@/utils/leaderboard';

withDefaults(
  defineProps<{
    entries: PlayerLeaderboardEntry[];
    /** Label shown when a player has no picks. */
    emptySelectionsLabel?: string;
    /** Message shown when the table has no rows (e.g. unassigned user). */
    emptyMessage?: string;
    /** `from` query for team page back-navigation. */
    teamLinkFrom?: string;
  }>(),
  {
    emptySelectionsLabel: 'Seçim yapılmadı',
    emptyMessage: 'Henüz bir yarışmaya atanmadınız. Yöneticiyle iletişime geçin.',
    teamLinkFrom: 'leaderboard',
  },
);

const emit = defineEmits<{ (e: 'select', entry: PlayerLeaderboardEntry): void }>();

const reference = useReferenceStore();
const groups = ref<ReferenceGroup[]>([]);

const teamColumnLabels = ['Takım 1', 'Takım 2', 'Takım 3'];

onMounted(async () => {
  const data = await reference.ensureTeams();
  groups.value = data.groups;
});

function groupTeamsFor(team: LeaderboardSelection | null) {
  if (!team?.groupCode) return [];
  const group = groups.value.find((g) => g.code === team.groupCode);
  return (group?.teams ?? []).map((t) => ({ id: t.id, name: t.name }));
}

function onRowClick(event: { data: PlayerLeaderboardEntry }) {
  emit('select', event.data);
}
</script>

<template>
  <DataTable
    :value="entries"
    striped-rows
    responsive-layout="scroll"
    class="players-table"
    @row-click="onRowClick"
  >
    <Column header="#" style="width: 4rem">
      <template #body="{ data }">
        <span class="rank-cell">{{ rankLabel(data.rank) }}</span>
      </template>
    </Column>
    <Column header="Oyuncu" body-class="player-name-col" style="min-width: 7rem">
      <template #body="{ data }">
        <span class="name-cell">{{ data.displayName }}</span>
      </template>
    </Column>
    <Column field="totalScore" header="Toplam Puan" style="width: 8rem; min-width: 8rem">
      <template #body="{ data }">
        <strong>{{ data.totalScore }}</strong>
      </template>
    </Column>
    <Column
      v-for="(label, index) in teamColumnLabels"
      :key="label"
      :header="label"
      header-class="team-pick-col"
      body-class="team-pick-col"
      style="min-width: 10rem"
    >
      <template #body="{ data }">
        <LeaderboardTeamCell
          :team="teamSlots(data)[index]"
          :group-teams="groupTeamsFor(teamSlots(data)[index])"
          :empty-label="emptySelectionsLabel"
          :show-empty-label="index === 0 && !data.hasSelections"
          :team-link-from="teamLinkFrom"
        />
      </template>
    </Column>
    <template #empty>
      <span class="text-muted">{{ emptyMessage }}</span>
    </template>
  </DataTable>
</template>

<style scoped>
.rank-cell {
  font-weight: 600;
  min-width: 2rem;
  display: inline-block;
  text-align: center;
}

.name-cell {
  font-weight: 500;
}

.players-table :deep(.player-name-col) {
  white-space: nowrap;
}

.players-table :deep(.team-pick-col) {
  vertical-align: top;
}

.players-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
