<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import PlayerLeaderboardTable from '@/components/PlayerLeaderboardTable.vue';
import type { PlayerLeaderboardEntry } from '@/utils/leaderboard';
import api from '@/api/client';

const router = useRouter();
const toast = useToast();
const loading = ref(true);
const enabled = ref(true);
const entries = ref<PlayerLeaderboardEntry[]>([]);

onMounted(async () => {
  const [{ data: statusData }, { data: lbData }] = await Promise.all([
    api.get('/tournament/status'),
    api.get('/random-mode/leaderboard'),
  ]);
  enabled.value = statusData.randomModeEnabled !== false;
  entries.value = lbData.entries;
  loading.value = false;
});

function onSelect(entry: PlayerLeaderboardEntry) {
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

    <Card v-else class="leaderboard-card">
      <template #content>
        <PlayerLeaderboardTable
          :entries="entries"
          selections-header="Atanan Takımlar"
          empty-selections-label="Atama yapılmadı"
          @select="onSelect"
        />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.leaderboard-card :deep(.p-card-body) {
  padding-top: 0.85rem;
}
</style>
