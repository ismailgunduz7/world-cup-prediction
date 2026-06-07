<script setup lang="ts">
import Card from 'primevue/card';
import type { DashboardUpcoming } from '@/types/dashboard';

defineProps<{
  matches: DashboardUpcoming[];
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <Card class="upcoming-strip-card">
    <template #title>Yaklaşan maçlar</template>
    <template #content>
      <div v-if="matches.length === 0" class="text-muted">Önümüzdeki maç bulunmuyor.</div>
      <ul v-else class="upcoming-list">
        <li v-for="match in matches" :key="`${match.matchId}-${match.teamId}`" class="upcoming-item">
          <div class="upcoming-main">
            <span class="upcoming-team">{{ match.teamName }}</span>
            <span class="upcoming-vs">vs {{ match.opponent }}</span>
          </div>
          <div class="upcoming-meta text-muted">
            {{ match.stageLabel }} · {{ formatDate(match.scheduledAt) }}
          </div>
        </li>
      </ul>
    </template>
  </Card>
</template>

<style scoped>
.upcoming-strip-card :deep(.p-card-title) {
  font-size: 1rem;
}

.upcoming-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.upcoming-item {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.upcoming-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.upcoming-main {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: baseline;
}

.upcoming-team {
  font-weight: 600;
}

.upcoming-vs {
  color: var(--color-text-secondary);
}

.upcoming-meta {
  margin-top: 0.2rem;
  font-size: 0.82rem;
}
</style>
