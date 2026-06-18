<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import type { DashboardMiniLeaderboardEntry } from '@/types/dashboard';

const props = defineProps<{
  entries: DashboardMiniLeaderboardEntry[];
  playerCount: number;
}>();

const linkLabel = computed(() => (props.playerCount <= 10 ? 'Detaylar' : 'Tümünü gör'));

const rows = computed(() =>
  props.entries.map((entry, index) => ({
    ...entry,
    rowKey: entry.isGap ? `gap-${index}` : `player-${entry.rank}`,
  })),
);
</script>

<template>
  <Card class="mini-leaderboard-card">
    <template #title>
      <div class="mini-leaderboard-header">
        <span>Lider tablosu</span>
        <RouterLink to="/puan-durumu" class="mini-leaderboard-link">{{ linkLabel }}</RouterLink>
      </div>
    </template>
    <template #content>
      <div class="table-scroll">
        <DataTable :value="rows" size="small" data-key="rowKey">
          <Column header="#" style="width: 2.5rem">
            <template #body="{ data }">
              <span v-if="data.isGap" class="mini-leaderboard-gap">…</span>
              <template v-else>{{ data.rank }}</template>
            </template>
          </Column>
          <Column field="displayName" header="Oyuncu">
            <template #body="{ data }">
              <span v-if="data.isGap" class="mini-leaderboard-gap">…</span>
              <span v-else :class="{ 'is-current-user': data.isCurrentUser }">{{ data.displayName }}</span>
            </template>
          </Column>
          <Column field="totalScore" header="Puan" style="width: 5rem">
            <template #body="{ data }">
              <span v-if="data.isGap" class="mini-leaderboard-gap">…</span>
              <strong v-else>{{ data.totalScore }}</strong>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.mini-leaderboard-card :deep(.p-card-title) {
  font-size: 1rem;
}

.table-scroll {
  overflow-x: auto;
}

.mini-leaderboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
}

.mini-leaderboard-link {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-primary-hover);
  text-decoration: none;
}

.mini-leaderboard-link:hover {
  text-decoration: underline;
}

.is-current-user {
  font-weight: 700;
  color: var(--color-primary-hover);
}

.mini-leaderboard-gap {
  color: var(--p-text-muted-color);
  letter-spacing: 0.15em;
}
</style>
