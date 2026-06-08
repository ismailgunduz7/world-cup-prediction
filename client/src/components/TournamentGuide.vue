<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
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
const openGroupTeamId = ref<number | null>(null);

function teamsByTier(tierId: number, groups: GuideGroup[]) {
  return groups
    .flatMap((g) => g.teams)
    .filter((t) => t.tier?.id === tierId)
    .sort((a, b) => a.name_tr.localeCompare(b.name_tr, 'tr'));
}

function teamsInGroup(groupCode: string, groups: GuideGroup[]) {
  const group = groups.find((g) => g.code === groupCode);
  return [...(group?.teams ?? [])].sort((a, b) => a.name_tr.localeCompare(b.name_tr, 'tr'));
}

function toggleGroupPopover(teamId: number) {
  openGroupTeamId.value = openGroupTeamId.value === teamId ? null : teamId;
}

function closeGroupPopover() {
  openGroupTeamId.value = null;
}

onMounted(() => {
  document.addEventListener('click', closeGroupPopover);
});

onUnmounted(() => {
  document.removeEventListener('click', closeGroupPopover);
});
</script>

<template>
  <Card class="guide-card">
    <template #content>
      <nav class="guide-tabs" role="tablist" aria-label="Turnuva rehberi sekmeleri">
        <button
          v-for="tab in guideTabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="guide-tab"
          :class="{ 'is-active': activeGuideTab === tab.key }"
          :aria-selected="activeGuideTab === tab.key"
          @click="activeGuideTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div v-show="activeGuideTab === 'tiers'" class="guide-tab-panel" role="tabpanel">
        <div class="tier-grid">
          <Card v-for="tier in tiers" :key="tier.id">
            <template #title>{{ tier.name_tr }}</template>
            <template #content>
              <ul class="team-list">
                <li v-for="team in teamsByTier(tier.id, groups)" :key="team.id">
                  <RouterLink
                    :to="{ name: 'team-matches', params: { id: team.id }, query: { from: 'home' } }"
                    class="team-link"
                  >
                    {{ team.name_tr }}
                  </RouterLink>
                  <span class="group-chip-wrap" @click.stop>
                    <button
                      type="button"
                      class="group-chip-btn"
                      :aria-expanded="openGroupTeamId === team.id"
                      :aria-label="`Grup ${team.group_code} takımlarını göster`"
                      @click="toggleGroupPopover(team.id)"
                    >
                      <Tag :value="`Grup ${team.group_code}`" severity="secondary" class="group-chip" />
                    </button>
                    <div
                      class="group-tooltip"
                      :class="{ 'is-open': openGroupTeamId === team.id }"
                      role="tooltip"
                    >
                      <p class="group-tooltip-title">Grup {{ team.group_code }}</p>
                      <ul class="group-tooltip-list">
                        <li
                          v-for="groupTeam in teamsInGroup(team.group_code, groups)"
                          :key="groupTeam.id"
                          :class="{ 'is-current': groupTeam.id === team.id }"
                        >
                          {{ groupTeam.name_tr }}
                        </li>
                      </ul>
                    </div>
                  </span>
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
                  {{ team.name_tr }}
                </RouterLink>
                <Tag :value="team.tier.name_tr" />
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

.guide-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 1rem;
}

.guide-tabs::-webkit-scrollbar {
  display: none;
}

.guide-tab {
  appearance: none;
  border: none;
  background: transparent;
  flex-shrink: 0;
  white-space: nowrap;
  padding: 0.75rem 1rem;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.guide-tab:hover {
  color: var(--color-text);
}

.guide-tab.is-active {
  color: var(--color-primary-hover);
  border-bottom-color: var(--color-primary);
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

.group-chip-wrap {
  position: relative;
  flex-shrink: 0;
}

.group-chip-btn {
  display: inline-flex;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.group-chip-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.group-chip {
  cursor: pointer;
}

.group-tooltip {
  display: none;
  position: absolute;
  right: 0;
  top: calc(100% + 0.4rem);
  z-index: 20;
  min-width: 10rem;
  max-width: 14rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  box-shadow: var(--shadow-md);
}

.group-tooltip.is-open {
  display: block;
}

@media (hover: hover) and (pointer: fine) {
  .group-chip-wrap:hover .group-tooltip {
    display: block;
  }
}

.group-tooltip-title {
  margin: 0 0 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.group-tooltip-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.group-tooltip-list li {
  padding: 0.2rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.group-tooltip-list li.is-current {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
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
