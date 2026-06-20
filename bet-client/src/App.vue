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

function formatAverage(value: number | null): string {
  if (value === null) return '—';
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatPercent(value: number): string {
  return value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

const matchesWithStatsCount = computed(() => {
  if (!summary.value) return 0;
  return summary.value.finishedMatches.filter((m) => m.homeCorners !== null).length;
});

const remainingMatchCount = computed(() => TOURNAMENT_TOTAL_MATCHES - finishedMatchCount.value);

const finishedMatchPercent = computed(() =>
  TOURNAMENT_TOTAL_MATCHES > 0 ? (finishedMatchCount.value / TOURNAMENT_TOTAL_MATCHES) * 100 : 0,
);

const cornersReached = computed(() => {
  if (!summary.value) return false;
  return summary.value.totals.corners >= summary.value.targets.corners;
});

const yellowCardsReached = computed(() => {
  if (!summary.value) return false;
  return summary.value.totals.yellowCards >= summary.value.targets.yellowCards;
});

const avgCornersPerMatch = computed(() => {
  if (!summary.value || matchesWithStatsCount.value === 0) return null;
  return summary.value.totals.corners / matchesWithStatsCount.value;
});

const avgYellowCardsPerMatch = computed(() => {
  if (!summary.value || matchesWithStatsCount.value === 0) return null;
  return summary.value.totals.yellowCards / matchesWithStatsCount.value;
});

const requiredAvgCornersPerMatch = computed(() => {
  if (!summary.value || cornersReached.value || remainingMatchCount.value <= 0) return null;
  const remaining = summary.value.targets.corners - summary.value.totals.corners;
  return remaining / remainingMatchCount.value;
});

const requiredAvgYellowCardsPerMatch = computed(() => {
  if (!summary.value || yellowCardsReached.value || remainingMatchCount.value <= 0) return null;
  const remaining = summary.value.targets.yellowCards - summary.value.totals.yellowCards;
  return remaining / remainingMatchCount.value;
});

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
              <div class="progress-track-wrap">
                <div class="progress-tooltip" aria-hidden="true">
                  <span>Korner: %{{ formatPercent(summary.progress.corners) }}</span>
                  <span>Maçlar: {{ finishedMatchCount }}/{{ TOURNAMENT_TOTAL_MATCHES }} (%{{ formatPercent(finishedMatchPercent) }})</span>
                </div>
                <div
                  class="progress-track"
                  tabindex="0"
                  role="progressbar"
                  :aria-valuenow="summary.progress.corners"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="`Korner %${formatPercent(summary.progress.corners)}, oynanan maçlar %${formatPercent(finishedMatchPercent)}`"
                >
                  <div class="progress-track-fills">
                    <div
                      class="progress-fill matches"
                      :style="{ width: progressWidth(finishedMatchPercent) }"
                      aria-hidden="true"
                    />
                    <div
                      class="progress-fill corners"
                      :class="{ reached: cornersReached }"
                      :style="{ width: progressWidth(summary.progress.corners) }"
                    />
                  </div>
                  <div
                    v-if="finishedMatchPercent > 0 && summary.progress.corners >= finishedMatchPercent"
                    class="progress-marker"
                    :style="{ left: progressWidth(finishedMatchPercent) }"
                    aria-hidden="true"
                  />
                </div>
                <div class="progress-legend">
                  <span class="legend-item">
                    <span class="legend-swatch corners" aria-hidden="true" />
                    Korner
                  </span>
                  <span class="legend-item">
                    <span class="legend-swatch matches" aria-hidden="true" />
                    Maçlar {{ finishedMatchCount }}/{{ TOURNAMENT_TOTAL_MATCHES }}
                    <span class="legend-percent">(%{{ formatPercent(finishedMatchPercent) }})</span>
                  </span>
                </div>
              </div>
              <p v-if="cornersReached" class="progress-done">Hedef tuttu</p>
              <dl class="progress-pace">
                <div class="pace-row">
                  <dt>Biten maçlarda kullanılan ortalama korner</dt>
                  <dd>{{ formatAverage(avgCornersPerMatch) }}</dd>
                </div>
                <div v-if="!cornersReached" class="pace-row">
                  <dt>Kalan maçlarda gereken ortalama korner</dt>
                  <dd>{{ formatAverage(requiredAvgCornersPerMatch) }}</dd>
                </div>
              </dl>
            </article>

            <article class="progress-card">
              <div class="progress-header">
                <h2><YellowCardIcon :size="20" /> Sarı Kart</h2>
                <span class="progress-meta">
                  {{ summary.totals.yellowCards }} / {{ summary.targets.yellowCards }}
                  <span class="progress-percent">(%{{ summary.progress.yellowCards.toFixed(1) }})</span>
                </span>
              </div>
              <div class="progress-track-wrap">
                <div class="progress-tooltip" aria-hidden="true">
                  <span>Sarı kart: %{{ formatPercent(summary.progress.yellowCards) }}</span>
                  <span>Maçlar: {{ finishedMatchCount }}/{{ TOURNAMENT_TOTAL_MATCHES }} (%{{ formatPercent(finishedMatchPercent) }})</span>
                </div>
                <div
                  class="progress-track"
                  tabindex="0"
                  role="progressbar"
                  :aria-valuenow="summary.progress.yellowCards"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-label="`Sarı kart %${formatPercent(summary.progress.yellowCards)}, oynanan maçlar %${formatPercent(finishedMatchPercent)}`"
                >
                  <div class="progress-track-fills">
                    <div
                      class="progress-fill matches"
                      :style="{ width: progressWidth(finishedMatchPercent) }"
                      aria-hidden="true"
                    />
                    <div
                      class="progress-fill cards"
                      :class="{ reached: yellowCardsReached }"
                      :style="{ width: progressWidth(summary.progress.yellowCards) }"
                    />
                  </div>
                  <div
                    v-if="finishedMatchPercent > 0 && summary.progress.yellowCards >= finishedMatchPercent"
                    class="progress-marker"
                    :style="{ left: progressWidth(finishedMatchPercent) }"
                    aria-hidden="true"
                  />
                </div>
                <div class="progress-legend">
                  <span class="legend-item">
                    <span class="legend-swatch cards" aria-hidden="true" />
                    Sarı kart
                  </span>
                  <span class="legend-item">
                    <span class="legend-swatch matches" aria-hidden="true" />
                    Maçlar {{ finishedMatchCount }}/{{ TOURNAMENT_TOTAL_MATCHES }}
                    <span class="legend-percent">(%{{ formatPercent(finishedMatchPercent) }})</span>
                  </span>
                </div>
              </div>
              <p v-if="yellowCardsReached" class="progress-done">Hedef tuttu</p>
              <dl class="progress-pace">
                <div class="pace-row">
                  <dt>Biten maçlarda çıkan ortalama sarı kart</dt>
                  <dd>{{ formatAverage(avgYellowCardsPerMatch) }}</dd>
                </div>
                <div v-if="!yellowCardsReached" class="pace-row">
                  <dt>Kalan maçlarda gereken ortalama sarı kart</dt>
                  <dd>{{ formatAverage(requiredAvgYellowCardsPerMatch) }}</dd>
                </div>
              </dl>
            </article>
          </section>

          <section class="spotlight-match">
            <div
              v-if="summary.spotlightMatch"
              class="next-match-card"
              :class="{ live: summary.spotlightMatch.kind === 'live' }"
            >
              <template v-if="summary.spotlightMatch.kind === 'live'">
                <div class="spotlight-live-header">
                  <div class="spotlight-live-header-content">
                    <span class="live-badge">CANLI</span>
                    <p class="next-match-label">{{ summary.spotlightMatch.roundLabel ?? 'Maç' }}</p>
                  </div>
                  <p class="live-data-note">Veriler güncel olmayabilir. Kontrol ediniz.</p>
                </div>
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
                <div class="next-match-compact">
                  <div class="next-match-compact-meta">
                    <span class="spotlight-eyebrow">Sıradaki Maç</span>
                    <span class="next-match-label">{{ summary.spotlightMatch.roundLabel ?? 'Maç' }}</span>
                  </div>
                  <p class="next-match-teams">
                    {{ summary.spotlightMatch.homeTeam ?? 'TBD' }}
                    <span class="vs">vs</span>
                    {{ summary.spotlightMatch.awayTeam ?? 'TBD' }}
                  </p>
                  <time class="next-match-date" :datetime="summary.spotlightMatch.scheduledAt">
                    {{ formatDate(summary.spotlightMatch.scheduledAt) }}
                  </time>
                </div>
              </template>
            </div>
            <p v-else class="empty-note">Planlanmış maç kalmadı.</p>
          </section>
        </div>

        <section class="matches">
          <div class="section-header">
            <h2>Oynanan Maçlar</h2>
            <span class="section-meta">
              {{ finishedMatchCount }} / {{ TOURNAMENT_TOTAL_MATCHES }}
              <span class="section-meta-percent">(%{{ formatPercent(finishedMatchPercent) }})</span>
            </span>
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
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.progress-section {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  min-width: 0;
}

.spotlight-match {
  min-width: 0;
}

.spotlight-live-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}

.spotlight-live-header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.spotlight-live-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.next-match-compact {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  flex-wrap: wrap;
}

.next-match-compact-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 8rem;
}

