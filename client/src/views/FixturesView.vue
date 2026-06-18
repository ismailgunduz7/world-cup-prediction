<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import TabBar from '@/components/TabBar.vue';
import api from '@/api/client';
import { isGroupFinalMatch } from '@/utils/match-round';

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
};

type FixtureFilter = 'planned' | 'finished';

type LiveSpotlightGroup =
  | { kind: 'single'; match: FixtureMatch }
  | { kind: 'group-final'; groupCode: string; matches: FixtureMatch[] };

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

const liveSpotlightGroups = computed<LiveSpotlightGroup[]>(() => {
  const groupFinalByCode = new Map<string, FixtureMatch[]>();
  const singles: FixtureMatch[] = [];

  for (const match of liveMatches.value) {
    if (isGroupFinalMatch(match)) {
      const code = match.groupCode!;
      const list = groupFinalByCode.get(code) ?? [];
      list.push(match);
      groupFinalByCode.set(code, list);
      continue;
    }
    singles.push(match);
  }

  const groups: LiveSpotlightGroup[] = singles.map((match) => ({ kind: 'single', match }));

  for (const [groupCode, groupMatches] of groupFinalByCode) {
    const sorted = [...groupMatches].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    if (sorted.length >= 2) {
      groups.push({ kind: 'group-final', groupCode, matches: sorted });
    } else {
      groups.push({ kind: 'single', match: sorted[0] });
    }
  }

  return groups.sort((a, b) => {
    const aTime = a.kind === 'single' ? a.match.scheduledAt : a.matches[0].scheduledAt;
    const bTime = b.kind === 'single' ? b.match.scheduledAt : b.matches[0].scheduledAt;
    return aTime.localeCompare(bTime);
  });
});

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
  if (match.homeScore === null || match.awayScore === null) return '– : –';
  return `${match.homeScore} - ${match.awayScore}`;
}

function matchContext(match: FixtureMatch) {
  const parts = [match.stageLabel];
  if (match.roundLabel) parts.push(match.roundLabel);
  return parts.join(' · ');
}

function winnerSide(match: FixtureMatch): 'home' | 'away' | null {
  if (match.homeScore === null || match.awayScore === null) return null;
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
    <section v-if="liveSpotlightGroups.length" class="spotlight-section">
      <template v-for="group in liveSpotlightGroups" :key="group.kind === 'single' ? group.match.id : `group-${group.groupCode}`">
        <Card
          v-if="group.kind === 'single'"
          class="spotlight-card spotlight-card--live"
        >
          <template #content>
            <div class="spotlight-top">
              <Tag value="CANLI" severity="warn" class="spotlight-badge" />
              <span class="spotlight-context">{{ matchContext(group.match) }}</span>
            </div>
            <div class="spotlight-scoreboard">
              <RouterLink
                v-if="group.match.homeTeam.id"
                :to="{ name: 'team-matches', params: { id: group.match.homeTeam.id }, query: { from: 'fixtures' } }"
                class="spotlight-team spotlight-team-link"
              >
                {{ group.match.homeTeam.name }}
              </RouterLink>
              <span v-else class="spotlight-team">{{ group.match.homeTeam.name }}</span>
              <span class="spotlight-score">{{ formatScore(group.match) }}</span>
              <RouterLink
                v-if="group.match.awayTeam.id"
                :to="{ name: 'team-matches', params: { id: group.match.awayTeam.id }, query: { from: 'fixtures' } }"
                class="spotlight-team spotlight-team-link"
              >
                {{ group.match.awayTeam.name }}
              </RouterLink>
              <span v-else class="spotlight-team">{{ group.match.awayTeam.name }}</span>
            </div>
            <p class="spotlight-time text-muted">{{ formatDate(group.match.scheduledAt) }}</p>
          </template>
        </Card>

        <Card v-else class="spotlight-card spotlight-card--live spotlight-card--group-final">
          <template #content>
            <div class="spotlight-top">
              <Tag value="CANLI" severity="warn" class="spotlight-badge" />
              <span class="spotlight-context">Grup {{ group.groupCode }} · Son Hafta</span>
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
                  :to="{ name: 'team-matches', params: { id: match.homeTeam.id }, query: { from: 'fixtures' } }"
                  class="spotlight-team spotlight-team-link"
                >
                  {{ match.homeTeam.name }}
                </RouterLink>
                <span v-else class="spotlight-team">{{ match.homeTeam.name }}</span>
                <span class="spotlight-score">{{ formatScore(match) }}</span>
                <RouterLink
                  v-if="match.awayTeam.id"
                  :to="{ name: 'team-matches', params: { id: match.awayTeam.id }, query: { from: 'fixtures' } }"
                  class="spotlight-team spotlight-team-link"
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

.spotlight-datetime {
  margin: 0 0 0.75rem;
  font-size: 1.05rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-primary-hover);
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

@media (max-width: 768px) {
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
