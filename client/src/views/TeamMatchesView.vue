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
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import Message from 'primevue/message';
import api from '@/api/client';
import { formatRuleDescription, formatSigned } from '@/utils/point-descriptions';
import { formatMatchScore, type MatchScoreFields } from '@/utils/match-score';

type PointEntry = {
  description: string;
  points: number;
  ruleCode?: string | null;
  ruleName?: string | null;
};

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const loadError = ref('');
const team = ref<{ name: string; tierName: string | null; groupCode: string } | null>(null);
const matches = ref<Array<Record<string, unknown>>>([]);
const bonusEntries = ref<PointEntry[]>([]);
const totalPoints = ref(0);
const openMatch = ref<string[]>([]);

const backRoutes: Record<string, string> = {
  leaderboard: '/puan-durumu',
  'random-leaderboard': '/puan-durumu?tab=random',
  'random-mode': '/rastgele',
  fixtures: '/fikstur',
  selections: '/secimlerim',
  home: '/',
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

const statusLabels: Record<string, string> = {
  scheduled: 'Planlandı',
  live: 'Canlı',
  finished: 'Bitti',
  postponed: 'Ertelendi',
  cancelled: 'İptal',
};

const statusSeverity: Record<string, 'secondary' | 'success' | 'warn' | 'info' | 'danger'> = {
  scheduled: 'secondary',
  live: 'warn',
  finished: 'success',
  postponed: 'info',
  cancelled: 'danger',
};

onMounted(async () => {
  try {
    const { data } = await api.get(`/teams/${route.params.id}/matches`);
    team.value = data.team;
    matches.value = data.matches;
    bonusEntries.value = data.bonusEntries ?? [];
    totalPoints.value = data.totalPoints;
  } catch (err: unknown) {
    loadError.value =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Maçlar yüklenemedi';
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

function matchLabel(match: Record<string, unknown>) {
  const home = match.homeTeam as string;
  const away = match.awayTeam as string;

  if (match.status === 'finished' && match.homeScore !== null) {
    return `${home} ${formatMatchScore(match as unknown as MatchScoreFields, { separator: '-' })} ${away}`;
  }

  return `${home} vs ${away}`;
}

function matchTotal(match: Record<string, unknown>) {
  return Number(match.points ?? 0);
}

function pointsSeverity(points: number): 'success' | 'danger' {
  return points < 0 ? 'danger' : 'success';
}

function isFinished(match: Record<string, unknown>) {
  return match.status === 'finished';
}

function goBack() {
  const from = route.query.from;
  if (typeof from === 'string' && backRoutes[from]) {
    router.push(backRoutes[from]);
    return;
  }
  router.back();
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
  <div v-else-if="team" class="page-stack">
    <div class="page-top">
      <Button icon="pi pi-arrow-left" label="Geri" severity="secondary" text @click="goBack" />
    </div>

    <PageHeader :title="team.name" subtitle="Maçlar ve puan detayları" />

    <Card>
      <template #content>
        <div class="tag-row">
          <Tag v-if="team.tierName" :value="team.tierName" />
          <Tag :value="`Grup ${team.groupCode}`" severity="secondary" />
          <Tag :value="`${totalPoints} puan`" :severity="pointsSeverity(totalPoints)" />
        </div>
      </template>
    </Card>

    <div v-if="matches.length === 0 && bonusEntries.length === 0" class="empty-state surface-card">
      Henüz bu takım için maç kaydı yok.
    </div>

    <div v-else class="team-matches-block">
      <Accordion v-if="matches.length" v-model:value="openMatch" multiple>
        <AccordionPanel v-for="match in matches" :key="String(match.id)" :value="String(match.id)">
          <AccordionHeader>
            <div class="match-header">
              <span class="match-title">{{ matchLabel(match) }}</span>
              <div class="tag-row">
                <Tag :value="stageLabels[String(match.stage)] ?? String(match.stage)" />
                <Tag
                  :value="statusLabels[String(match.status)] ?? String(match.status)"
                  :severity="statusSeverity[String(match.status)] ?? 'secondary'"
                />
                <Tag
                  v-if="isFinished(match)"
                  :value="`${matchTotal(match)} puan`"
                  :severity="pointsSeverity(matchTotal(match))"
                />
                <span class="text-muted match-date">{{ formatDate(String(match.scheduledAt)) }}</span>
              </div>
            </div>
          </AccordionHeader>
          <AccordionContent>
            <div v-if="match.status === 'finished' && (match.breakdown as PointEntry[])?.length">
              <DataTable :value="match.breakdown as PointEntry[]" size="small" responsive-layout="scroll">
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
            <p v-else-if="match.status === 'scheduled'" class="match-panel-empty text-muted">Maç henüz oynanmadı.</p>
            <p v-else class="match-panel-empty text-muted">Bu maç için puan kaydı yok.</p>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>

      <Card v-if="bonusEntries.length" class="bonus-card">
        <template #title>Maç dışı puanlar</template>
        <template #content>
          <p class="bonus-hint text-muted">
            Grup sıralaması ve eleme turu puanları maç sonuçlarından ayrı hesaplanır.
          </p>
          <DataTable :value="bonusEntries" size="small" responsive-layout="scroll">
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
  </div>
</template>

<style scoped>
.page-top {
  margin-bottom: -0.5rem;
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

.team-matches-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
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
