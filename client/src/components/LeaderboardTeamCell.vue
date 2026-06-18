<script setup lang="ts">
import Tag from 'primevue/tag';
import GroupChip from '@/components/GroupChip.vue';
import type { GroupChipTeam } from '@/components/GroupChip.vue';
import type { LeaderboardSelection } from '@/utils/leaderboard';

defineProps<{
  team: LeaderboardSelection | null;
  groupTeams: GroupChipTeam[];
  emptyLabel: string;
  showEmptyLabel: boolean;
  teamLinkFrom: string;
}>();

function pointsClass(points: number) {
  if (points > 0) return 'team-cell__points--positive';
  if (points < 0) return 'team-cell__points--negative';
  return 'team-cell__points--zero';
}
</script>

<template>
  <div v-if="team" class="team-cell">
    <div class="team-cell__title">
      <RouterLink
        :to="{ name: 'team-matches', params: { id: team.teamId }, query: { from: teamLinkFrom } }"
        class="team-cell__name"
        @click.stop
      >
        {{ team.name }}
      </RouterLink>
      <span class="team-cell__sep" aria-hidden="true">·</span>
      <span class="team-cell__points" :class="pointsClass(team.points)">{{ team.points }}</span>
    </div>
    <div class="team-cell__meta">
      <Tag v-if="team.tierName" :value="team.tierName" severity="info" class="team-cell__tag" />
      <GroupChip
        :group-code="team.groupCode"
        :teams="groupTeams"
        :current-team-id="team.teamId"
        align="start"
      />
    </div>
    <div class="team-cell__record">
      <p>{{ team.won }}G - {{ team.drawn }}B - {{ team.lost }}M</p>
      <p>|</p>
      <p>A: {{ team.goalsFor }} - Y: {{ team.goalsAgainst }}</p>
    </div>
  </div>
  <span v-else class="text-muted team-cell__empty">
    {{ showEmptyLabel ? emptyLabel : '—' }}
  </span>
</template>

<style scoped>
.team-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 9.5rem;
}

.team-cell__title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.3rem;
  font-size: inherit;
  line-height: 1.25;
}

.team-cell__name {
  font-weight: 600;
  color: inherit;
  text-decoration: none;
}

.team-cell__name:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.team-cell__sep {
  color: var(--color-text-muted, #64748b);
  font-weight: 400;
  user-select: none;
}

.team-cell__points {
  font-weight: 700;
}

.team-cell__points--positive {
  color: var(--color-success);
}

.team-cell__points--zero {
  color: inherit;
}

.team-cell__points--negative {
  color: var(--color-danger);
}

.team-cell__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
}

.team-cell__tag {
  font-size: 0.68rem;
}

.team-cell__tag :deep(.p-tag-label) {
  white-space: nowrap;
}

.team-cell__meta :deep(.group-chip) {
  font-size: 0.68rem;
}

.team-cell__record {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  white-space: nowrap;
}

.team-cell__record p {
  margin: 0.15rem 0;
}

.team-cell__empty {
  font-size: 0.85rem;
}
</style>
