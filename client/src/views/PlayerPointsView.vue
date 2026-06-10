<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Message from 'primevue/message';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';
import { formatRuleDescription, formatSigned } from '@/utils/point-descriptions';

type PointEntry = {
  description: string;
  points: number;
  ruleCode?: string | null;
  ruleName?: string | null;
};

type FinishedMatch = {
  id: number;
  stage: string;
  status: string;
  scheduledAt: string;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: string;
  awayTeam: string;
  breakdown: PointEntry[];
  points: number;
};

type TeamSection = {
  team: {
    id: number;
    name: string;
    groupCode: string;
    totalPoints: number;
    tierName: string | null;
  };
  finishedMatches: FinishedMatch[];
  bonusEntries: PointEntry[];
};

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const loadError = ref('');
const player = ref<{ displayName: string; totalScore: number } | null>(null);
const hasSelections = ref(false);
const teams = ref<TeamSection[]>([]);
const openPanels = ref<string[]>([]);

const isRandomMode = route.query.mode === 'random';

const backRoutes: Record<string, string> = {
  leaderboard: '/puan-durumu',
  'random-leaderboard': '/rastgele/puan-durumu',
};

const stageLabels: Record<string, string> = {
  group: 'Grup',
  round_of_32: 'Son 32',
  round_of_16: 'Son 16',
  quarter_final: 'Çeyrek Final',
  semi_final: 'Yarı Final',
  third_place: '3.lük',
  final: 'Final',
};

