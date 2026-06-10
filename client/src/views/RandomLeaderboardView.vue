<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';

type PlayerEntry = {
  rank: number;
  username: string;
  displayName: string;
  totalScore: number;
  isCurrentUser: boolean;
  hasSelections: boolean;
  selections: Array<{ name: string; points: number }>;
};

const router = useRouter();
const toast = useToast();
const loading = ref(true);
const enabled = ref(true);
const entries = ref<PlayerEntry[]>([]);

onMounted(async () => {
  const [{ data: statusData }, { data: lbData }] = await Promise.all([
    api.get('/tournament/status'),
    api.get('/random-mode/leaderboard'),
  ]);
  enabled.value = statusData.randomModeEnabled !== false;
  entries.value = lbData.entries;
  loading.value = false;
});

function formatSelections(entry: PlayerEntry) {
  if (!entry.hasSelections) return 'Atama yapılmadı';
  return entry.selections.map((s) => `${s.name} (${s.points}p)`).join(', ');
}

function playerRowClass(data: PlayerEntry) {
  return data.isCurrentUser ? 'row-highlight' : '';
}

function rankLabel(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function onPlayerRowClick(event: { data: PlayerEntry }) {
  const entry = event.data;
  if (!entry.hasSelections) {
    toast.add({
      severity: 'info',
      summary: 'Atama yapılmadı',
      detail: `${entry.displayName} henüz rastgele atama yapmadı`,
      life: 3500,
    });
    return;
  }

  router.push({
    name: 'player-points',
    params: { id: entry.username },
    query: { from: 'random-leaderboard', mode: 'random' },
  });
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader title="Rastgele Puan Durumu" subtitle="Rastgele modda atanan takımlara göre sıralama" />

    <div>
      <Button
        label="Rastgele Mod"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        size="small"
        @click="router.push({ name: 'random-mode' })"
      />
    </div>

    <Message v-if="!enabled" severity="warn" :closable="false">
      Rastgele mod şu anda kapalı.
    </Message>

    <Card v-else>
      <template #content>
        <DataTable
          :value="entries"
          striped-rows
          :row-class="playerRowClass"
          responsive-layout="scroll"
          class="players-table"
          @row-click="onPlayerRowClick"
        >
          <Column header="#" style="width: 4rem">
            <template #body="{ data }">
              <span class="rank-cell">{{ rankLabel(data.rank) }}</span>
            </template>
          </Column>
          <Column header="Oyuncu">
            <template #body="{ data }">
              <span class="name-cell">{{ data.displayName }}</span>
            </template>
          </Column>
          <Column field="totalScore" header="Toplam Puan" style="width: 8rem">
            <template #body="{ data }">
              <strong>{{ data.totalScore }}</strong>
            </template>
          </Column>
          <Column header="Atanan Takımlar">
            <template #body="{ data }">
              <span :class="{ 'text-muted': !data.hasSelections }">
                {{ formatSelections(data) }}
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
