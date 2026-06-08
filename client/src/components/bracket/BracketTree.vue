<script setup lang="ts">
import { computed } from 'vue';
import type { ResolvedMatch } from '@/types/bracket';
import {
  BRACKET_FINAL,
  BRACKET_QUARTER_FINALS,
  BRACKET_R32_PAIRS,
  BRACKET_SEMI_FINALS,
  BRACKET_THIRD_PLACE,
} from '@/utils/bracket-layout';
import { STAGE_LABELS } from '@/utils/bracket';
import BracketMatchCard from '@/components/bracket/BracketMatchCard.vue';

const PAIR_COUNT = BRACKET_R32_PAIRS.length;

const props = defineProps<{
  matches: ResolvedMatch[];
  showTiers: boolean;
}>();

const emit = defineEmits<{
  (e: 'pick', matchNumber: number, teamId: number): void;
}>();

const matchByNumber = computed(() => new Map(props.matches.map((m) => [m.number, m])));

const roundHeaders = [
  STAGE_LABELS.round_of_32,
  STAGE_LABELS.round_of_16,
  STAGE_LABELS.quarter_final,
  STAGE_LABELS.semi_final,
  STAGE_LABELS.final,
] as const;

function getMatch(number: number): ResolvedMatch | undefined {
  return matchByNumber.value.get(number);
}

function onPick(matchNumber: number, teamId: number) {
  emit('pick', matchNumber, teamId);
}

/** Tek satır: grid satır indeksi 1 tabanlı. */
function gridRow(index: number): string {
  return `${index + 1} / ${index + 2}`;
}

/** Birden fazla satır kapsar (Son 16 çifti → çeyrek vb.). */
function gridRowSpan(startIndex: number, span: number): string {
  return `${startIndex + 1} / ${startIndex + span + 1}`;
}
</script>

<template>
  <div class="bracket-root">
    <!-- Masaüstü: besleyici maçlara göre dikey hizalı ağaç -->
    <div class="bracket-aligned">
      <div class="bracket-header-row">
        <span v-for="label in roundHeaders" :key="label" class="round-title">{{ label }}</span>
      </div>

      <div
        class="bracket-grid"
        :style="{ gridTemplateRows: `repeat(${PAIR_COUNT}, minmax(9.5rem, auto))` }"
      >
        <!-- Son 32 -->
        <div
          v-for="(pair, i) in BRACKET_R32_PAIRS"
          :key="`r32-${pair.roundOf16}`"
          class="grid-cell grid-r32"
          :style="{ gridRow: gridRow(i), gridColumn: '1' }"
        >
          <div class="pair-group">
            <BracketMatchCard
              :match="getMatch(pair.feeders[0])"
              :show-tiers="showTiers"
              @pick="onPick"
            />
            <BracketMatchCard
              :match="getMatch(pair.feeders[1])"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>

        <!-- Son 16 — her biri besleyici çiftin ortasında -->
        <div
          v-for="(pair, i) in BRACKET_R32_PAIRS"
          :key="`r16-${pair.roundOf16}`"
          class="grid-cell grid-advance grid-r16"
          :style="{ gridRow: gridRow(i), gridColumn: '2' }"
        >
          <BracketMatchCard
            :match="getMatch(pair.roundOf16)"
            :show-tiers="showTiers"
            @pick="onPick"
          />
        </div>

        <!-- Çeyrek final — iki Son 16’nın ortasında -->
        <div
          v-for="(qf, i) in BRACKET_QUARTER_FINALS"
          :key="`qf-${qf}`"
          class="grid-cell grid-advance grid-qf"
          :style="{ gridRow: gridRowSpan(i * 2, 2), gridColumn: '3' }"
        >
          <BracketMatchCard
            :match="getMatch(qf)"
            :show-tiers="showTiers"
            @pick="onPick"
          />
        </div>

        <!-- Yarı final — iki çeyreğin ortasında -->
        <div
          v-for="(sf, i) in BRACKET_SEMI_FINALS"
          :key="`sf-${sf}`"
          class="grid-cell grid-advance grid-sf"
          :style="{ gridRow: gridRowSpan(i * 4, 4), gridColumn: '4' }"
        >
          <BracketMatchCard
            :match="getMatch(sf)"
            :show-tiers="showTiers"
            @pick="onPick"
          />
        </div>

        <!-- Final + 3.lük — tüm ağacın ortasında -->
        <div
          class="grid-cell grid-finals"
          :style="{ gridRow: `1 / ${PAIR_COUNT + 1}`, gridColumn: '5' }"
        >
          <div class="finals-stack">
            <BracketMatchCard
              :match="getMatch(BRACKET_FINAL)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
            <div class="third-place">
              <span class="third-label">{{ STAGE_LABELS.third_place }}</span>
              <BracketMatchCard
                :match="getMatch(BRACKET_THIRD_PLACE)"
                :show-tiers="showTiers"
                @pick="onPick"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobil: tur tur gruplu liste -->
    <div class="bracket-stacked">
      <section class="bracket-round">
        <h3 class="round-title">{{ STAGE_LABELS.round_of_32 }}</h3>
        <div class="round-body">
          <div
            v-for="pair in BRACKET_R32_PAIRS"
            :key="`m-${pair.roundOf16}`"
            class="pair-group"
          >
            <BracketMatchCard
              :match="getMatch(pair.feeders[0])"
              :show-tiers="showTiers"
              @pick="onPick"
            />
            <BracketMatchCard
              :match="getMatch(pair.feeders[1])"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>
      </section>

      <section class="bracket-round">
        <h3 class="round-title">{{ STAGE_LABELS.round_of_16 }}</h3>
        <div class="round-body">
          <div
            v-for="pair in BRACKET_R32_PAIRS"
            :key="`m16-${pair.roundOf16}`"
            class="pair-group pair-group--single"
          >
            <BracketMatchCard
              :match="getMatch(pair.roundOf16)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>
      </section>

      <section class="bracket-round">
        <h3 class="round-title">{{ STAGE_LABELS.quarter_final }}</h3>
        <div class="round-body">
          <div
            v-for="qf in BRACKET_QUARTER_FINALS"
            :key="`mqf-${qf}`"
            class="pair-group pair-group--single"
          >
            <BracketMatchCard
              :match="getMatch(qf)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>
      </section>

      <section class="bracket-round">
        <h3 class="round-title">{{ STAGE_LABELS.semi_final }}</h3>
        <div class="round-body">
          <div
            v-for="sf in BRACKET_SEMI_FINALS"
            :key="`msf-${sf}`"
            class="pair-group pair-group--single"
          >
            <BracketMatchCard
              :match="getMatch(sf)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>
      </section>

      <section class="bracket-round">
        <h3 class="round-title">{{ STAGE_LABELS.final }}</h3>
        <div class="round-body">
          <div class="pair-group pair-group--single">
            <BracketMatchCard
              :match="getMatch(BRACKET_FINAL)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
          <div class="pair-group pair-group--single">
            <span class="third-label">{{ STAGE_LABELS.third_place }}</span>
            <BracketMatchCard
              :match="getMatch(BRACKET_THIRD_PLACE)"
              :show-tiers="showTiers"
              @pick="onPick"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bracket-root {
  padding-bottom: 0.5rem;
  max-width: 100%;
}

