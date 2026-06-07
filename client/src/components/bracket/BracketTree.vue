<script setup lang="ts">
import { computed } from 'vue';
import type { ResolvedMatch } from '@/types/bracket';
import { STAGE_LABELS, STAGE_ORDER } from '@/utils/bracket';

const props = defineProps<{
  matches: ResolvedMatch[];
}>();

const emit = defineEmits<{
  (e: 'pick', matchNumber: number, teamId: number): void;
}>();

const rounds = computed(() =>
  STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    matches: props.matches
      .filter((m) => m.stage === stage)
      .sort((a, b) => a.number - b.number),
  })).filter((round) => round.matches.length > 0),
);
</script>

<template>
  <div class="bracket-scroll">
    <div class="bracket-rounds">
      <section v-for="round in rounds" :key="round.stage" class="bracket-round">
        <h3 class="round-title">{{ round.label }}</h3>
        <div class="round-matches">
          <article v-for="match in round.matches" :key="match.number" class="match-card">
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
              {{ match.home?.name ?? match.homeLabel }}
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
              {{ match.away?.name ?? match.awayLabel }}
            </button>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bracket-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.5rem;
}

.bracket-rounds {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  min-width: min-content;
}

.bracket-round {
  flex: 0 0 13rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.round-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-primary);
  position: sticky;
  top: 0;
}

.round-matches {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.match-card {
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
  display: block;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.12s;
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

/* Mobilde turlar dikey istiflensin, yatay kaydırma gerekmesin. */
@media (max-width: 768px) {
  .bracket-scroll {
    overflow-x: visible;
  }

  .bracket-rounds {
    flex-direction: column;
    gap: 1.25rem;
    min-width: 0;
  }

  .bracket-round {
    flex: 1 1 auto;
    width: 100%;
  }

  .round-matches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.6rem;
  }
}
</style>
