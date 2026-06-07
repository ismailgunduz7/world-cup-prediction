<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Message from 'primevue/message';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import GroupRankingEditor from '@/components/bracket/GroupRankingEditor.vue';
import BracketTree from '@/components/bracket/BracketTree.vue';
import api from '@/api/client';
import type { BracketPreview, BracketTeam, ResolvedMatch } from '@/types/bracket';
import { pruneWinners, resolveBracket } from '@/utils/bracket';

type GroupTeam = { id: number; name_tr: string };
type Group = { code: string; teams: GroupTeam[] };

const MAX_THIRDS = 8;

const loading = ref(true);
const groups = ref<Group[]>([]);
const rankings = ref<Record<string, number[]>>({});
const selectedThirds = ref<string[]>([]);

const preview = ref<BracketPreview | null>(null);
const winners = ref<Record<number, number>>({});
const generating = ref(false);
const stale = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const { data } = await api.get('/teams');
    groups.value = data.groups;
    const initial: Record<string, number[]> = {};
    for (const group of data.groups as Group[]) {
      initial[group.code] = group.teams.map((t) => t.id);
    }
    rankings.value = initial;
  } finally {
    loading.value = false;
  }
});

function teamName(teamId: number): string {
  for (const group of groups.value) {
    const team = group.teams.find((t) => t.id === teamId);
    if (team) return team.name_tr;
  }
  return '—';
}

const thirdCandidates = computed(() =>
  groups.value
    .map((group) => {
      const teamId = rankings.value[group.code]?.[2];
      return teamId != null ? { code: group.code, teamId, name: teamName(teamId) } : null;
    })
    .filter((c): c is { code: string; teamId: number; name: string } => c !== null),
);

const canGenerate = computed(() => selectedThirds.value.length === MAX_THIRDS);

const resolvedMatches = computed<ResolvedMatch[]>(() => {
  if (!preview.value) return [];
  return [...resolveBracket(preview.value.matches, winners.value).values()];
});

const champion = computed<BracketTeam | null>(() => {
  const finalMatch = resolvedMatches.value.find((m) => m.stage === 'final');
  if (!finalMatch?.winnerTeamId) return null;
  return finalMatch.home?.teamId === finalMatch.winnerTeamId ? finalMatch.home : finalMatch.away;
});

function move(code: string, index: number, direction: -1 | 1) {
  const current = rankings.value[code];
  if (!current) return;
  const target = index + direction;
  if (target < 0 || target >= current.length) return;
  const next = [...current];
  [next[index], next[target]] = [next[target], next[index]];
  rankings.value = { ...rankings.value, [code]: next };
  if (preview.value) stale.value = true;
}

function reorder(code: string, fromIndex: number, toIndex: number) {
  const current = rankings.value[code];
  if (!current || fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= current.length) return;
  if (toIndex < 0 || toIndex >= current.length) return;
  const next = [...current];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  rankings.value = { ...rankings.value, [code]: next };
  if (preview.value) stale.value = true;
}

function toggleThird(code: string) {
  const set = new Set(selectedThirds.value);
  if (set.has(code)) {
    set.delete(code);
  } else if (set.size < MAX_THIRDS) {
    set.add(code);
  } else {
    return;
  }
  selectedThirds.value = [...set];
  if (preview.value) stale.value = true;
}

function isThirdSelected(code: string): boolean {
  return selectedThirds.value.includes(code);
}

async function generate() {
  if (!canGenerate.value) return;
  generating.value = true;
  error.value = null;
  try {
    const { data } = await api.post<BracketPreview>('/bracket/preview', {
      groupRankings: rankings.value,
      thirdGroupCodes: selectedThirds.value,
    });
    preview.value = data;
    winners.value = {};
    stale.value = false;
  } catch (err) {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Bracket oluşturulamadı';
    error.value = message;
  } finally {
    generating.value = false;
  }
}

function pick(matchNumber: number, teamId: number) {
  if (!preview.value) return;
  const next = { ...winners.value };
  if (next[matchNumber] === teamId) {
    delete next[matchNumber];
  } else {
    next[matchNumber] = teamId;
  }
  winners.value = pruneWinners(preview.value.matches, next);
}