onMounted(async () => {
  try {
    const { data } = await api.get(`/players/${route.params.id}/points`, {
      params: isRandomMode ? { mode: 'random' } : {},
    });
    player.value = data.player;
    hasSelections.value = data.hasSelections;
    teams.value = data.teams;
  } catch (err: unknown) {
    loadError.value =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Puan detayları yüklenemedi';
  } finally {
    loading.value = false;
  }
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function matchLabel(match: FinishedMatch) {
  const home = match.homeTeam;
  const away = match.awayTeam;
  if (match.homeScore !== null) {
    return `${home} ${match.homeScore}-${match.awayScore} ${away}`;
  }
  return `${home} vs ${away}`;
}

function panelKey(teamId: number, matchId: number) {
  return `${teamId}-${matchId}`;
}

function pointsSeverity(points: number): 'success' | 'danger' {
  return points < 0 ? 'danger' : 'success';
}

function goBack() {
  const from = route.query.from;
  if (typeof from === 'string' && backRoutes[from]) {
    router.push(backRoutes[from]);
    return;
  }
  router.back();
}

function goToTeam(teamId: number) {
  router.push({
    name: 'team-matches',
    params: { id: teamId },
    query: { from: isRandomMode ? 'random-leaderboard' : 'leaderboard' },
  });
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else-if="loadError" class="page-stack">
    <div class="page-top">
      <Button icon="pi pi-arrow-left" label="Geri" severity="secondary" text @click="goBack" />
    </div>
    <Message severity="error" :closable="false">{{ loadError }}</Message>
  </div>
  <div v-else-if="player" class="page-stack">
    <div class="page-top">
      <Button icon="pi pi-arrow-left" label="Geri" severity="secondary" text @click="goBack" />
    </div>

    <PageHeader
      :title="player.displayName"
      :subtitle="isRandomMode ? 'Rastgele atanan takımların puan detayları' : 'Seçilen takımların puan detayları'"
    />

    <Card>
      <template #content>
        <div class="tag-row">
          <Tag :value="`${player.totalScore} toplam puan`" :severity="pointsSeverity(player.totalScore)" />
        </div>
      </template>
    </Card>

    <Message v-if="!hasSelections" severity="info" :closable="false">
      {{ isRandomMode ? 'Bu oyuncu henüz rastgele atama yapmamış.' : 'Bu oyuncu henüz takım seçimi yapmamış.' }}
    </Message>

    <section v-for="section in teams" :key="section.team.id" class="team-section">
      <Card>
        <template #title>
          <button type="button" class="team-link" @click="goToTeam(section.team.id)">
            {{ section.team.name }}
          </button>
        </template>
        <template #content>
          <div class="tag-row">
            <Tag v-if="section.team.tierName" :value="section.team.tierName" />
            <Tag :value="`Grup ${section.team.groupCode}`" severity="secondary" />
            <Tag
              :value="`${section.team.totalPoints} puan`"
              :severity="pointsSeverity(section.team.totalPoints)"
            />
          </div>
        </template>
      </Card>

      <div
        v-if="section.finishedMatches.length || section.bonusEntries.length"
        class="team-matches-block"
      >
        <Accordion v-if="section.finishedMatches.length" v-model:value="openPanels" multiple>
          <AccordionPanel
            v-for="match in section.finishedMatches"
            :key="panelKey(section.team.id, match.id)"
            :value="panelKey(section.team.id, match.id)"
          >
            <AccordionHeader>
              <div class="match-header">
                <span class="match-title">{{ matchLabel(match) }}</span>
                <div class="tag-row">
                  <Tag :value="stageLabels[match.stage] ?? match.stage" />
                  <Tag
                    :value="`${match.points} puan`"
                    :severity="pointsSeverity(match.points)"
                  />
                  <span class="text-muted match-date">{{ formatDate(match.scheduledAt) }}</span>
                </div>
              </div>
            </AccordionHeader>
            <AccordionContent>
              <div v-if="match.breakdown.length">
                <DataTable :value="match.breakdown" size="small" responsive-layout="scroll">
                  <Column header="Kural">
                    <template #body="{ data }">
                      {{ formatRuleDescription(data) }}
                    </template>
                  </Column>
                  <Column header="Puan" style="width: 5rem">
                    <template #body="{ data }">
                      <span :class="Number(data.points) >= 0 ? 'text-positive' : 'text-negative'">
                        {{ formatSigned(Number(data.points)) }}
                      </span>
                    </template>
                  </Column>
                </DataTable>
              </div>
              <p v-else class="match-panel-empty text-muted">Bu maç için puan kaydı yok.</p>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>

        <Card v-if="section.bonusEntries.length" class="bonus-card">
          <template #title>Maç dışı puanlar</template>
          <template #content>
            <p class="bonus-hint text-muted">
              Grup sıralaması ve eleme turu puanları maç sonuçlarından ayrı hesaplanır.
            </p>
            <DataTable :value="section.bonusEntries" size="small" responsive-layout="scroll">
              <Column header="Kural">
                <template #body="{ data }">
                  {{ formatRuleDescription(data) }}
                </template>
              </Column>
              <Column header="Puan" style="width: 5rem">
                <template #body="{ data }">
                  <span :class="Number(data.points) >= 0 ? 'text-positive' : 'text-negative'">
                    {{ formatSigned(Number(data.points)) }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>

      <div v-else class="empty-state surface-card">
        Bu takım için henüz bitmiş maç yok.
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-top {
  margin-bottom: -0.5rem;
}

.team-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.team-matches-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.team-link {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-primary-hover);
  cursor: pointer;
  text-align: left;
}

.team-link:hover {
  text-decoration: underline;
}

.match-header {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding-right: 1.75rem;
}

.match-title {
  font-weight: 600;
  font-size: clamp(0.92rem, 3.5vw, 1.05rem);
  line-height: 1.35;
  word-break: break-word;
}

.match-date {
  font-size: 0.85rem;
  flex-basis: 100%;
}

.bonus-card :deep(.p-card-title) {
  font-size: 1rem;
}

.bonus-card :deep(.p-card-body) {
  padding-top: 0.75rem;
}

.bonus-hint {
  margin: 0 0 0.75rem;
  font-size: 0.88rem;
}
</style>
