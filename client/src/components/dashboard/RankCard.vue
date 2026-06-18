<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import type { DashboardLeaderSummary, DashboardMe } from '@/types/dashboard';

const props = defineProps<{
  me: DashboardMe;
  leaderSummary: DashboardLeaderSummary | null;
}>();

const showPointsToNext = computed(
  () =>
    props.me.pointsToNext !== null &&
    props.me.rank !== null &&
    props.me.rank > 1 &&
    !props.leaderSummary?.isCurrentUserLeader,
);

function formatPlayerPoints(name: string, score: number) {
  return `${name} (${score}p)`;
}
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

          <template v-if="leaderSummary">
            <div class="rank-stat">
              <span class="rank-stat-label">Lider</span>
              <strong class="rank-stat-value" :class="{ 'rank-stat-value--you': leaderSummary.isCurrentUserLeader }">
                {{
                  leaderSummary.isCurrentUserLeader
                    ? formatPlayerPoints('Siz', leaderSummary.leaderScore)
                    : formatPlayerPoints(leaderSummary.leaderName, leaderSummary.leaderScore)
                }}
              </strong>
            </div>

            <div v-if="leaderSummary.isCurrentUserLeader && leaderSummary.chaserName" class="rank-stat">
              <span class="rank-stat-label">En yakın takipçi</span>
              <strong class="rank-stat-value">
                {{ formatPlayerPoints(leaderSummary.chaserName, leaderSummary.chaserScore!) }}
              </strong>
            </div>

            <div v-if="leaderSummary.isCurrentUserLeader && leaderSummary.chaserName" class="rank-stat">
              <span class="rank-stat-label">Takipçiden fark</span>
              <strong class="rank-stat-value rank-stat-value--ahead">
                +{{ leaderSummary.leadOverChaser }}
              </strong>
            </div>

            <div v-else-if="!leaderSummary.isCurrentUserLeader" class="rank-stat">
              <span class="rank-stat-label">Liderle fark</span>
              <strong class="rank-stat-value">
                {{ me.pointsToLeader === 0 ? '0' : `-${me.pointsToLeader}` }}
              </strong>
            </div>
          </template>

          <div v-if="showPointsToNext" class="rank-stat">
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
  align-items: flex-start;
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
  gap: 1rem 1.75rem;
  align-items: flex-start;
  align-self: flex-end;
}

.rank-stat {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 4.5rem;
}

.rank-stat-label {
  font-size: 0.78rem;
  line-height: 1.2;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.rank-stat-value {
  font-size: 1.15rem;
  line-height: 1.25;
  white-space: nowrap;
}

.rank-stat-value--you {
  color: var(--color-primary-hover);
}

.rank-stat-value--ahead {
  color: var(--color-success, #16a34a);
}

@media (max-width: 560px) {
  .rank-card-inner {
    flex-direction: column;
  }

  .rank-stats {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