function resetWinners() {
  winners.value = {};
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader
      title="Bracket Tahmini"
      subtitle="Grupları sırala, en iyi 8 üçüncüyü seç, eleme ağacını kendin kur."
    />

    <!-- 1. Grup sıralamaları -->
    <section class="step">
      <h2 class="step-title"><span class="step-no">1</span> Grup sıralamaları</h2>
      <p class="step-hint">Her grupta takımları sürükleyerek ya da ok tuşlarıyla sırala. 3. sıradaki takım üçüncülük adayı olur.</p>
      <GroupRankingEditor
        :groups="groups"
        :rankings="rankings"
        :selected-thirds="selectedThirds"
        :thirds-complete="canGenerate"
        @move="move"
        @reorder="reorder"
      />
    </section>

    <!-- 2. En iyi 8 üçüncü -->
    <section class="step">
      <h2 class="step-title">
        <span class="step-no">2</span> En iyi 8 üçüncü
        <span class="third-counter" :class="{ 'is-complete': canGenerate }">
          {{ selectedThirds.length }}/{{ MAX_THIRDS }}
        </span>
      </h2>
      <p class="step-hint">Tur atlayacak 8 grup üçüncüsünü seç.</p>
      <div class="third-grid">
        <button
          v-for="candidate in thirdCandidates"
          :key="candidate.code"
          type="button"
          class="third-chip"
          :class="{ 'is-selected': isThirdSelected(candidate.code) }"
          :disabled="!isThirdSelected(candidate.code) && selectedThirds.length >= MAX_THIRDS"
          @click="toggleThird(candidate.code)"
        >
          <span class="third-group">{{ candidate.code }}</span>
          <span class="third-name">{{ candidate.name }}</span>
          <i v-if="isThirdSelected(candidate.code)" class="pi pi-check third-check" />
        </button>
      </div>
    </section>

    <!-- 3. Bracket -->
    <section class="step">
      <h2 class="step-title"><span class="step-no">3</span> Eleme ağacı</h2>
      <div class="bracket-actions">
        <Button
          :label="preview ? 'Bracket’i güncelle' : 'Bracket’i oluştur'"
          icon="pi pi-sitemap"
          :loading="generating"
          :disabled="!canGenerate"
          @click="generate"
        />
        <Button
          v-if="preview"
          label="Kazananları sıfırla"
          icon="pi pi-refresh"
          severity="secondary"
          text
          @click="resetWinners"
        />
        <span v-if="!canGenerate" class="bracket-note text-muted">
          Önce 8 grup üçüncüsü seçmelisin.
        </span>
      </div>

      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <Message v-if="preview && stale" severity="warn" :closable="false">
        Sıralama/üçüncü seçimi değişti. Güncel ağaç için “Bracket’i güncelle”ye bas.
      </Message>

      <div v-if="champion" class="champion-banner">
        <i class="pi pi-trophy" />
        <span>Tahmini şampiyon: <strong>{{ champion.name }}</strong></span>
      </div>

      <div v-if="preview" class="bracket-wrap">
        <p class="combo-note text-muted">Üçüncülük kombinasyonu no: {{ preview.combinationNo }}</p>
        <BracketTree :matches="resolvedMatches" @pick="pick" />
      </div>
      <p v-else class="text-muted empty-bracket">
        Ağaç henüz oluşturulmadı. Yukarıdaki adımları tamamlayıp “Bracket’i oluştur”a bas.
      </p>
    </section>
  </div>
</template>

<style scoped>
.step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.step-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.step-no {
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.85rem;
}

.step-hint {
  margin: -0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.third-counter {
  margin-left: auto;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.third-counter.is-complete {
  color: var(--color-primary);
}

.third-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 0.5rem;
}

.third-chip {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color 0.12s, background 0.12s;
}

.third-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.third-chip.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.third-group {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-bg-subtle);
  font-size: 0.78rem;
  font-weight: 700;
}

.third-name {
  flex: 1;
  min-width: 0;
  font-size: 0.88rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.third-check {
  color: var(--color-primary);
  font-size: 0.85rem;
}

.bracket-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.bracket-note {
  font-size: 0.82rem;
}

.champion-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.95rem;
}

.combo-note {
  margin: 0 0 0.6rem;
  font-size: 0.78rem;
}

.empty-bracket {
  font-size: 0.9rem;
}
</style>