.spotlight-eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8b98a5;
  font-weight: 600;
}

.next-match-compact .next-match-teams {
  flex: 1;
  min-width: 12rem;
  margin: 0;
}

.next-match-compact .next-match-date {
  margin: 0;
  white-space: nowrap;
}

.next-match-card.live {
  border-color: #dc2626;
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.25);
}

.live-badge {
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

.progress-track-wrap {
  position: relative;
}

.progress-track-wrap:hover .progress-tooltip,
.progress-track-wrap:focus-within .progress-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

.progress-tooltip {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.5rem);
  transform: translate(-50%, 0.25rem);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.4rem;
  background: #0f1419;
  border: 1px solid #2f3b4d;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  font-size: 0.78rem;
  color: #e2e8f0;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
  z-index: 5;
}

.progress-tooltip span {
  font-variant-numeric: tabular-nums;
}

.progress-track {
  position: relative;
  height: 0.75rem;
}

.progress-track-fills {
  position: absolute;
  inset: 0;
  background: #0f1419;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
  max-width: 100%;
}

.progress-marker {
  position: absolute;
  top: -2px;
  bottom: -2px;
  width: 2px;
  margin-left: -1px;
  background: #f8fafc;
  border-radius: 1px;
  box-shadow: 0 0 0 1px rgba(15, 20, 25, 0.65);
  z-index: 3;
  pointer-events: none;
}

