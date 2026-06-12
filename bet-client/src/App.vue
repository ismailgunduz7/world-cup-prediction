<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { fetchBetProgress, type BetProgressSummary } from './api';
import CornerFlagIcon from './components/icons/CornerFlagIcon.vue';
import YellowCardIcon from './components/icons/YellowCardIcon.vue';

const loading = ref(true);
const error = ref<string | null>(null);
const summary = ref<BetProgressSummary | null>(null);

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function formatStat(value: number | null): string {
  return value === null ? '—' : String(value);
}

function formatLiveStat(value: number | null): string {
  return String(value ?? 0);
}

function progressWidth(percent: number): string {
  return `${Math.min(100, Math.max(0, percent))}%`;
}

function formatOverBetLine(target: number, label: string): string {
  const line = target - 0.5;
  return `${label} ${line.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Üst`;
}

const subtitle = computed(() => {
  if (!summary.value) return null;
  return `${formatOverBetLine(summary.value.targets.corners, 'Korner')} · ${formatOverBetLine(summary.value.targets.yellowCards, 'Sarı Kart')}`;
});

/**
 * 72x group phase matches
 * 16x round of 32 matches
 * 8x round of 16 matches
 * 4x quarter final matches
 * 2x semi final matches
 * 1x third place match
 * 1x final match
 */
const TOURNAMENT_TOTAL_MATCHES = 72 + 16 + 8 + 4 + 2 + 1 + 1;

const finishedMatchCount = computed(() => summary.value?.finishedMatches.length ?? 0);

const cornersReached = computed(() => {
  if (!summary.value) return false;
  return summary.value.totals.corners >= summary.value.targets.corners;
});

const yellowCardsReached = computed(() => {
  if (!summary.value) return false;
  return summary.value.totals.yellowCards >= summary.value.targets.yellowCards;
});

const spotlightTitle = computed(() =>
  summary.value?.spotlightMatch?.kind === 'live' ? 'Canlı Maç' : 'Sıradaki Maç',
);

