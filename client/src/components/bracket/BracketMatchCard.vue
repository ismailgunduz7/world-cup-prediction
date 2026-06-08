<script setup lang="ts">
import type { ResolvedMatch } from '@/types/bracket';

defineProps<{
  match: ResolvedMatch | undefined;
  showTiers: boolean;
}>();

const emit = defineEmits<{
  (e: 'pick', matchNumber: number, teamId: number): void;
}>();
</script>

<template>
  <article v-if="match" class="match-card">
    <span class="match-no">M{{ match.number }}</span>
    <button
      type="button"
      class="side"
      :class="{
        'is-winner': match.winnerTeamId != null && match.home?.teamId === match.winnerTeamId,
        'is-empty': !match.home,
      }"
      :disabled="!match.home"
      @click="match.home && emit('pick', match.number, match.home.teamId)"
    >
      <span class="side-name">{{ match.home?.name ?? match.homeLabel }}</span>
      <span v-if="showTiers && match.home?.tier" class="side-tier" :title="match.home.tier">
        {{ match.home.tier }}
      </span>
    </button>
    <button
      type="button"
      class="side"
      :class="{
        'is-winner': match.winnerTeamId != null && match.away?.teamId === match.winnerTeamId,
        'is-empty': !match.away,
      }"
      :disabled="!match.away"
      @click="match.away && emit('pick', match.number, match.away.teamId)"
    >
      <span class="side-name">{{ match.away?.name ?? match.awayLabel }}</span>
      <span v-if="showTiers && match.away?.tier" class="side-tier" :title="match.away.tier">
        {{ match.away.tier }}
      </span>
    </button>
  </article>
</template>

<style scoped>
.match-card {
  --match-card-height: 4.5rem;
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  overflow: hidden;
}

.match-no {
  position: absolute;
  top: 0.15rem;
  right: 0.35rem;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.side {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  appearance: none;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 0.5rem 1.6rem 0.5rem 0.6rem;
  cursor: pointer;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.12s;
}

.side-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side-tier {
  flex-shrink: 0;
  max-width: 5.5rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.side:last-child {
  border-bottom: none;
}

.side:hover:not(:disabled):not(.is-winner) {
  background: var(--color-bg-subtle);
}

.side.is-winner {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.side.is-empty {
  color: var(--color-text-muted);
  font-style: italic;
  cursor: default;
}
</style>
