<script setup lang="ts">
import Card from 'primevue/card';
import type { DashboardMe } from '@/types/dashboard';

defineProps<{
  me: DashboardMe;
}>();
</script>

<template>
  <Card class="rank-card">
    <template #content>
      <div class="rank-card-inner">
        <div class="rank-hero">
          <p class="rank-label">Sıralaman</p>
          <p v-if="me.rank !== null" class="rank-value">
            {{ me.rank }} <span class="rank-total">/ {{ me.playerCount }}</span>
          </p>
          <p v-else class="rank-value rank-value-muted">—</p>
        </div>
        <div class="rank-stats">
          <div class="rank-stat">
            <span class="rank-stat-label">Toplam puan</span>
            <strong class="rank-stat-value">{{ me.totalScore }}</strong>
          </div>
          <div v-if="me.pointsToLeader !== null && me.rank !== 1" class="rank-stat">
            <span class="rank-stat-label">Liderden fark</span>
            <strong class="rank-stat-value">-{{ me.pointsToLeader }}</strong>
          </div>
          <div v-if="me.pointsToNext !== null && me.rank !== null && me.rank > 1" class="rank-stat">
            <span class="rank-stat-label">Üst sıradan fark</span>
            <strong class="rank-stat-value">-{{ me.pointsToNext }}</strong>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.rank-card :deep(.p-card-body) {
  padding: 1.15rem 1.25rem;
}

.rank-card-inner {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.rank-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rank-value {
  margin: 0.25rem 0 0;
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.1;
  color: var(--color-primary-hover);
}

.rank-value-muted {
  color: var(--color-text-muted);
}

.rank-total {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.rank-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  align-items: flex-end;
}

.rank-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.rank-stat-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.rank-stat-value {
  font-size: 1.15rem;
}

@media (max-width: 560px) {
  .rank-card-inner {
    flex-direction: column;
  }
}
</style>