onMounted(async () => {
  try {
    summary.value = await fetchBetProgress();
  } catch {
    error.value = 'Veriler yüklenemedi. Lütfen daha sonra tekrar deneyin.';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page">
    <header class="header">
      <p class="eyebrow">2026 Dünya Kupası</p>
      <h1>Bahis İlerlemesi</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </header>

    <main class="content">
      <p v-if="loading" class="state">Yükleniyor…</p>
      <p v-else-if="error" class="state error">{{ error }}</p>

      <template v-else-if="summary">
        <div class="overview">
          <section class="progress-section">
            <article class="progress-card">
              <div class="progress-header">
                <h2><CornerFlagIcon :size="20" /> Korner</h2>
                <span class="progress-meta">
                  {{ summary.totals.corners }} / {{ summary.targets.corners }}
                  <span class="progress-percent">(%{{ summary.progress.corners.toFixed(1) }})</span>
                </span>
              </div>
              <div class="progress-track" role="progressbar" :aria-valuenow="summary.progress.corners" aria-valuemin="0" aria-valuemax="100">
                <div
                  class="progress-fill corners"
                  :class="{ reached: cornersReached }"
                  :style="{ width: progressWidth(summary.progress.corners) }"
                />
              </div>
              <p v-if="cornersReached" class="progress-done">Hedef tuttu</p>
            </article>

            <article class="progress-card">
              <div class="progress-header">
                <h2><YellowCardIcon :size="20" /> Sarı Kart</h2>
                <span class="progress-meta">
                  {{ summary.totals.yellowCards }} / {{ summary.targets.yellowCards }}
                  <span class="progress-percent">(%{{ summary.progress.yellowCards.toFixed(1) }})</span>
                </span>
              </div>
              <div class="progress-track" role="progressbar" :aria-valuenow="summary.progress.yellowCards" aria-valuemin="0" aria-valuemax="100">
                <div
                  class="progress-fill cards"
                  :class="{ reached: yellowCardsReached }"
                  :style="{ width: progressWidth(summary.progress.yellowCards) }"
                />
              </div>
              <p v-if="yellowCardsReached" class="progress-done">Hedef tuttu</p>
            </article>
          </section>

          <section class="spotlight-match">
            <h2>{{ spotlightTitle }}</h2>
            <div
              v-if="summary.spotlightMatch"
              class="next-match-card"
              :class="{ live: summary.spotlightMatch.kind === 'live' }"
            >
              <p class="next-match-label">
                {{ summary.spotlightMatch.roundLabel ?? 'Maç' }}
                <span v-if="summary.spotlightMatch.kind === 'live'" class="live-badge">CANLI</span>
              </p>
              
              <template v-if="summary.spotlightMatch.kind === 'live'">
                <p class="live-data-note">Veriler güncel olmayabilir. Kontrol ediniz.</p>
                <div class="live-match-body">
                  <div class="match-scoreboard">
                    <div class="team-block">
                      <span class="team-name">{{ summary.spotlightMatch.homeTeam ?? 'TBD' }}</span>
                      <span class="team-score">{{ formatLiveStat(summary.spotlightMatch.homeScore) }}</span>
                    </div>
                    <span class="score-divider">-</span>
                    <div class="team-block away">
                      <span class="team-score">{{ formatLiveStat(summary.spotlightMatch.awayScore) }}</span>
                      <span class="team-name">{{ summary.spotlightMatch.awayTeam ?? 'TBD' }}</span>
                    </div>
                    <div class="team-block">
                      <span class="team-stats">
                        <span class="stat-pair" title="Korner">
                          <CornerFlagIcon :size="16" />
                          {{ formatLiveStat(summary.spotlightMatch.homeCorners) }}
                        </span>
                        <span class="stat-pair" title="Sarı kart">
                          <YellowCardIcon :size="16" />
                          {{ formatLiveStat(summary.spotlightMatch.homeYellowCards) }}
                        </span>
                      </span>
                    </div>
                    <div class="score-divider"></div>
                    <div class="team-block away">
                      <span class="team-stats">
                        <span class="stat-pair" title="Korner">
                          <CornerFlagIcon :size="16" />
                          {{ formatLiveStat(summary.spotlightMatch.awayCorners) }}
                        </span>
                        <span class="stat-pair" title="Sarı kart">
                          <YellowCardIcon :size="16" />
                          {{ formatLiveStat(summary.spotlightMatch.awayYellowCards) }}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </template>

              <template v-else>
                <p class="next-match-teams">
                  {{ summary.spotlightMatch.homeTeam ?? 'TBD' }}
                  <span class="vs">vs</span>
                  {{ summary.spotlightMatch.awayTeam ?? 'TBD' }}
                </p>
              </template>

              <p v-if="summary.spotlightMatch.kind !== 'live'" class="next-match-date">
                {{ formatDate(summary.spotlightMatch.scheduledAt) }}
              </p>
            </div>
            <p v-else class="empty-note">Planlanmış maç kalmadı.</p>
          </section>
        </div>

        <section class="matches">
          <div class="section-header">
            <h2>Oynanan Maçlar</h2>
            <span class="section-meta">{{ finishedMatchCount }} / {{ TOURNAMENT_TOTAL_MATCHES }}</span>
          </div>
          <p v-if="summary.finishedMatches.length === 0" class="empty-note">Henüz bitmiş maç yok.</p>
          <div v-else class="match-list">
            <article v-for="(match, index) in summary.finishedMatches" :key="index" class="match-card">
              <div class="match-head">
                <span class="match-label">{{ match.roundLabel ?? 'Maç' }}</span>
                <time :datetime="match.scheduledAt">{{ formatDate(match.scheduledAt) }}</time>
              </div>
              <div class="match-scoreboard">
                <div class="team-block">
                  <span class="team-name">{{ match.homeTeam ?? 'TBD' }}</span>
                  <span class="team-score">{{ match.homeScore }}</span>
                </div>
                <span class="score-divider">-</span>
                <div class="team-block away">
                  <span class="team-score">{{ match.awayScore }}</span>
                  <span class="team-name">{{ match.awayTeam ?? 'TBD' }}</span>
                </div>
                <div class="team-block">
                  <span class="team-stats">
                    <span class="stat-pair" title="Korner">
                      <CornerFlagIcon :size="16" />
                      {{ formatStat(match.homeCorners) }}
                    </span>
                    <span class="stat-pair" title="Sarı kart">
                      <YellowCardIcon :size="16" />
                      {{ formatStat(match.homeYellowCards) }}
                    </span>
                  </span>
                </div>
                <div class="score-divider"></div>
                <div class="team-block away">
                  <span class="team-stats">
                    <span class="stat-pair" title="Korner">
                      <CornerFlagIcon :size="16" />
                      {{ formatStat(match.awayCorners) }}
                    </span>
                    <span class="stat-pair" title="Sarı kart">
                      <YellowCardIcon :size="16" />
                      {{ formatStat(match.awayYellowCards) }}
                    </span>
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.page {
  width: 100%;
  max-width: 80vw;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
}

.overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: stretch;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}

.next-match,
.spotlight-match {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.next-match h2,
.spotlight-match h2 {
  margin: 0 0 0.75rem;
  font-size: 1.1rem;
}

.next-match-card.live {
  border-color: #dc2626;
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.25);
}

.live-badge {
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  background: #dc2626;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  vertical-align: middle;
}

.live-match-body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.625rem;
  margin-top: 0.25rem;
  width: 100%;
}

.live-data-note {
  margin: 0;
  font-size: 0.78rem;
  color: #ca8a04;
  line-height: 1.4;
}

.next-match-card {
  flex: 1;
  background: #1a2332;
  border: 1px solid #2f3b4d;
  border-radius: 0.75rem;
  padding: 1rem 1.125rem;
}

.header {
  margin-bottom: 2rem;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8b98a5;
}

.header h1 {
  margin: 0;
  font-size: clamp(1.75rem, 4vw, 2.25rem);
}

.subtitle {
  margin: 0.5rem 0 0;
  color: #8b98a5;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.state {
  color: #8b98a5;
}

.state.error {
  color: #f87171;
}

.progress-card {
  background: #1a2332;
  border: 1px solid #2f3b4d;
  border-radius: 0.75rem;
  padding: 1rem 1.125rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.progress-header h2 {
  margin: 0;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.progress-meta {
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
}

.progress-percent {
  color: #8b98a5;
  margin-left: 0.25rem;
}

.progress-track {
  height: 0.75rem;
  background: #0f1419;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  max-width: 100%;
}

.progress-fill.corners {
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.progress-fill.cards {
  background: linear-gradient(90deg, #ca8a04, #facc15);
}

.progress-fill.reached {
  background: linear-gradient(90deg, #15803d, #4ade80);
}

.progress-done {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #4ade80;
}

.matches h2 {
  margin: 0;
  font-size: 1.1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.section-meta {
  font-size: 0.95rem;
  color: #8b98a5;
  font-variant-numeric: tabular-nums;
}

.next-match-label {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  color: #8b98a5;
}

.next-match-teams {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}

.vs {
  color: #8b98a5;
  font-weight: 400;
  margin: 0 0.35rem;
}

.next-match-date {
  margin: 0.5rem 0 0;
  color: #8b98a5;
  font-size: 0.9rem;
}

.empty-note {
  margin: 0;
  color: #8b98a5;
}

.match-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  row-gap: 1rem;
}

.match-card {
  background: #1a2332;
  border: 1px solid #2f3b4d;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  width: 100%;
}

@media (min-width: 900px) {
  .match-card {
    width: calc(50% - 0.5rem);
  }
}

.match-head {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: #8b98a5;
}

.match-scoreboard {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
}

.team-block {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 1rem;
  font-size: 1.2rem;
}

.team-block.away {
  justify-content: flex-start;
}

.team-name {
  font-weight: 600;
}

.team-score {
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.team-stats {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8rem;
  color: #8b98a5;
}

.team-block.away .team-stats {
  justify-content: flex-start;
}

.stat-pair {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
}

.score-divider {
  font-size: 1.25rem;
  color: #8b98a5;
  padding: 0 0.25rem;
}

@media (max-width: 767px) {
  .page {
    max-width: none;
    padding: 1rem 0.75rem 2rem;
  }

  .overview {
    grid-template-columns: 1fr;
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .progress-meta {
    font-size: 0.9rem;
  }

  .next-match-teams {
    font-size: 1rem;
  }

  .team-block {
    font-size: 1rem;
    gap: 0.5rem;
  }

  .team-score {
    font-size: 1.35rem;
  }

  .match-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
