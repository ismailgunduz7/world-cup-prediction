<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';
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

const loading = ref(true);
const matches = ref<FixtureMatch[]>([]);

// Turnuva bitti: yalnızca oynanmış maçlar, en yeni maç en başta (tarihe göre azalan).
const finishedMatches = computed(() =>
  matches.value
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
);

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
    <PageHeader title="Fikstür" subtitle="Oynanan maçlar (en yeni maç başta)" />

    <Card class="fixture-list-card">
      <template #content>
        <p v-if="finishedMatches.length === 0" class="text-muted fixture-empty">
          Bitmiş maç yok.
        </p>

        <ul v-else class="fixture-list">
          <li v-for="match in finishedMatches" :key="match.id" class="fixture-item">
            <div class="fixture-item-top">
              <span class="fixture-context text-muted">{{ matchContext(match) }}</span>
            </div>
            <div class="fixture-teams">
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
            </div>
            <p class="fixture-time text-muted">{{ formatDate(match.scheduledAt) }}</p>
          </li>
        </ul>
      </template>
    </Card>
  </div>
</template>

<style scoped>
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
