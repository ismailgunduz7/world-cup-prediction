<script setup lang="ts">
import type { ResolvedMatch } from '@/types/bracket';

const props = defineProps<{
  match: ResolvedMatch | undefined;
  accent?: 'gold' | 'teal';
  /** Final: altın/gümüş; 3.lük: bronz (yalnızca kazanan). */
  medalMode?: 'final' | 'third_place';
}>();

const MEDAL = { gold: '🥇', silver: '🥈', bronze: '🥉' } as const;

function sideLabel(match: ResolvedMatch, side: 'home' | 'away'): string {
  const team = side === 'home' ? match.home : match.away;
  const fallback = side === 'home' ? match.homeLabel : match.awayLabel;
  return team?.name ?? fallback;
}

function isWinner(match: ResolvedMatch, side: 'home' | 'away'): boolean {
  if (match.winnerTeamId == null) return false;
  const team = side === 'home' ? match.home : match.away;
  return team?.teamId === match.winnerTeamId;
}

function sideMedal(match: ResolvedMatch, side: 'home' | 'away'): string | null {
  if (!props.medalMode || match.winnerTeamId == null) return null;
  const team = side === 'home' ? match.home : match.away;
  if (!team) return null;

  if (props.medalMode === 'final') {
    return isWinner(match, side) ? MEDAL.gold : MEDAL.silver;
  }
  if (props.medalMode === 'third_place' && isWinner(match, side)) {
    return MEDAL.bronze;
  }
  return null;
}
</script>

<template>
  <article v-if="match" class="node" :class="{ 'node--accent-gold': accent === 'gold' }">
    <span class="node-id">M{{ match.number }}</span>
    <div
      class="row"
      :class="{
        'row--winner': isWinner(match, 'home'),
        'row--empty': !match.home && match.homeLabel.startsWith('M'),
      }"
    >
      <span v-if="sideMedal(match, 'home')" class="row-medal" aria-hidden="true">{{
        sideMedal(match, 'home')
      }}</span>
      <span class="row-name">{{ sideLabel(match, 'home') }}</span>
    </div>
    <div
      class="row"
      :class="{
        'row--winner': isWinner(match, 'away'),
        'row--empty': !match.away && match.awayLabel.startsWith('M'),
      }"
    >
      <span v-if="sideMedal(match, 'away')" class="row-medal" aria-hidden="true">{{
        sideMedal(match, 'away')
      }}</span>
      <span class="row-name">{{ sideLabel(match, 'away') }}</span>
    </div>
  </article>
</template>

<style scoped>
.node {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.65);
}

.node--accent-gold {
  border: 2px solid #fbbf24;
  box-shadow: 0 4px 14px rgba(251, 191, 36, 0.22);
}

.node-id {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 36px 6px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  box-sizing: border-box;
  overflow: hidden;
}

.row:last-child {
  border-bottom: none;
}

.row-name {
  flex: 1;
  min-width: 0;
  line-height: 1.25;
  white-space: nowrap;
}

.row-medal {
  flex-shrink: 0;
  font-size: 16px;
  line-height: 1;
}

.row--winner {
  background: linear-gradient(90deg, #ccfbf1 0%, #99f6e4 100%);
  color: #0f766e;
  font-weight: 800;
}

.row--empty {
  color: #94a3b8;
  font-style: italic;
  font-weight: 500;
  font-size: 12px;
}

.node--accent-gold .row--winner {
  background: #fef3c7;
  color: #92400e;
}
</style>
