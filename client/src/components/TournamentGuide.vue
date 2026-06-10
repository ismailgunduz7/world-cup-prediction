<script setup lang="ts">
import { ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import GroupChip from '@/components/GroupChip.vue';
import TabBar from '@/components/TabBar.vue';
import type { GuideGroup, GuideTier } from '@/types/dashboard';

defineProps<{
  tiers: GuideTier[];
  groups: GuideGroup[];
}>();

type GuideTab = 'tiers' | 'groups';

const guideTabs: { key: GuideTab; label: string }[] = [
  { key: 'tiers', label: 'Tierlar' },
  { key: 'groups', label: 'Gruplar' },
];

const activeGuideTab = ref<GuideTab>('tiers');

function teamsByTier(tierId: number, groups: GuideGroup[]) {
  return groups
    .flatMap((g) => g.teams)
    .filter((t) => t.tier?.id === tierId)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function teamsInGroup(groupCode: string, groups: GuideGroup[]) {
  const group = groups.find((g) => g.code === groupCode);
  return group?.teams ?? [];
}
</script>

<template>
  <Card class="guide-card">
    <template #content>
      <TabBar v-model="activeGuideTab" :tabs="guideTabs" aria-label="Turnuva rehberi sekmeleri" />

      <div v-show="activeGuideTab === 'tiers'" class="guide-tab-panel" role="tabpanel">
        <div class="tier-grid">
          <Card v-for="tier in tiers" :key="tier.id">
            <template #title>{{ tier.name }}</template>
            <template #content>
              <ul class="team-list">
                <li v-for="team in teamsByTier(tier.id, groups)" :key="team.id">
                  <RouterLink
                    :to="{ name: 'team-matches', params: { id: team.id }, query: { from: 'home' } }"
                    class="team-link"
                  >
                    {{ team.name }}
                  </RouterLink>
                  <GroupChip
                    :group-code="team.groupCode"
                    :teams="teamsInGroup(team.groupCode, groups)"
                    :current-team-id="team.id"
                    align="end"
                  />
                </li>
              </ul>
            </template>
          </Card>
        </div>
      </div>

      <div v-show="activeGuideTab === 'groups'" class="guide-tab-panel" role="tabpanel">
        <div class="groups-grid">
          <div v-for="group in groups" :key="group.code" class="group-card">
            <h3 class="group-card-title">Grup {{ group.code }}</h3>
            <ul class="team-list group-card-body">
              <li v-for="team in group.teams" :key="team.id">
                <RouterLink
                  :to="{ name: 'team-matches', params: { id: team.id }, query: { from: 'home' } }"
                  class="team-link"
                >
                  {{ team.name }}
                </RouterLink>
                <Tag v-if="team.tier" :value="team.tier.name" />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<style scoped>
.guide-card :deep(.p-card-body) {
  padding-top: 0.85rem;
}

.guide-tab-panel {
  padding-top: 0.25rem;
}

.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

@media (max-width: 900px) {
  .tier-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .tier-grid {
    grid-template-columns: 1fr;
  }
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

.group-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  overflow: hidden;
}

.group-card-title {
  margin: 0;
  padding: 0.65rem 0.9rem;
  background: var(--color-bg-subtle);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-border);
}

.group-card-body {
  padding: 0.65rem 0.9rem 0.85rem;
}

.team-link {
  color: inherit;
  text-decoration: none;
  font-weight: 500;
}

@media (max-width: 900px) {
  .groups-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .groups-grid {
    grid-template-columns: 1fr;
  }
}
</style>
