<script setup lang="ts">
import { computed } from 'vue';
import type { PosterGroup, PosterThirdPick } from '@/types/bracket-export';
import type { BracketTeam, ResolvedMatch } from '@/types/bracket';
import {
  BRACKET_FINAL,
  BRACKET_LEFT,
  BRACKET_RIGHT,
  BRACKET_THIRD_PLACE,
} from '@/utils/bracket-layout';
import BracketExportMatch from '@/components/bracket/BracketExportMatch.vue';

const HALF_ROWS = 4;

const props = defineProps<{
  matches: ResolvedMatch[];
  displayName: string;
  combinationNo: number;
  champion: BracketTeam | null;
  groups: PosterGroup[];
  selectedThirds: PosterThirdPick[];
}>();

const matchByNumber = computed(() => new Map(props.matches.map((m) => [m.number, m])));

const exportedAt = computed(() =>
  new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
);

function getMatch(number: number): ResolvedMatch | undefined {
  return matchByNumber.value.get(number);
}

function gridRow(index: number): string {
  return `${index + 1} / ${index + 2}`;
}

function gridRowSpan(startIndex: number, span: number): string {
  return `${startIndex + 1} / ${startIndex + span + 1}`;
}
</script>

<template>
  <div class="poster">
    <header class="poster-header">
      <div class="poster-brand">
        <span class="poster-icon" aria-hidden="true">⚽</span>
        <div>
          <p class="poster-kicker">2026 Dünya Kupası</p>
          <h1 class="poster-title">Bracket Tahmini</h1>
        </div>
      </div>
      <div class="poster-meta">
        <p class="poster-user">{{ displayName }}</p>
        <p class="poster-date">{{ exportedAt }}</p>
        <p v-if="champion" class="poster-champion">
          <span class="trophy" aria-hidden="true">🏆</span>
          {{ champion.name }}
        </p>
      </div>
    </header>

    <section class="poster-section">
      <h2 class="section-title">Grup sıralamaları</h2>
      <div class="groups-grid">
        <article v-for="group in groups" :key="group.code" class="group-card">
          <h3 class="group-code">Grup {{ group.code }}</h3>
          <ul class="group-list">
            <li
              v-for="row in group.rows"
              :key="row.rank"
              class="group-row"
              :class="`group-row--${row.badge}`"
            >
              <span class="group-rank">{{ row.rank }}</span>
              <span class="group-name">{{ row.name }}</span>
            </li>
          </ul>
        </article>
      </div>
    </section>

    <section class="poster-section">
      <h2 class="section-title">En iyi 8 üçüncü</h2>
      <div class="thirds-row">
        <div v-for="third in selectedThirds" :key="third.code" class="third-pill">
          <span class="third-pill-code">{{ third.code }}</span>
          <span class="third-pill-name">{{ third.name }}</span>
        </div>
      </div>
    </section>

    <section class="poster-section poster-section--bracket">
      <h2 class="section-title">Eleme ağacı</h2>
      <div class="mirror-bracket-wrap">
        <div class="mirror-bracket">
        <div class="half half-left">
          <div
            class="half-grid"
            :style="{ gridTemplateRows: `repeat(${HALF_ROWS}, minmax(88px, auto))` }"
          >
            <template v-for="(quarter, qi) in BRACKET_LEFT.quarters" :key="`lq-${qi}`">
              <div
                v-for="(pair, pi) in quarter.pairs"
                :key="`l32-${pair.roundOf16}`"
                class="cell cell-r32"
                :style="{ gridRow: gridRow(qi * 2 + pi), gridColumn: '1' }"
              >
                <div class="pair-stack">
                  <BracketExportMatch :match="getMatch(pair.feeders[0])" />
                  <BracketExportMatch :match="getMatch(pair.feeders[1])" />
                </div>
              </div>
              <div
                v-for="(pair, pi) in quarter.pairs"
                :key="`l16-${pair.roundOf16}`"
                class="cell cell-advance cell-out"
                :style="{ gridRow: gridRow(qi * 2 + pi), gridColumn: '2' }"
              >
                <BracketExportMatch :match="getMatch(pair.roundOf16)" />
              </div>
              <div
                class="cell cell-advance cell-out"
                :style="{ gridRow: gridRowSpan(qi * 2, 2), gridColumn: '3' }"
              >
                <BracketExportMatch :match="getMatch(quarter.quarterFinal)" />
              </div>
            </template>
            <div
              class="cell cell-advance cell-out cell-sf"
              :style="{ gridRow: `1 / ${HALF_ROWS + 1}`, gridColumn: '4' }"
            >
              <BracketExportMatch :match="getMatch(BRACKET_LEFT.semiFinal)" />
            </div>
          </div>
        </div>

        <div class="half-center">
          <p class="center-label">Final</p>
          <BracketExportMatch :match="getMatch(BRACKET_FINAL)" accent="gold" medal-mode="final" />
          <p class="center-label center-label--third">3.lük Maçı</p>
          <BracketExportMatch :match="getMatch(BRACKET_THIRD_PLACE)" medal-mode="third_place" />
        </div>

        <div class="half half-right">
          <div
            class="half-grid"
            :style="{ gridTemplateRows: `repeat(${HALF_ROWS}, minmax(88px, auto))` }"
          >
            <div
              class="cell cell-advance cell-in cell-sf"
              :style="{ gridRow: `1 / ${HALF_ROWS + 1}`, gridColumn: '1' }"
            >
              <BracketExportMatch :match="getMatch(BRACKET_RIGHT.semiFinal)" />
            </div>
            <template v-for="(quarter, qi) in BRACKET_RIGHT.quarters" :key="`rq-${qi}`">
              <div
                class="cell cell-advance cell-in"
                :style="{ gridRow: gridRowSpan(qi * 2, 2), gridColumn: '2' }"
              >
                <BracketExportMatch :match="getMatch(quarter.quarterFinal)" />
              </div>
              <div
                v-for="(pair, pi) in quarter.pairs"
                :key="`r16-${pair.roundOf16}`"
                class="cell cell-advance cell-in"
                :style="{ gridRow: gridRow(qi * 2 + pi), gridColumn: '3' }"
              >
                <BracketExportMatch :match="getMatch(pair.roundOf16)" />
              </div>
              <div
                v-for="(pair, pi) in quarter.pairs"
                :key="`r32-${pair.roundOf16}`"
                class="cell cell-r32"
                :style="{ gridRow: gridRow(qi * 2 + pi), gridColumn: '4' }"
              >
                <div class="pair-stack">
                  <BracketExportMatch :match="getMatch(pair.feeders[0])" />
                  <BracketExportMatch :match="getMatch(pair.feeders[1])" />
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
      </div>
    </section>

    <footer class="poster-footer">
      <span>Üçüncülük kombinasyonu #{{ combinationNo }}</span>
      <span>FIFA Annex C bracket yapısı</span>
    </footer>
  </div>
