<script setup lang="ts">
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import type { DashboardGroupProgress } from '@/types/dashboard';

defineProps<{
  groups: DashboardGroupProgress[];
}>();

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

function groupStandingRowClass(data: { isUserSelection: boolean }) {
  return data.isUserSelection ? 'row-highlight' : '';
}
</script>

<template>
  <div class="group-progress-grid">
    <Card v-for="group in groups" :key="group.code" class="group-progress-card">
      <template #title>Grup {{ group.code }}</template>
      <template #content>
        <div class="table-scroll">
          <DataTable
            :value="group.standings"
            size="small"
            :row-class="groupStandingRowClass"
          >
          <Column header="#" style="width: 2.75rem">
            <template #body="{ data }">
              <span :class="rankBadgeClass(isGroupRankQualified(data))">{{ data.rank }}</span>
            </template>
          </Column>
          <Column field="teamName" header="Takım" />
          <Column field="played" header="O" style="width: 2.25rem" />
          <Column header="Av" style="width: 2.75rem">
            <template #body="{ data }">{{ formatGoalDifference(data.goalDifference) }}</template>
          </Column>
          <Column field="points" header="P" style="width: 2.25rem">
            <template #body="{ data }">
              <strong>{{ data.points }}</strong>
            </template>
          </Column>
          </DataTable>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.group-progress-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.group-progress-card :deep(.p-card-title) {
  font-size: 1rem;
}

.table-scroll {
  overflow-x: auto;
}

@media (max-width: 768px) {
  .group-progress-grid {
    grid-template-columns: 1fr;
  }
}
</style>
