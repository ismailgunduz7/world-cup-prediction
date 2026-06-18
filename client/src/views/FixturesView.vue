<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import TabBar from '@/components/TabBar.vue';
import LiveSpotlight from '@/components/LiveSpotlight.vue';
import api from '@/api/client';
import { buildLiveSpotlightGroups } from '@/utils/live-spotlight';
import { formatMatchScore } from '@/utils/match-score';

type FixtureTeam = { id: number | null; name: string };

type FixtureMatch = {
  id: number;
  stage: string;
  stageLabel: string;
  groupCode: string | null;
  roundLabel: string | null;
  status: string;
  scheduledAt: string;
  homeTeam: FixtureTeam;
  awayTeam: FixtureTeam;
  homeScore: number | null;
  awayScore: number | null;
  homeScoreAet: number | null;
  awayScoreAet: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerTeamId: number | null;
};

type FixtureFilter = 'planned' | 'finished';

const filterTabs: { key: FixtureFilter; label: string }[] = [
  { key: 'planned', label: 'Planlanan' },
  { key: 'finished', label: 'Bitmiş' },
];

const loading = ref(true);
const matches = ref<FixtureMatch[]>([]);
const activeFilter = ref<FixtureFilter>('planned');

const liveMatches = computed(() =>
  matches.value
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
);

const liveSpotlightGroups = computed(() => buildLiveSpotlightGroups(matches.value));

const nextUpcomingMatch = computed(() => {
  const upcoming = matches.value
    .filter((m) => m.status === 'scheduled' || m.status === 'postponed')
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return upcoming[0] ?? null;
});

const spotlightExcludedIds = computed(() => {
  if (liveMatches.value.length > 0) {
    return new Set(liveMatches.value.map((m) => m.id));
  }
  if (nextUpcomingMatch.value) {
    return new Set([nextUpcomingMatch.value.id]);
  }
  return new Set<number>();
});

const filteredMatches = computed(() => {
  const list =
    activeFilter.value === 'planned'
      ? matches.value.filter((m) => m.status === 'scheduled' || m.status === 'postponed')
      : matches.value.filter((m) => m.status === 'finished');

  return list
    .filter((m) => !spotlightExcludedIds.value.has(m.id))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
});

