<script setup lang="ts">
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import type { DashboardTeam } from '@/types/dashboard';
import { formatSigned } from '@/utils/point-descriptions';

defineProps<{
  team: DashboardTeam;
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resultLabel(result: 'win' | 'draw' | 'loss' | null) {
  if (result === 'win') return 'Galibiyet';
  if (result === 'draw') return 'Beraberlik';
  if (result === 'loss') return 'Mağlubiyet';
  return null;
}

function pointsSeverity(points: number): 'success' | 'danger' {
  return points < 0 ? 'danger' : 'success';
}
</script>

<template>
  <Card class="my-team-card">
    <template #title>
      <RouterLink
        :to="{ name: 'team-matches', params: { id: team.teamId }, query: { from: 'home' } }"
        class="team-title-link"
      >
        {{ team.name }}
      </RouterLink>
    </template>
    <template #subtitle>
      <span class="team-meta">{{ team.tierName }} · Grup {{ team.groupCode }}</span>
    </template>
    <template #content>
      <div class="team-card-body">
        <div class="team-points-row">
          <span class="team-points-label">Toplam puan</span>
          <strong class="team-points-value">{{ team.totalPoints }}</strong>
        </div>

        <Tag
          v-if="team.qualificationLabel"
          :value="team.qualificationLabel"
          :severity="team.qualificationLabel === 'Elendi' ? 'secondary' : 'success'"
          class="qual-tag"
        />

        <div v-if="team.lastMatch" class="match-block">
          <p class="match-block-label">Son maç</p>
          <p class="match-block-main">
            {{ team.lastMatch.score }} vs {{ team.lastMatch.opponent }}
          </p>
          <p class="match-block-sub text-muted">
            {{ resultLabel(team.lastMatch.result) }} · {{ team.lastMatch.stageLabel }} ·
            {{ formatDate(team.lastMatch.playedAt) }}
          </p>
          <Tag
            :value="`${formatSigned(team.lastMatch.pointsEarned)} puan`"
            :severity="pointsSeverity(team.lastMatch.pointsEarned)"
          />
        </div>

        <div v-if="team.nextMatch" class="match-block">
          <p class="match-block-label">Sıradaki maç</p>
          <p class="match-block-main">vs {{ team.nextMatch.opponent }}</p>
          <p class="match-block-sub text-muted">
            {{ team.nextMatch.stageLabel }} · {{ formatDate(team.nextMatch.scheduledAt) }}
          </p>
        </div>

        <p v-if="!team.lastMatch && !team.nextMatch" class="text-muted match-empty">
          Henüz maç yok
        </p>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.my-team-card :deep(.p-card-title) {
  font-size: 1.05rem;
}

.team-title-link {
  color: inherit;
  text-decoration: none;
  font-weight: 700;
}

.team-title-link:hover {
  color: var(--color-primary-hover);
}

.team-meta {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.team-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.team-points-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.team-points-label {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.team-points-value {
  font-size: 1.35rem;
}

.qual-tag {
  align-self: flex-start;
}

.match-block {
  padding-top: 0.65rem;
  border-top: 1px solid var(--color-border);
}

.match-block-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.match-block-main {
  margin: 0.25rem 0 0;
  font-weight: 600;
}

.match-block-sub {
  margin: 0.2rem 0 0.45rem;
  font-size: 0.82rem;
}

.match-empty {
  margin: 0;
  font-size: 0.88rem;
}
</style>
