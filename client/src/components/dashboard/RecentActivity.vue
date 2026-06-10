<script setup lang="ts">
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import type { DashboardActivity } from '@/types/dashboard';
import { formatRuleDescription, formatSigned } from '@/utils/point-descriptions';

defineProps<{
  activities: DashboardActivity[];
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pointsSeverity(points: number): 'success' | 'danger' {
  return points < 0 ? 'danger' : 'success';
}
</script>

<template>
  <Card class="recent-activity-card">
    <template #title>Son hareketler</template>
    <template #content>
      <div v-if="activities.length === 0" class="text-muted">Henüz bitmiş maç yok.</div>
      <ul v-else class="activity-list">
        <li v-for="item in activities" :key="`${item.matchId}-${item.teamId}`" class="activity-item">
          <div class="activity-header">
            <div>
              <p class="activity-title">
                <strong>{{ item.teamName }}</strong>
                {{ item.score }} vs {{ item.opponent }}
              </p>
              <p class="activity-meta text-muted">
                {{ item.stageLabel }} · {{ formatDate(item.playedAt) }}
              </p>
            </div>
            <Tag
              :value="formatSigned(item.pointsEarned)"
              :severity="pointsSeverity(item.pointsEarned)"
            />
          </div>
          <ul v-if="item.breakdown.length" class="activity-breakdown">
            <li v-for="(entry, index) in item.breakdown" :key="index">
              <span>{{ formatRuleDescription({ description: entry.description, points: entry.points }) }}</span>
              <span>{{ formatSigned(entry.points) }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </template>
  </Card>
</template>

<style scoped>
.recent-activity-card :deep(.p-card-title) {
  font-size: 1rem;
}

.activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.activity-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.activity-title {
  margin: 0;
  font-size: 0.92rem;
}

.activity-meta {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
}

.activity-breakdown {
  list-style: none;
  margin: 0.55rem 0 0;
  padding: 0.55rem 0.65rem;
  background: var(--color-bg-subtle);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
}

.activity-breakdown li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
