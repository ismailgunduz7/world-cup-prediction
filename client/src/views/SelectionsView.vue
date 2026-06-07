<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Message from 'primevue/message';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import ProgressBar from 'primevue/progressbar';
import { useToast } from 'primevue/usetoast';
import PageHeader from '@/components/PageHeader.vue';
import LoadingState from '@/components/LoadingState.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/api/client';
import {
  clearSelectionDraft,
  loadSelectionDraft,
  saveSelectionDraft,
} from '@/utils/selection-draft';

type Team = {
  id: number;
  name_tr: string;
  group_code: string;
  tier: { name_tr: string };
};

const toast = useToast();
const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const saving = ref(false);
const draftReady = ref(false);
const allTeams = ref<Team[]>([]);
const selectedIds = ref<number[]>([]);
const savedSelectedIds = ref<number[]>([]);
const selectionsLocked = ref(false);
const maxSelections = 3;

onMounted(async () => {
  const [teamsRes, selRes] = await Promise.all([api.get('/teams'), api.get('/selections/mine')]);
  allTeams.value = teamsRes.data.teams;
  savedSelectedIds.value = selRes.data.selections.map((s: { team_id: number }) => s.team_id);
  selectionsLocked.value = selRes.data.selectionsLocked;

  const userId = auth.user?.id;
  const validTeamIds = new Set(allTeams.value.map((team) => team.id));

  if (selectionsLocked.value || !userId) {
    selectedIds.value = [...savedSelectedIds.value];
    if (userId) clearSelectionDraft(userId);
  } else {
    const draft = loadSelectionDraft(userId);
    if (draft !== null) {
      selectedIds.value = draft.filter((id) => validTeamIds.has(id)).slice(0, maxSelections);
    } else {
      selectedIds.value = [...savedSelectedIds.value];
    }
  }

  loading.value = false;
  draftReady.value = true;
});

watch(
  selectedIds,
  (ids) => {
    if (!draftReady.value || selectionsLocked.value || !auth.user?.id) return;
    saveSelectionDraft(auth.user.id, [...ids]);
  },
  { deep: true },
);

const canSave = computed(
  () => !selectionsLocked.value && selectedIds.value.length === maxSelections,
);

const visibleTeams = computed(() => {
  if (!selectionsLocked.value) return allTeams.value;
  const selected = new Set(savedSelectedIds.value);
  return allTeams.value.filter((team) => selected.has(team.id));
});

const progressPercent = computed(() => (selectedIds.value.length / maxSelections) * 100);

const hasUnsavedChanges = computed(() => {
  if (selectedIds.value.length !== savedSelectedIds.value.length) return true;
  const saved = new Set(savedSelectedIds.value);
  return selectedIds.value.some((id) => !saved.has(id));
});

function toggleTeam(teamId: number) {
  if (selectionsLocked.value) return;
  const idx = selectedIds.value.indexOf(teamId);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else if (selectedIds.value.length < maxSelections) {
    selectedIds.value.push(teamId);
  }
}

function isSelected(teamId: number) {
  return selectedIds.value.includes(teamId);
}

async function save() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    await api.put('/selections', { teamIds: selectedIds.value });
    savedSelectedIds.value = [...selectedIds.value];
    if (auth.user?.id) clearSelectionDraft(auth.user.id);
    toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Takım seçimleriniz güncellendi', life: 3000 });
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Kayıt başarısız';
    toast.add({ severity: 'error', summary: 'Hata', detail: message, life: 4000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <LoadingState v-if="loading" />
  <div v-else class="page-stack">
    <PageHeader
      title="Takım Seçimi"
      :subtitle="
        selectionsLocked
          ? 'Seçimleriniz kilitlendi — seçtiğiniz takımlar aşağıda'
          : 'Turnuvadan 3 ülke seç — kilitlenene kadar değiştirebilirsin'
      "
    />

    <Card>
      <template #content>
        <div v-if="!selectionsLocked" class="selection-progress">
          <div class="selection-progress-label">
            <span>{{ selectedIds.length }} / {{ maxSelections }} takım seçildi</span>
            <span v-if="selectedIds.length < maxSelections" class="text-muted">
              {{ maxSelections - selectedIds.length }} seçim kaldı
            </span>
          </div>
          <ProgressBar :value="progressPercent" :show-value="false" />
        </div>

        <Message v-if="selectionsLocked" severity="warn" :closable="false" :class="selectionsLocked ? 'mt-0' : 'mt-3'">
          Seçimler kilitlendi. Artık değişiklik yapılamaz.
        </Message>

        <Message
          v-if="selectionsLocked && visibleTeams.length === 0"
          severity="info"
          :closable="false"
          class="mt-3"
        >
          Kilitlenmeden önce takım seçimi yapmadınız.
        </Message>

        <div v-if="selectionsLocked" class="team-grid mt-3">
          <div v-for="team in visibleTeams" :key="team.id" class="team-tile team-tile-locked">
            <div>
              <strong>{{ team.name_tr }}</strong>
              <div class="tag-row mt-1">
                <Tag :value="team.tier.name_tr" severity="info" />
                <Tag :value="`Grup ${team.group_code}`" severity="secondary" />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="team-grid mt-3">
          <label
            v-for="team in visibleTeams"
            :key="team.id"
            class="team-tile"
            :class="{ 'is-selected': isSelected(team.id) }"
          >
            <Checkbox
              :model-value="isSelected(team.id)"
              :binary="true"
              :disabled="!isSelected(team.id) && selectedIds.length >= maxSelections"
              @click.prevent="toggleTeam(team.id)"
            />
            <div>
              <strong>{{ team.name_tr }}</strong>
              <div class="tag-row mt-1">
                <Tag :value="team.tier.name_tr" severity="info" />
                <Tag :value="`Grup ${team.group_code}`" severity="secondary" />
              </div>
            </div>
          </label>
        </div>

        <div class="actions">
          <Button
            v-if="!selectionsLocked"
            label="Kaydet"
            icon="pi pi-save"
            :disabled="!canSave"
            :loading="saving"
            @click="save"
          />
          <Message v-if="hasUnsavedChanges && !selectionsLocked" severity="info" :closable="false" class="actions-hint">
            {{
              canSave
                ? 'Maçları görmek için seçimlerinizi kaydedin.'
                : 'Seçimleriniz taslak olarak saklandı; 3 takım seçip kaydedebilirsiniz.'
            }}
          </Message>
          <Button
            v-for="id in savedSelectedIds"
            :key="id"
            :label="`${allTeams.find((t) => t.id === id)?.name_tr} Maçları`"
            icon="pi pi-calendar"
            severity="secondary"
            outlined
            @click="router.push({ name: 'team-matches', params: { id }, query: { from: 'selections' } })"
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.selection-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.selection-progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.9rem;
  font-weight: 500;
}

.mt-1 {
  margin-top: 0.35rem;
}

.mt-3 {
  margin-top: 1rem;
}

.mt-0 {
  margin-top: 0;
}

.team-tile-locked {
  cursor: default;
  border-color: var(--color-primary-soft);
  background: var(--color-primary-soft);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.actions-hint {
  flex: 1 1 100%;
  margin: 0;
}
</style>