/* —— Hizalı masaüstü ağaç (≈5×13.5rem + boşluklar; dar ekranda yığılmış düzen) —— */

.bracket-aligned {
  min-width: min-content;
  max-width: 100%;
}

.bracket-header-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(11rem, 13.5rem));
  gap: 0 1rem;
  position: sticky;
  top: calc(var(--header-height, 64px) + env(safe-area-inset-top, 0px));
  z-index: 20;
  margin-bottom: 0.6rem;
  padding: 0.35rem 0 0.65rem;
  background: var(--color-bg);
  box-shadow: 0 1px 0 var(--color-border);
}

.bracket-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(11rem, 13.5rem));
  gap: 0 1rem;
  row-gap: 0;
}

.round-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.bracket-stacked .round-title {
  position: sticky;
  top: calc(var(--header-height, 64px) + env(safe-area-inset-top, 0px));
  z-index: 20;
  padding: 0.35rem 0;
  background: var(--color-bg);
  box-shadow: 0 1px 0 var(--color-border);
}

.grid-cell {
  display: flex;
  min-height: 0;
  position: relative;
}

.grid-r32 {
  align-items: stretch;
  padding: 0.2rem 0;
}

.grid-advance {
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0;
}

.grid-advance::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -0.55rem;
  width: 0.55rem;
  height: 1px;
  background: var(--color-border);
}

.grid-finals {
  align-items: center;
  justify-content: center;
  padding: 0.2rem 0;
}

.grid-finals::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -0.55rem;
  width: 0.55rem;
  height: 1px;
  background: var(--color-border);
}

.grid-advance > :deep(.match-card),
.grid-finals .finals-stack > :deep(.match-card:first-child) {
  width: 100%;
}

.pair-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
}

.finals-stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1rem;
  width: 100%;
  height: 100%;
}

.third-place {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.third-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

/* —— Mobil yedek düzen —— */

.bracket-stacked {
  display: none;
}

.pair-group--single {
  padding: 0.45rem;
}

@media (max-width: 1199px) {
  .bracket-aligned {
    display: none;
  }

  .bracket-stacked {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .bracket-round {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .round-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.6rem;
  }
}

@media (min-width: 480px) and (max-width: 1199px) {
  .round-body {
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  }
}
</style>
