<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import RadioButton from 'primevue/radiobutton';
import Checkbox from 'primevue/checkbox';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import api from '@/api/client';

type Tier = { id: number; name_tr: string };
type Team = {
  id: number;
  name_tr: string;
  group_code: string;
  tier: { name_tr: string };
  total_points?: number;
};
type SlotTeam = { slot: number; team: Team | null };
type GroupTeam = { id: number; name_tr: string };
type Group = { code: string; teams: GroupTeam[] };
type RandomCondition = 'fully_random' | 'exclude_own' | 'never_picked';

const CONDITIONS: Array<{ value: RandomCondition; label: string; description: string }> = [
  {
    value: 'fully_random',
    label: 'Tamamen Rastgele',
    description: 'Turnuvadaki 48 ülkenin tamamı denk gelebilir.',
  },
  {
    value: 'exclude_own',
    label: 'Kendi Seçtiklerim Dışında',
    description: 'Gerçek modda seçtiğin 3 takım hariç 45 ülke arasından.',
  },
  {
    value: 'never_picked',
    label: 'Hiç Seçilmemişlerden',
    description: 'Hiçbir oyuncunun gerçek modda seçmediği takımlar arasından.',
  },
];

const toast = useToast();
const router = useRouter();

const loading = ref(true);
const enabled = ref(true);
const selectionsLocked = ref(false);
const isTriggered = ref(false);
const rerollUsed = ref(false);

const tiers = ref<Tier[]>([]);
const groups = ref<Group[]>([]);
const allTeamNames = ref<string[]>([]);
const openGroupSlot = ref<number | null>(null);

const condition = ref<RandomCondition>('fully_random');
const allowedTiers = ref<number[]>([1, 2, 3, 4, 5]);
const noSameGroup = ref(false);

const slots = ref<SlotTeam[]>([]);
// What each slot currently shows: a settled team name or a spinning placeholder.
const display = ref<Record<number, string>>({});
const spinningSlots = ref<Set<number>>(new Set());

const triggering = ref(false);
const rerollingSlot = ref<number | null>(null);

const canTrigger = computed(
  () => enabled.value && !selectionsLocked.value && !isTriggered.value && allowedTiers.value.length > 0,
);
const configLocked = computed(() => isTriggered.value);
const busy = computed(() => triggering.value || rerollingSlot.value !== null);

onMounted(async () => {
  const [mineRes, teamsRes] = await Promise.all([
    api.get('/random-mode/mine'),
    api.get('/teams'),
  ]);

  const mine = mineRes.data;
  enabled.value = mine.enabled;
  selectionsLocked.value = mine.selectionsLocked;
  isTriggered.value = mine.isTriggered;
  rerollUsed.value = mine.rerollUsed;
  if (mine.condition) condition.value = mine.condition;
  if (Array.isArray(mine.allowedTiers)) allowedTiers.value = mine.allowedTiers;
  noSameGroup.value = mine.noSameGroup === true;
  slots.value = mine.teams ?? [];
  for (const s of slots.value) {
    if (s.team) display.value[s.slot] = s.team.name_tr;
  }

  tiers.value = teamsRes.data.tiers ?? [];
  groups.value = teamsRes.data.groups ?? [];
  allTeamNames.value = (teamsRes.data.teams ?? []).map((t: Team) => t.name_tr);

  loading.value = false;
  document.addEventListener('click', closeGroupPopover);
});

onUnmounted(() => {
  document.removeEventListener('click', closeGroupPopover);
});

function teamsInGroup(groupCode: string) {
  const group = groups.value.find((g) => g.code === groupCode);
  return [...(group?.teams ?? [])].sort((a, b) => a.name_tr.localeCompare(b.name_tr, 'tr'));
}

function toggleGroupPopover(slot: number) {
  openGroupSlot.value = openGroupSlot.value === slot ? null : slot;
}

function closeGroupPopover() {
  openGroupSlot.value = null;
}