.progress-fill.matches {
  z-index: 1;
  background: linear-gradient(90deg, #475569, #64748b);
}

.progress-fill.corners {
  z-index: 2;
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.progress-fill.cards {
  z-index: 2;
  background: linear-gradient(90deg, #ca8a04, #facc15);
}

.progress-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #8b98a5;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.legend-swatch {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.legend-swatch.corners {
  background: linear-gradient(90deg, #2563eb, #38bdf8);
}

.legend-swatch.cards {
  background: linear-gradient(90deg, #ca8a04, #facc15);
}

.legend-swatch.matches {
  background: linear-gradient(90deg, #475569, #64748b);
}

.legend-percent {
  font-variant-numeric: tabular-nums;
}

.progress-fill.reached {
  background: linear-gradient(90deg, #15803d, #4ade80);
}

.progress-done {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #4ade80;
}

.progress-pace {
  margin: 0.75rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pace-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 0.85rem;
}

.pace-row dt {
  margin: 0;
  color: #8b98a5;
  font-weight: 400;
}

.pace-row dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
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

.section-meta-percent {
  margin-left: 0.25rem;
}

.next-match-label {
  margin: 0;
  font-size: 0.85rem;
  color: #8b98a5;
}

.next-match-teams {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  text-align: center;
}

.vs {
  color: #8b98a5;
  font-weight: 400;
  margin: 0 0.35rem;
}

.next-match-date {
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

  .progress-section {
    grid-template-columns: 1fr;
  }

  .next-match-compact {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
  }

  .next-match-compact .next-match-teams {
    font-size: 1rem;
  }

  .spotlight-live-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-bottom: 0.35rem;
    gap: 0.35rem;
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