onMounted(async () => {
  const { data } = await api.get('/matches');
  matches.value = data.matches;
  loading.value = false;
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatScore(match: FixtureMatch) {
  return formatMatchScore(match);
}

function matchContext(match: FixtureMatch) {
  const parts = [match.stageLabel];
  if (match.roundLabel) parts.push(match.roundLabel);
  return parts.join(' · ');
}

function winnerSide(match: FixtureMatch): 'home' | 'away' | null {
  if (match.homeScore === null || match.awayScore === null) return null;
  // Uzatma/penaltı ile karara bağlanan maçlarda kazanan winnerTeamId'den belirlenir
  // (90' skoru beraberlik olabilir).
  if (match.winnerTeamId != null) {
    if (match.winnerTeamId === match.homeTeam.id) return 'home';
    if (match.winnerTeamId === match.awayTeam.id) return 'away';
  }
  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  if (Number.isNaN(home) || Number.isNaN(away)) return null;
  if (home > away) return 'home';
  if (away > home) return 'away';
  return null;
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader title="Fikstür" />

    <!-- Spotlight: canlı maç veya sıradaki maç -->
    <LiveSpotlight
      v-if="liveSpotlightGroups.length"
      :groups="liveSpotlightGroups"
      link-from="fixtures"
    />

    <Card v-else-if="nextUpcomingMatch" class="spotlight-card spotlight-card--upcoming">
      <template #content>
        <div class="spotlight-top">
          <Tag value="Sıradaki maç" severity="info" class="spotlight-badge" />
          <span class="spotlight-context">{{ matchContext(nextUpcomingMatch) }}</span>
        </div>
        <p class="spotlight-datetime">{{ formatDateLong(nextUpcomingMatch.scheduledAt) }}</p>
        <div class="spotlight-teams-row">
          <RouterLink
            v-if="nextUpcomingMatch.homeTeam.id"
            :to="{
              name: 'team-matches',
              params: { id: nextUpcomingMatch.homeTeam.id },
              query: { from: 'fixtures' },
            }"
            class="spotlight-team spotlight-team-link"
          >
            {{ nextUpcomingMatch.homeTeam.name }}
          </RouterLink>
          <span v-else class="spotlight-team">{{ nextUpcomingMatch.homeTeam.name }}</span>
          <span class="spotlight-vs">vs</span>
          <RouterLink
            v-if="nextUpcomingMatch.awayTeam.id"
            :to="{
              name: 'team-matches',
              params: { id: nextUpcomingMatch.awayTeam.id },
              query: { from: 'fixtures' },
            }"
            class="spotlight-team spotlight-team-link"
          >
            {{ nextUpcomingMatch.awayTeam.name }}
          </RouterLink>
          <span v-else class="spotlight-team">{{ nextUpcomingMatch.awayTeam.name }}</span>
        </div>
      </template>
    </Card>

    <Card class="fixture-list-card">
      <template #content>
        <TabBar v-model="activeFilter" :tabs="filterTabs" aria-label="Maç filtresi" />

        <p v-if="filteredMatches.length === 0" class="text-muted fixture-empty">
          {{ activeFilter === 'planned' ? 'Planlanan maç yok.' : 'Bitmiş maç yok.' }}
        </p>

        <ul v-else class="fixture-list">
          <li v-for="match in filteredMatches" :key="match.id" class="fixture-item">
            <div class="fixture-item-top">
              <span class="fixture-context text-muted">{{ matchContext(match) }}</span>
            </div>
            <div class="fixture-teams">
              <template v-if="activeFilter === 'finished'">
                <RouterLink
                  v-if="match.homeTeam.id"
                  :to="{ name: 'team-matches', params: { id: match.homeTeam.id }, query: { from: 'fixtures' } }"
                  class="fixture-team-link"
                  :class="{ 'is-winner': winnerSide(match) === 'home' }"
                >
                  {{ match.homeTeam.name }}
                </RouterLink>
                <span v-else :class="{ 'is-winner': winnerSide(match) === 'home' }">{{ match.homeTeam.name }}</span>
                <span class="fixture-inline-score">{{ formatScore(match) }}</span>
                <RouterLink
                  v-if="match.awayTeam.id"
                  :to="{ name: 'team-matches', params: { id: match.awayTeam.id }, query: { from: 'fixtures' } }"
                  class="fixture-team-link"
                  :class="{ 'is-winner': winnerSide(match) === 'away' }"
                >
                  {{ match.awayTeam.name }}
                </RouterLink>
                <span v-else :class="{ 'is-winner': winnerSide(match) === 'away' }">{{ match.awayTeam.name }}</span>
              </template>
              <template v-else>
                <RouterLink
                  v-if="match.homeTeam.id"
                  :to="{ name: 'team-matches', params: { id: match.homeTeam.id }, query: { from: 'fixtures' } }"
                  class="fixture-team-link"
                >
                  {{ match.homeTeam.name }}
                </RouterLink>
                <span v-else>{{ match.homeTeam.name }}</span>
                <span class="fixture-vs">vs</span>
                <RouterLink
                  v-if="match.awayTeam.id"
                  :to="{ name: 'team-matches', params: { id: match.awayTeam.id }, query: { from: 'fixtures' } }"
                  class="fixture-team-link"
                >
                  {{ match.awayTeam.name }}
                </RouterLink>
                <span v-else>{{ match.awayTeam.name }}</span>
              </template>
            </div>
            <p class="fixture-time text-muted">{{ formatDate(match.scheduledAt) }}</p>
          </li>
        </ul>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.spotlight-card--upcoming {
  border-color: var(--p-blue-200, #bfdbfe);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--p-blue-50, #eff6ff) 80%, transparent),
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

.spotlight-context {
  font-size: 0.82rem;
  color: var(--color-text-muted, #64748b);
}

.spotlight-datetime {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-primary-hover);
}

.spotlight-team {
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1.25;
}

.spotlight-team-link {
  color: inherit;
  text-decoration: none;
}

.spotlight-team-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.spotlight-teams-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.5rem;
}

.spotlight-vs {
  color: var(--color-text-muted, #64748b);
  font-weight: 500;
}

.fixture-list-card :deep(.p-card-body) {
  padding-top: 0.85rem;
}

.fixture-empty {
  margin: 0;
  font-size: 0.9rem;
}

.fixture-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.fixture-item {
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--color-border);
}

.fixture-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.fixture-item-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}

.fixture-status-tag :deep(.p-tag-label) {
  font-size: 0.72rem;
}

.fixture-context {
  font-size: 0.8rem;
}

.fixture-teams {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem;
  font-weight: 600;
}

.fixture-team-link {
  color: inherit;
  text-decoration: none;
}

.fixture-team-link:hover {
  color: var(--color-primary-hover);
  text-decoration: underline;
}

.fixture-teams .is-winner,
.fixture-team-link.is-winner {
  color: var(--color-success);
}

.fixture-team-link.is-winner:hover {
  color: var(--color-success);
  filter: brightness(0.92);
  text-decoration: underline;
}

.fixture-vs {
  color: var(--color-text-muted, #64748b);
  font-weight: 500;
  font-size: 0.9rem;
}

.fixture-inline-score {
  font-weight: 700;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.fixture-time {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
}
</style>
