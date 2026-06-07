<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Card from 'primevue/card';
import Message from 'primevue/message';
import Accordion from 'primevue/accordion';
import AccordionPanel from 'primevue/accordionpanel';
import AccordionHeader from 'primevue/accordionheader';
import AccordionContent from 'primevue/accordioncontent';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import TournamentGuide from '@/components/TournamentGuide.vue';
import CountdownBanner from '@/components/dashboard/CountdownBanner.vue';
import RankCard from '@/components/dashboard/RankCard.vue';
import MyTeamCard from '@/components/dashboard/MyTeamCard.vue';
import UpcomingStrip from '@/components/dashboard/UpcomingStrip.vue';
import MiniLeaderboard from '@/components/dashboard/MiniLeaderboard.vue';
import RecentActivity from '@/components/dashboard/RecentActivity.vue';
import GroupProgress from '@/components/dashboard/GroupProgress.vue';
import api from '@/api/client';
import type { DashboardData, GuideGroup, GuideTier } from '@/types/dashboard';

const loading = ref(true);
const dashboard = ref<DashboardData | null>(null);
const tiers = ref<GuideTier[]>([]);
const groups = ref<GuideGroup[]>([]);

const phase = computed(() => {
  if (!dashboard.value) return null;
  if (!dashboard.value.status.selectionsLocked) return 1;
  if (!dashboard.value.status.tournamentStarted) return 2;
  return 3;
});

const showGuide = computed(() => phase.value === 1 || phase.value === 2);

onMounted(async () => {
  const dashboardRes = await api.get('/me/dashboard');
  dashboard.value = dashboardRes.data;

  if (!dashboardRes.data.status.tournamentStarted) {
    const teamsRes = await api.get('/teams');
    tiers.value = teamsRes.data.tiers;
    groups.value = teamsRes.data.groups;
  }

  loading.value = false;
});
</script>

<template>
  <LoadingState v-if="loading" />

  <div v-else-if="dashboard" class="page-stack">
    <!-- Faz 1: Seçim açık -->
    <template v-if="phase === 1">
      <PageHeader
        title="Turnuva Rehberi"
      />

      <CountdownBanner
        :target-at="dashboard.status.selectionLockAt"
        label="Seçim kilidine kalan süre"
      />

      <Message severity="info" :closable="false">
        3 takımınızı seçmek için
        <RouterLink to="/secimlerim">Seçimlerim</RouterLink>
        sayfasına gidin.
      </Message>

      <TournamentGuide :tiers="tiers" :groups="groups" />
    </template>

    <!-- Faz 2: Kilitli, başlamadı -->
    <template v-else-if="phase === 2">
      <PageHeader title="Kadron hazır" />

      <CountdownBanner
        :target-at="dashboard.status.tournamentStartAt"
        label="İlk maça kalan süre"
      />

      <Message severity="warn" :closable="false">
        Seçimler kilitlendi. Artık değişiklik yapılamaz.
      </Message>

      <div v-if="dashboard.me.hasSelections" class="squad-grid">
        <Card v-for="team in dashboard.teams" :key="team.teamId" class="squad-card">
          <template #title>
            <RouterLink
              :to="{ name: 'team-matches', params: { id: team.teamId }, query: { from: 'home' } }"
              class="team-title-link"
            >
              {{ team.name }}
            </RouterLink>
          </template>
          <template #subtitle>
            <span class="team-meta">{{ team.tierName }} · Grup {{ team.groupCode }}</span>
          </template>
        </Card>
      </div>
      <Message v-else severity="warn" :closable="false">
        Henüz 3 takım seçmediniz. Turnuva başladığında kişisel paneliniz sınırlı olacak.
      </Message>

      <Accordion v-if="showGuide && tiers.length" class="guide-accordion">
        <AccordionPanel value="guide">
          <AccordionHeader>Turnuva rehberi</AccordionHeader>
          <AccordionContent>
            <TournamentGuide :tiers="tiers" :groups="groups" />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>

    <!-- Faz 3: Turnuva başladı -->
    <template v-else>
      <PageHeader title="Panelim" subtitle="Canlı sıralama, takımların ve maçların özeti" />

      <Message v-if="!dashboard.me.hasSelections" severity="warn" :closable="false">
        Henüz 3 takım seçmediniz. Sıralamaya dahil olmak ve puan kazanmak için kadro seçmeniz gerekir.
      </Message>

      <template v-else>
        <RankCard :me="dashboard.me" />

        <section class="dashboard-section">
          <h2 class="section-title">Takımlarım</h2>
          <div class="teams-grid">
            <MyTeamCard v-for="team in dashboard.teams" :key="team.teamId" :team="team" />
          </div>
        </section>

        <div class="dashboard-grid">
          <UpcomingStrip :matches="dashboard.upcoming" />
          <MiniLeaderboard :entries="dashboard.miniLeaderboard" />
        </div>

        <RecentActivity :activities="dashboard.recentActivity" />

        <section v-if="dashboard.groupProgress.length" class="dashboard-section">
          <h2 class="section-title">Grup ilerlemesi</h2>
          <GroupProgress :groups="dashboard.groupProgress" />
        </section>
      </template>
    </template>
  </div>
</template>

<style scoped>
.squad-grid,
.teams-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.dashboard-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.team-title-link {
  color: inherit;
  text-decoration: none;
  font-weight: 700;
}

.team-title-link:hover {
  color: var(--color-primary-hover);
}

.team-meta {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.guide-accordion {
  margin-top: 0.5rem;
}

@media (max-width: 900px) {
  .squad-grid,
  .teams-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