function toggleTier(id: number) {
  if (configLocked.value) return;
  const idx = allowedTiers.value.indexOf(id);
  if (idx >= 0) allowedTiers.value.splice(idx, 1);
  else allowedTiers.value.push(id);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Slot-machine reveal: cycle random names for `duration` ms then settle. */
async function spinSlot(slot: number, finalName: string, duration = 1100) {
  spinningSlots.value = new Set([...spinningSlots.value, slot]);
  const pool = allTeamNames.value.length ? allTeamNames.value : [finalName];
  const start = Date.now();
  while (Date.now() - start < duration) {
    display.value[slot] = pool[Math.floor(Math.random() * pool.length)];
    await sleep(70);
  }
  display.value[slot] = finalName;
  const next = new Set(spinningSlots.value);
  next.delete(slot);
  spinningSlots.value = next;
}

async function revealSequentially(reveal: SlotTeam[]) {
  for (const s of reveal.sort((a, b) => a.slot - b.slot)) {
    if (s.team) await spinSlot(s.slot, s.team.name_tr);
  }
}

async function trigger() {
  if (!canTrigger.value || busy.value) return;
  triggering.value = true;
  try {
    const { data } = await api.post('/random-mode/trigger', {
      condition: condition.value,
      allowedTiers: allowedTiers.value,
      noSameGroup: noSameGroup.value,
    });
    isTriggered.value = true;
    rerollUsed.value = data.rerollUsed;
    if (typeof data.noSameGroup === 'boolean') noSameGroup.value = data.noSameGroup;
    slots.value = data.teams;
    await revealSequentially(data.teams);
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Rastgele seçim başarısız';
    toast.add({ severity: 'error', summary: 'Hata', detail: message, life: 4000 });
  } finally {
    triggering.value = false;
  }
}

async function reroll(slot: number) {
  if (rerollUsed.value || busy.value || selectionsLocked.value) return;
  rerollingSlot.value = slot;
  try {
    const { data } = await api.post('/random-mode/reroll', { slot });
    rerollUsed.value = data.rerollUsed;
    slots.value = data.teams;
    const updated = (data.teams as SlotTeam[]).find((s) => s.slot === slot);
    if (updated?.team) await spinSlot(slot, updated.team.name_tr);
  } catch (err: unknown) {
    const message =
      (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
      'Yeniden atma başarısız';
    toast.add({ severity: 'error', summary: 'Hata', detail: message, life: 4000 });
  } finally {
    rerollingSlot.value = null;
  }
}

const conditionLabel = computed(
  () => CONDITIONS.find((c) => c.value === condition.value)?.label ?? '',
);

function teamForSlot(slot: number): Team | null {
  return slots.value.find((s) => s.slot === slot)?.team ?? null;
}

const slotNumbers = [1, 2, 3];
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader
      title="Rastgele Mod"
      subtitle="Koşul ve tier filtresi belirle, sana rastgele 3 takım atansın"
    />

    <Message v-if="!enabled" severity="warn" :closable="false">
      Rastgele mod şu anda kapalı.
    </Message>

    <template v-else>
      <Card>
        <template #content>
          <div class="rm-toolbar">
            <p class="rm-intro">
              Bu mod, gerçek seçim yarışmasından bağımsızdır. Puanlama kuralları birebir aynıdır.
            </p>
            <Button
              label="Rastgele Puan Durumu"
              icon="pi pi-chart-bar"
              severity="secondary"
              outlined
              size="small"
              @click="router.push({ name: 'random-leaderboard' })"
            />
          </div>

          <Message
            v-if="selectionsLocked && !isTriggered"
            severity="warn"
            :closable="false"
            class="mt-3"
          >
            Seçimler kilitlendi. Rastgele atama yapılamaz.
          </Message>

          <Message v-else-if="configLocked" severity="info" :closable="false" class="mt-3">
            Koşul ve tier filtresi kilitlendi. Bunlar tetikleme sonrası değiştirilemez.
          </Message>

          <!-- Koşul seçimi -->
          <section class="rm-section">
            <h3 class="rm-section-title">Koşul</h3>
            <div class="rm-conditions">
              <label
                v-for="opt in CONDITIONS"
                :key="opt.value"
                class="rm-condition"
                :class="{ 'is-selected': condition === opt.value, 'is-disabled': configLocked }"
              >
                <RadioButton
                  v-model="condition"
                  :value="opt.value"
                  :disabled="configLocked"
                  name="rm-condition"
                />
                <div>
                  <strong>{{ opt.label }}</strong>
                  <p class="rm-condition-desc">{{ opt.description }}</p>
                </div>
              </label>
            </div>

            <div class="rm-same-group-row">
              <Checkbox
                v-model="noSameGroup"
                input-id="rm-no-same-group"
                :binary="true"
                :disabled="configLocked"
              />
              <label for="rm-no-same-group">
                Aynı gruptan takım gelmesin
                <br>
                <span class="text-muted">Atanan 3 takımın her biri farklı bir gruptan olur</span>
              </label>
            </div>
          </section>

          <!-- Tier filtresi -->
          <section class="rm-section">
            <h3 class="rm-section-title">Tier Filtresi</h3>
            <div class="rm-tiers">
              <label
                v-for="tier in tiers"
                :key="tier.id"
                class="rm-tier"
                :class="{
                  'is-selected': allowedTiers.includes(tier.id),
                  'is-disabled': configLocked,
                }"
              >
                <Checkbox
                  :model-value="allowedTiers.includes(tier.id)"
                  :binary="true"
                  :disabled="configLocked"
                  @click.prevent="toggleTier(tier.id)"
                />
                <span>{{ tier.name_tr }}</span>
              </label>
            </div>
            <Message
              v-if="!configLocked && allowedTiers.length === 0"
              severity="error"
              :closable="false"
              class="mt-2"
            >
              En az bir tier seçmelisiniz.
            </Message>
          </section>

          <div v-if="!isTriggered" class="rm-actions">
            <Button
              label="Rastgele Seç"
              icon="pi pi-bolt"
              :disabled="!canTrigger"
              :loading="triggering"
              @click="trigger"
            />
          </div>
        </template>
      </Card>

      <!-- Sonuç kartları -->
      <Card v-if="isTriggered" class="rm-results-card">
        <template #title>
          <div class="rm-results-header">
            <span>Takımların</span>
            <Tag :value="conditionLabel" severity="info" />
            <Tag v-if="noSameGroup" value="Farklı gruplar" severity="secondary" />
          </div>
        </template>
        <template #content>
          <div class="rm-slots">
            <div v-for="slot in slotNumbers" :key="slot" class="rm-slot">
              <div class="rm-slot-index">{{ slot }}</div>
              <div
                class="rm-slot-card"
                :class="{ 'is-spinning': spinningSlots.has(slot) }"
              >
                <strong class="rm-slot-name">{{ display[slot] ?? '—' }}</strong>
                <div
                  v-if="teamForSlot(slot) && !spinningSlots.has(slot)"
                  class="rm-slot-tags"
                >
                  <Tag :value="teamForSlot(slot)!.tier.name_tr" severity="info" />
                  <span class="group-chip-wrap" @click.stop>
                    <button
                      type="button"
                      class="group-chip-btn"
                      :aria-expanded="openGroupSlot === slot"
                      :aria-label="`Grup ${teamForSlot(slot)!.group_code} takımlarını göster`"
                      @click="toggleGroupPopover(slot)"
                    >
                      <Tag
                        :value="`Grup ${teamForSlot(slot)!.group_code}`"
                        severity="secondary"
                        class="group-chip"
                      />
                    </button>
                    <div
                      class="group-tooltip"
                      :class="{ 'is-open': openGroupSlot === slot }"
                      role="tooltip"
                    >
                      <p class="group-tooltip-title">Grup {{ teamForSlot(slot)!.group_code }}</p>
                      <ul class="group-tooltip-list">
                        <li
                          v-for="groupTeam in teamsInGroup(teamForSlot(slot)!.group_code)"
                          :key="groupTeam.id"
                          :class="{ 'is-current': groupTeam.id === teamForSlot(slot)!.id }"
                        >
                          {{ groupTeam.name_tr }}
                        </li>
                      </ul>
                    </div>
                  </span>
                </div>
              </div>
              <Button
                v-if="!rerollUsed && !selectionsLocked"
                label="Yeniden at"
                icon="pi pi-refresh"
                severity="secondary"
                text
                size="small"
                :loading="rerollingSlot === slot"
                :disabled="busy"
                @click="reroll(slot)"
              />
            </div>
          </div>

          <Message
            v-if="!rerollUsed && !selectionsLocked"
            severity="info"
            :closable="false"
            class="mt-3"
          >
            Takımlardan yalnızca birini bir kez aynı filtrelerle yeniden atabilirsiniz.
          </Message>
          <Message
            v-else-if="rerollUsed"
            severity="secondary"
            :closable="false"
            class="mt-3"
          >
            Yeniden atma hakkınızı kullandınız. Seçimleriniz kesinleşti.
          </Message>
        </template>
      </Card>
    </template>
  </div>
</template>

<style scoped>
.mt-2 {
  margin-top: 0.5rem;
}
.mt-3 {
  margin-top: 1rem;
}

.rm-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.rm-intro {
  margin: 0;
  color: var(--color-text-muted, #64748b);
  font-size: 0.9rem;
}

.rm-section {
  margin-top: 1.5rem;
}

.rm-section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.rm-conditions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.rm-condition {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 0.65rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.rm-condition.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.rm-condition.is-disabled {
  cursor: default;
  opacity: 0.85;
}

.rm-condition-desc {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.35;
}

.rm-same-group-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-top: 0.85rem;
}

.rm-same-group-row label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  cursor: pointer;
}

.rm-tiers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.rm-tier {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: border-color 0.15s, background 0.15s;
}

.rm-tier.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.rm-tier.is-disabled {
  cursor: default;
  opacity: 0.85;
}

.rm-actions {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.rm-results-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rm-slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.rm-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.rm-slot-index {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 0.85rem;
}

.rm-slot-card {
  width: 100%;
  min-height: 6rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  text-align: center;
  background: var(--color-surface, #fff);
}

.rm-slot-card.is-spinning {
  border-color: var(--color-primary);
  animation: rm-pulse 0.5s ease-in-out infinite alternate;
}

.rm-slot-name {
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.2;
}

.rm-slot-card.is-spinning .rm-slot-name {
  filter: blur(0.4px);
  opacity: 0.85;
}

.rm-slot-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  justify-content: center;
  align-items: center;
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
  border-radius: var(--radius-sm, 0.35rem);
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
  left: 50%;
  transform: translateX(-50%);
  top: calc(100% + 0.4rem);
  z-index: 20;
  min-width: 10rem;
  max-width: 14rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm, 0.5rem);
  background: var(--color-surface, var(--color-bg, #fff));
  box-shadow: var(--shadow-md, 0 8px 24px rgba(0, 0, 0, 0.12));
  text-align: left;
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
  color: var(--color-text-muted, #64748b);
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
  color: var(--color-text-secondary, var(--color-text, #334155));
}

.group-tooltip-list li.is-current {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}

@keyframes rm-pulse {
  from {
    box-shadow: 0 0 0 0 var(--color-primary-soft);
  }
  to {
    box-shadow: 0 0 0 6px var(--color-primary-soft);
  }
}

@media (max-width: 768px) {
  .rm-conditions,
  .rm-slots {
    grid-template-columns: 1fr;
  }
}
</style>
