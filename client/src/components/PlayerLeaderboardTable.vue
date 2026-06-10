<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import {
  formatSelections,
  rankLabel,
  type PlayerLeaderboardEntry,
} from '@/utils/leaderboard';

withDefaults(
  defineProps<{
    entries: PlayerLeaderboardEntry[];
    /** Header for the picks column (real mode vs. random mode wording). */
    selectionsHeader?: string;
    /** Label shown when a player has no picks. */
    emptySelectionsLabel?: string;
    /** Message shown when the table has no rows (e.g. unassigned user). */
    emptyMessage?: string;
  }>(),
  {
    selectionsHeader: 'Seçilen Takımlar',
    emptySelectionsLabel: 'Seçim yapılmadı',
    emptyMessage: 'Henüz bir yarışmaya atanmadınız. Yöneticiyle iletişime geçin.',
  },
);

const emit = defineEmits<{ (e: 'select', entry: PlayerLeaderboardEntry): void }>();

function rowClass(data: PlayerLeaderboardEntry) {
  return data.isCurrentUser ? 'row-highlight' : '';
}

function onRowClick(event: { data: PlayerLeaderboardEntry }) {
  emit('select', event.data);
}
</script>

<template>
  <DataTable
    :value="entries"
    striped-rows
    :row-class="rowClass"
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
      :header="selectionsHeader"
      header-class="selections-col"
      body-class="selections-col"
      style="min-width: 16rem"
    >
      <template #body="{ data }">
        <span :class="{ 'text-muted': !data.hasSelections }">
          {{ formatSelections(data, emptySelectionsLabel) }}
        </span>
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

.players-table :deep(.player-name-col),
.players-table :deep(.selections-col) {
  white-space: nowrap;
}

.players-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}
</style>
