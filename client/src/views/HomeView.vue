<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';
import { rankLabel } from '@/utils/leaderboard';

type PlayerEntry = { rank: number; slug: string; displayName: string; totalScore: number; hasSelections: boolean };
type CompetitionBlock = { id: string; name: string; entries: PlayerEntry[] };
type TeamStanding = { rank: number; teamId: number; name: string; groupCode: string; tierName: string | null; totalPoints: number };

type MatchDto = {
  stage: string;
  status: string;
  homeTeam: { id: number | null; name: string };
  awayTeam: { id: number | null; name: string };
  homeScore: number | null;
  awayScore: number | null;
  homeScoreAet: number | null;
  awayScoreAet: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerTeamId: number | null;
};

const loading = ref(true);
const competitions = ref<CompetitionBlock[]>([]);
const teamStandings = ref<TeamStanding[]>([]);
const finalMatch = ref<MatchDto | null>(null);

const champion = computed(() => {
  const m = finalMatch.value;
  if (!m || m.winnerTeamId == null) return null;
  return m.winnerTeamId === m.homeTeam.id ? m.homeTeam.name : m.awayTeam.name;
});

function finalScoreText(m: MatchDto): string {
  const base = `${m.homeScore ?? 0} - ${m.awayScore ?? 0}`;
  if (m.homePenalties != null && m.awayPenalties != null) {
    return `${base} (pen. ${m.homePenalties}-${m.awayPenalties})`;
  }
  if (m.homeScoreAet != null && m.awayScoreAet != null) {
    return `${m.homeScoreAet} - ${m.awayScoreAet} (uzt.)`;
  }
  return base;
}

const topTeams = computed(() => teamStandings.value.slice(0, 5));

onMounted(async () => {
  const [{ data: leaderboard }, { data: matchesData }] = await Promise.all([
    api.get<{ competitions: CompetitionBlock[]; teamStandings: TeamStanding[] }>('/leaderboard'),
    api.get<{ matches: MatchDto[] }>('/matches'),
  ]);
  competitions.value = leaderboard.competitions.map((c) => ({ ...c, entries: c.entries.slice(0, 3) }));
  teamStandings.value = leaderboard.teamStandings;
  finalMatch.value =
    matchesData.matches.find((m) => m.stage === 'final' && m.status === 'finished') ?? null;
  loading.value = false;
});
</script>

<template>
  <LoadingState v-if="loading" />

  <div v-else class="page-stack">
    <PageHeader title="Turnuva Tamamlandı" subtitle="2026 Dünya Kupası tahmin ligi sona erdi" />

    <Card v-if="champion" class="champion-card">
      <template #content>
        <div class="champion-inner">
          <span class="champion-trophy">🏆</span>
          <div>
            <div class="champion-label">Dünya Kupası Şampiyonu</div>
            <div class="champion-name">{{ champion }}</div>
            <div v-if="finalMatch" class="champion-score">
              Final: {{ finalMatch.homeTeam.name }} {{ finalScoreText(finalMatch) }} {{ finalMatch.awayTeam.name }}
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="overview-grid">
      <Card v-for="comp in competitions" :key="comp.id" class="overview-card">
        <template #title>
          <div class="card-title-row">
            <span>{{ comp.name }}</span>
            <RouterLink :to="{ name: 'leaderboard', query: { tab: `comp:${comp.id}` } }" class="see-all">
              Tüm sıralama →
            </RouterLink>
          </div>
        </template>
        <template #content>
          <ul class="rank-list">
            <li v-for="entry in comp.entries" :key="entry.slug">
              <RouterLink
                v-if="entry.hasSelections"
                :to="{ name: 'player-points', params: { id: entry.slug }, query: { from: 'leaderboard' } }"
                class="rank-row rank-row-link"
              >
                <span class="rank-badge">{{ rankLabel(entry.rank) }}</span>
                <span class="rank-name">{{ entry.displayName }}</span>
                <strong class="rank-score">{{ entry.totalScore }}</strong>
              </RouterLink>
              <div v-else class="rank-row">
                <span class="rank-badge">{{ rankLabel(entry.rank) }}</span>
                <span class="rank-name">{{ entry.displayName }}</span>
                <strong class="rank-score">{{ entry.totalScore }}</strong>
              </div>
            </li>
          </ul>
        </template>
      </Card>

      <Card class="overview-card">
        <template #title>
          <div class="card-title-row">
            <span>Takım Puanları</span>
            <RouterLink to="/puan-durumu?tab=teams" class="see-all">Tümü →</RouterLink>
          </div>
        </template>
        <template #content>
          <ul class="rank-list">
            <li v-for="team in topTeams" :key="team.teamId">
              <RouterLink
                :to="{ name: 'team-matches', params: { id: team.teamId }, query: { from: 'home' } }"
                class="rank-row rank-row-link"
              >
                <span class="rank-badge">{{ rankLabel(team.rank) }}</span>
                <span class="rank-name">{{ team.name }}</span>
                <Tag :value="`Grup ${team.groupCode}`" severity="secondary" class="rank-tag" />
                <strong class="rank-score">{{ team.totalPoints }}</strong>
              </RouterLink>
            </li>
          </ul>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.champion-card :deep(.p-card-body) {
  background: linear-gradient(135deg, var(--color-primary, #1d4ed8), var(--color-primary-hover, #2563eb));
  color: #fff;
  border-radius: var(--p-card-border-radius, 12px);
}

.champion-inner {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.champion-trophy {
  font-size: 3rem;
  line-height: 1;
}

.champion-label {
  font-size: 0.85rem;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.champion-name {
  font-size: 1.8rem;
  font-weight: 800;
}

.champion-score {
  font-size: 0.85rem;
  opacity: 0.9;
  margin-top: 0.15rem;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.card-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.see-all {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-primary-hover);
  text-decoration: none;
  white-space: nowrap;
}

.see-all:hover {
  text-decoration: underline;
}

.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.35rem;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.rank-row-link:hover {
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
}

.rank-badge {
  min-width: 1.6rem;
  text-align: center;
  font-weight: 700;
}

.rank-name {
  flex: 1;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-tag {
  font-size: 0.7rem;
}

.rank-score {
  font-variant-numeric: tabular-nums;
}
</style>