</template>

<style scoped>
.poster {
  width: 3000px;
  padding: 44px 52px 36px;
  box-sizing: border-box;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  color: #f8fafc;
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45, 212, 191, 0.18), transparent 60%),
    linear-gradient(165deg, #042f2e 0%, #0f766e 28%, #134e4a 55%, #0f172a 100%);
}

.poster-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.poster-brand {
  display: flex;
  align-items: center;
  gap: 18px;
}

.poster-icon {
  font-size: 52px;
  line-height: 1;
}

.poster-kicker {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5eead4;
}

.poster-title {
  margin: 0;
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.poster-meta {
  text-align: right;
}

.poster-user {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
}

.poster-date {
  margin: 0 0 12px;
  font-size: 14px;
  color: #94a3b8;
}

.poster-champion {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.15));
  border: 1px solid rgba(251, 191, 36, 0.45);
  font-size: 18px;
  font-weight: 800;
  color: #fde68a;
}

.poster-section {
  margin-bottom: 32px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #99f6e4;
  text-align: center;
}

.poster-section--bracket {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
}

.group-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  padding: 12px 14px;
}

.group-code {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 800;
  color: #5eead4;
}

.group-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.group-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  color: #1e293b;
}

.group-row--green {
  background: linear-gradient(90deg, #ecfdf5, #d1fae5);
}

.group-row--yellow {
  background: linear-gradient(90deg, #fffbeb, #fef3c7);
}

.group-row--red {
  background: linear-gradient(90deg, #fef2f2, #fee2e2);
  color: #64748b;
}

.group-rank {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #0f766e;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}

.group-row--red .group-rank {
  background: #94a3b8;
}

.group-name {
  flex: 1;
  font-weight: 700;
  line-height: 1.2;
}

.thirds-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.third-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.third-pill-code {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #ccfbf1;
  color: #0f766e;
  font-size: 13px;
  font-weight: 800;
}

.third-pill-name {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
}

.mirror-bracket-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.mirror-bracket {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 16px;
  width: fit-content;
}

.half {
  flex: 0 0 auto;
}

.half-grid {
  display: grid;
  column-gap: 16px;
  row-gap: 0;
  height: 100%;
}

.half-left .half-grid {
  grid-template-columns: 200px 180px 170px 160px;
}

.half-right .half-grid {
  grid-template-columns: 160px 170px 180px 200px;
}

.cell {
  display: flex;
  position: relative;
  min-height: 0;
}

.cell-r32 {
  align-items: stretch;
  padding: 4px 0;
}

.cell-advance {
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.cell-out::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -10px;
  width: 10px;
  height: 2px;
  background: rgba(255, 255, 255, 0.35);
}

.cell-in::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -10px;
  width: 10px;
  height: 2px;
  background: rgba(255, 255, 255, 0.35);
}

.half-center {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 14px;
  padding: 0 8px;
  align-self: center;
}

.center-label {
  margin: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #99f6e4;
}

.center-label--third {
  margin-top: 8px;
  color: #cbd5e1;
}

.pair-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.poster-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 13px;
  color: #64748b;
}
</style>
