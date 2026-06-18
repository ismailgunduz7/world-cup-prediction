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
import MiniLeaderboard from '@/components/dashboard/MiniLeaderboard.vue';
import RecentActivity from '@/components/dashboard/RecentActivity.vue';
import GroupProgress from '@/components/dashboard/GroupProgress.vue';
import LiveSpotlight from '@/components/LiveSpotlight.vue';
import { useAuthStore } from '@/stores/auth';
import { useReferenceStore } from '@/stores/reference';
import api from '@/api/client';
import { loadSelectionDraft } from '@/utils/selection-draft';
import { buildLiveSpotlightGroups } from '@/utils/live-spotlight';
import type { DashboardData, GuideGroup, GuideTier } from '@/types/dashboard';

const auth = useAuthStore();
const reference = useReferenceStore();

const loading = ref(true);
const dashboard = ref<DashboardData | null>(null);
const tiers = ref<GuideTier[]>([]);
const groups = ref<GuideGroup[]>([]);

const phase = computed(() => {
  if (!dashboard.value) return null;
  const { selectionsLocked, tournamentStarted } = dashboard.value.status;
  const selectionsComplete = dashboard.value.teams.length === 3;

  if (!selectionsLocked) {
    return selectionsComplete ? 2 : 1;
  }
  if (!tournamentStarted) return 3;
  return 4;
});

const showGuideAccordion = computed(() => phase.value === 2 || phase.value === 3);

const savedSelectionCount = computed(() => dashboard.value?.teams.length ?? 0);

const draftSelectionCount = computed(() => {
  if (!dashboard.value?.status.selectionsLocked && auth.user?.id) {
    return loadSelectionDraft(auth.user.id)?.length ?? 0;
  }
  return 0;
});

/** Kayıtlı + henüz kaydedilmemiş taslak seçimler (Faz 1 mesajı için). */
const effectiveSelectionCount = computed(() =>
  Math.max(savedSelectionCount.value, draftSelectionCount.value),
);

const liveSpotlightGroups = computed(() =>
  dashboard.value ? buildLiveSpotlightGroups(dashboard.value.liveMatches) : [],
);

const userTeamIds = computed(() => dashboard.value?.teams.map((t) => t.teamId) ?? []);

const panelSubtitle = computed(() => {
  if (liveSpotlightGroups.value.length > 0) {
    const count = dashboard.value?.liveMatches.length ?? 0;
    return count === 1 ? '1 canlı maç devam ediyor' : `${count} canlı maç devam ediyor`;
  }
  return 'Canlı sıralama, takımların ve maçların özeti';
});

async function loadHome() {
  loading.value = true;
  const dashboardRes = await api.get('/me/dashboard');
  dashboard.value = dashboardRes.data;

  if (!dashboardRes.data.status.tournamentStarted) {
    const teamsData = await reference.ensureTeams();
    tiers.value = teamsData.tiers;
    groups.value = teamsData.groups;
  }

  loading.value = false;
}

onMounted(loadHome);

function formatLockDate(iso: string | null) {
  if (!iso) return 'Kilit tarihi';
  return new Date(iso).toLocaleString('tr-TR');
}
</script>

<template>
  <LoadingState v-if="loading" />

  <div v-else-if="dashboard" class="page-stack">
    <!-- Faz 1: Seçim açık, henüz tamamlanmadı -->
    <template v-if="phase === 1">
      <PageHeader title="Turnuva Rehberi" />

      <CountdownBanner
        :target-at="dashboard.status.selectionLockAt"
        label="Seçim kilidine kalan süre"
      />

      <Message severity="info" :closable="false">
        <template v-if="effectiveSelectionCount === 0">
          3 takımınızı seçmek için
          <RouterLink to="/secimlerim">Seçimlerim</RouterLink>
          sayfasına gidin.
        </template>
        <template v-else-if="effectiveSelectionCount >= 3 && savedSelectionCount < 3">
          3 takımı seçtiniz —
          <RouterLink to="/secimlerim">Seçimlerim</RouterLink>
          sayfasında Kaydet’e basarak kadronuzu onaylayın.
        </template>
        <template v-else>
          {{ 3 - effectiveSelectionCount }} takım daha seçmelisiniz —
          <RouterLink to="/secimlerim">Seçimlerim</RouterLink>
          sayfasından kadronuzu tamamlayın.
        </template>
      </Message>

      <TournamentGuide :tiers="tiers" :groups="groups" />
    </template>

    <!-- Faz 2: Seçim tamam, kilit öncesi -->
    <template v-else-if="phase === 2">
      <PageHeader
        title="Kadron hazır"
        subtitle="Seçimler kilitlenene kadar seçtiğiniz takımları değiştirebilirsiniz"
      />

      <CountdownBanner
        :target-at="dashboard.status.selectionLockAt"
        label="Seçim kilidine kalan süre"
      />

      <Message severity="info" :closable="false">
        <strong>{{ formatLockDate(dashboard.status.selectionLockAt) }}</strong>
        tarihine kadar
        <RouterLink to="/secimlerim">Seçimlerim</RouterLink>
        sayfasından kadronuzu güncelleyebilirsiniz.
      </Message>

      <div class="squad-grid">
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

      <Accordion v-if="showGuideAccordion && tiers.length" class="guide-accordion">
        <AccordionPanel value="guide">
          <AccordionHeader>Turnuva rehberi</AccordionHeader>
          <AccordionContent>
            <TournamentGuide :tiers="tiers" :groups="groups" />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>

    <!-- Faz 3: Kilitli, turnuva başlamadı -->
    <template v-else-if="phase === 3">
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

      <Accordion v-if="showGuideAccordion && tiers.length" class="guide-accordion">
        <AccordionPanel value="guide">
          <AccordionHeader>Turnuva rehberi</AccordionHeader>
          <AccordionContent>
            <TournamentGuide :tiers="tiers" :groups="groups" />
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </template>

    <!-- Faz 4: Turnuva başladı -->
    <template v-else>
      <PageHeader title="Panelim" :subtitle="panelSubtitle" />

      <Message v-if="!dashboard.me.hasSelections" severity="warn" :closable="false">
        Henüz 3 takım seçmediniz. Sıralamaya dahil olmak ve puan kazanmak için kadro seçmeniz gerekir.
      </Message>

      <template v-else>
        <LiveSpotlight
          :groups="liveSpotlightGroups"
          link-from="home"
          :highlight-team-ids="userTeamIds"
        />

        <RankCard :me="dashboard.me" :leader-summary="dashboard.leaderSummary" />

        <RankCard
          v-if="dashboard.randomRank"
          :me="dashboard.randomRank.me"
          :leader-summary="dashboard.randomRank.leaderSummary"
          rank-label="Rastgele mod"
        />

        <section class="dashboard-section">
          <h2 class="section-title">Takımlarım</h2>
          <div class="teams-grid">
            <MyTeamCard v-for="team in dashboard.teams" :key="team.teamId" :team="team" />
          </div>
        </section>

        <div class="dashboard-grid">
          <MiniLeaderboard
            :entries="dashboard.miniLeaderboard"
            :player-count="dashboard.me.playerCount"
          />
          <RecentActivity :activities="dashboard.recentActivity" />
        </div>

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

.phase-actions {
  display: flex;
  justify-content: flex-end;
}

.edit-selections-link {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary-hover);
  text-decoration: none;
}

.edit-selections-link:hover {
  text-decoration: underline;
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
