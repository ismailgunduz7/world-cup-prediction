<script setup lang="ts">
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import { formatMatchScore } from '@/utils/match-score';
import type { LiveSpotlightGroup, SpotlightMatch } from '@/utils/live-spotlight';

const props = defineProps<{
  groups: LiveSpotlightGroup[];
  linkFrom: 'home' | 'fixtures';
  highlightTeamIds?: number[];
}>();

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScore(match: SpotlightMatch) {
  return formatMatchScore(match);
}

function matchContext(match: SpotlightMatch) {
  const parts = [match.stageLabel];
  if (match.roundLabel) parts.push(match.roundLabel);
  return parts.join(' · ');
}

function involvesUserTeam(match: SpotlightMatch) {
  const ids = props.highlightTeamIds ?? [];
  if (ids.length === 0) return false;
  return (
    (match.homeTeam.id != null && ids.includes(match.homeTeam.id)) ||
    (match.awayTeam.id != null && ids.includes(match.awayTeam.id))
  );
}

function teamLinkClass(teamId: number | null) {
  if (teamId == null) return 'spotlight-team';
  const base = 'spotlight-team spotlight-team-link';
  if ((props.highlightTeamIds ?? []).includes(teamId)) {
    return `${base} spotlight-team--yours`;
  }
  return base;
}
</script>

<template>
  <section v-if="groups.length" class="spotlight-section">
    <template
      v-for="group in groups"
      :key="group.kind === 'single' ? group.match.id : `group-${group.groupCode}`"
    >
      <Card
        v-if="group.kind === 'single'"
        class="spotlight-card spotlight-card--live"
        :class="{ 'spotlight-card--yours': involvesUserTeam(group.match) }"
      >
        <template #content>
          <div class="spotlight-top">
            <Tag value="CANLI" severity="warn" class="spotlight-badge" />
            <span class="spotlight-context">{{ matchContext(group.match) }}</span>
            <Tag
              v-if="involvesUserTeam(group.match)"
              value="Kadronuzda"
              severity="success"
              class="spotlight-yours-tag"
            />
          </div>
          <div class="spotlight-scoreboard">
            <RouterLink
              v-if="group.match.homeTeam.id"
              :to="{
                name: 'team-matches',
                params: { id: group.match.homeTeam.id },
                query: { from: linkFrom },
              }"
              :class="teamLinkClass(group.match.homeTeam.id)"
            >
              {{ group.match.homeTeam.name }}
            </RouterLink>
            <span v-else class="spotlight-team">{{ group.match.homeTeam.name }}</span>
            <span class="spotlight-score">{{ formatScore(group.match) }}</span>
            <RouterLink
              v-if="group.match.awayTeam.id"
              :to="{
                name: 'team-matches',
                params: { id: group.match.awayTeam.id },
                query: { from: linkFrom },
              }"
              :class="teamLinkClass(group.match.awayTeam.id)"
            >
              {{ group.match.awayTeam.name }}
            </RouterLink>
            <span v-else class="spotlight-team">{{ group.match.awayTeam.name }}</span>
          </div>
          <p class="spotlight-time text-muted">{{ formatDate(group.match.scheduledAt) }}</p>
        </template>
      </Card>

      <Card
        v-else
        class="spotlight-card spotlight-card--live spotlight-card--group-final"
        :class="{
          'spotlight-card--yours': group.matches.some((m) => involvesUserTeam(m)),
        }"
      >
        <template #content>
          <div class="spotlight-top">
            <Tag value="CANLI" severity="warn" class="spotlight-badge" />
            <span class="spotlight-context">Grup {{ group.groupCode }} · Son Hafta</span>
            <Tag
              v-if="group.matches.some((m) => involvesUserTeam(m))"
              value="Kadronuzda"
              severity="success"
              class="spotlight-yours-tag"
            />
          </div>
          <div
            v-for="(match, index) in group.matches"
            :key="match.id"
            class="spotlight-group-final-match"
            :class="{ 'spotlight-group-final-match--bordered': index > 0 }"
          >
            <p class="spotlight-group-final-label text-muted">{{ match.roundLabel }}</p>
            <div class="spotlight-scoreboard">
              <RouterLink
                v-if="match.homeTeam.id"
                :to="{
                  name: 'team-matches',
                  params: { id: match.homeTeam.id },
                  query: { from: linkFrom },
                }"
                :class="teamLinkClass(match.homeTeam.id)"
              >
                {{ match.homeTeam.name }}
              </RouterLink>
              <span v-else class="spotlight-team">{{ match.homeTeam.name }}</span>
              <span class="spotlight-score">{{ formatScore(match) }}</span>
              <RouterLink
                v-if="match.awayTeam.id"
                :to="{
                  name: 'team-matches',
                  params: { id: match.awayTeam.id },
                  query: { from: linkFrom },
                }"
                :class="teamLinkClass(match.awayTeam.id)"
              >
                {{ match.awayTeam.name }}
              </RouterLink>
              <span v-else class="spotlight-team">{{ match.awayTeam.name }}</span>
            </div>
          </div>
          <p class="spotlight-time text-muted">{{ formatDate(group.matches[0].scheduledAt) }}</p>
        </template>
      </Card>
    </template>
  </section>
</template>

<style scoped>
.spotlight-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.spotlight-card--live {
  border-color: var(--p-orange-300, #fdba74);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--p-orange-50, #fff7ed) 80%, transparent),
    var(--color-surface, #fff)
  );
}

.spotlight-card--yours {
  border-color: var(--p-green-300, #86efac);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--p-green-50, #f0fdf4) 70%, transparent),
    var(--color-surface, #fff)
  );
}

.spotlight-card :deep(.p-card-body) {
  padding-top: 0.85rem;
}

.spotlight-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.spotlight-badge :deep(.p-tag-label) {
  font-weight: 700;
  letter-spacing: 0.03em;
}

.spotlight-yours-tag :deep(.p-tag-label) {
  font-size: 0.72rem;
}

.spotlight-context {
  font-size: 0.82rem;
  color: var(--color-text-muted, #64748b);
}

.spotlight-scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.75rem;
}

.spotlight-team {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.25;
}

.spotlight-scoreboard .spotlight-team:first-child {
  text-align: right;
}

.spotlight-scoreboard .spotlight-team:last-child {
  text-align: left;
}

.spotlight-team-link {
  color: inherit;
  text-decoration: none;
}

.spotlight-team-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.spotlight-team--yours {
  color: var(--color-success, #16a34a);
}

.spotlight-score {
  font-size: 1.75rem;
  font-weight: 800;
  line-height: 1;
  color: var(--color-primary-hover);
  white-space: nowrap;
}

.spotlight-time {
  margin: 0.65rem 0 0;
  font-size: 0.82rem;
  text-align: center;
}

.spotlight-group-final-match {
  padding-top: 0.15rem;
}

.spotlight-group-final-match--bordered {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
}

.spotlight-group-final-label {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
}

@media (max-width: 560px) {
  .spotlight-scoreboard {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 0.35rem;
  }

  .spotlight-scoreboard .spotlight-team:first-child,
  .spotlight-scoreboard .spotlight-team:last-child {
    text-align: center;
  }

  .spotlight-score {
    font-size: 1.5rem;
  }
}
</style>
