<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';

type GroupTeam = { id: number; name: string; tier?: { name: string } | null };
type Group = { code: string; teams: GroupTeam[] };

const props = defineProps<{
  groups: Group[];
  rankings: Record<string, number[]>;
  selectedThirds: string[];
  thirdsComplete: boolean;
  showTiers: boolean;
}>();

const emit = defineEmits<{
  (e: 'move', code: string, index: number, direction: -1 | 1): void;
  (e: 'reorder', code: string, fromIndex: number, toIndex: number): void;
}>();

const dragCode = ref<string | null>(null);
const dragIndex = ref<number | null>(null);
const overIndex = ref<number | null>(null);

function teamName(code: string, teamId: number): string {
  const group = props.groups.find((g) => g.code === code);
  return group?.teams.find((t) => t.id === teamId)?.name ?? '—';
}

function teamTier(code: string, teamId: number): string | null {
  const group = props.groups.find((g) => g.code === code);
  return group?.teams.find((t) => t.id === teamId)?.tier?.name ?? null;
}

function orderedIds(code: string): number[] {
  return props.rankings[code] ?? [];
}

/**
 * Sıra numarası rozetinin rengi:
 * 1–2 yeşil (doğrudan tur atlar), 4 kırmızı (elenir).
 * 3. (üçüncülük adayı): seçim tamamlanana kadar sarı; tamamlandığında
 * seçilen üçüncüler yeşil, seçilmeyenler kırmızı.
 */
function badgeClass(code: string, index: number): string {
  if (index === 0 || index === 1) return 'rank-pos--green';
  if (index === 3) return 'rank-pos--red';
  // index === 2 → üçüncü
  if (!props.thirdsComplete) return 'rank-pos--yellow';
  return props.selectedThirds.includes(code) ? 'rank-pos--green' : 'rank-pos--red';
}

function onDragStart(code: string, index: number, event: DragEvent) {
  dragCode.value = code;
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    // Firefox sürüklemeyi başlatmak için veri ister.
    event.dataTransfer.setData('text/plain', String(index));
  }
}

function onDragOver(code: string, index: number, event: DragEvent) {
  if (dragCode.value !== code) return; // Yalnızca aynı grup içinde
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  overIndex.value = index;
}

function onDrop(code: string, index: number) {
  if (dragCode.value === code && dragIndex.value !== null && dragIndex.value !== index) {
    emit('reorder', code, dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragCode.value = null;
  dragIndex.value = null;
  overIndex.value = null;
}

function isDragging(code: string, index: number) {
  return dragCode.value === code && dragIndex.value === index;
}

function isDropTarget(code: string, index: number) {
  return dragCode.value === code && overIndex.value === index && dragIndex.value !== index;
}
</script>

<template>
  <div class="group-grid">
    <section v-for="group in groups" :key="group.code" class="group-card">
      <h3 class="group-card-title">Grup {{ group.code }}</h3>
      <ol class="rank-list">
        <li
          v-for="(teamId, index) in orderedIds(group.code)"
          :key="teamId"
          class="rank-row"
          :class="{
            'is-dragging': isDragging(group.code, index),
            'is-drop-target': isDropTarget(group.code, index),
          }"
          draggable="true"
          @dragstart="onDragStart(group.code, index, $event)"
          @dragover="onDragOver(group.code, index, $event)"
          @drop="onDrop(group.code, index)"
          @dragend="resetDrag"
        >
          <i class="pi pi-bars drag-handle" aria-hidden="true" />
          <span class="rank-pos" :class="badgeClass(group.code, index)">{{ index + 1 }}</span>
          <span class="rank-name">{{ teamName(group.code, teamId) }}</span>
          <span
            v-if="showTiers && teamTier(group.code, teamId)"
            class="tier-chip"
            :title="teamTier(group.code, teamId) ?? undefined"
          >
            {{ teamTier(group.code, teamId) }}
          </span>
          <span class="rank-actions">
            <Button
              type="button"
              icon="pi pi-chevron-up"
              text
              rounded
              size="small"
              aria-label="Yukarı taşı"
              :disabled="index === 0"
              @click="emit('move', group.code, index, -1)"
            />
            <Button
              type="button"
              icon="pi pi-chevron-down"
              text
              rounded
              size="small"
              aria-label="Aşağı taşı"
              :disabled="index === orderedIds(group.code).length - 1"
              @click="emit('move', group.code, index, 1)"
            />
          </span>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.group-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.85rem;
}

@media (max-width: 1100px) {
  .group-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .group-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 480px) {
  .group-grid {
    grid-template-columns: 1fr;
  }
}

.group-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  overflow: hidden;
}

.group-card-title {
  margin: 0;
  padding: 0.55rem 0.85rem;
  background: var(--color-bg-subtle);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.92rem;
  font-weight: 700;
}

.rank-list {
  list-style: none;
  margin: 0;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.rank-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: grab;
}

.rank-row:active {
  cursor: grabbing;
}

.rank-row.is-dragging {
  opacity: 0.4;
}

.rank-row.is-drop-target {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.drag-handle {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: grab;
}

.rank-pos {
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-bg-subtle);
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  transition: background 0.15s, color 0.15s;
}

.rank-pos--green {
  background: var(--color-success);
  color: #fff;
}

.rank-pos--yellow {
  background: var(--color-warning);
  color: #fff;
}

.rank-pos--red {
  background: var(--color-danger);
  color: #fff;
}

.rank-name {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tier-chip {
  flex-shrink: 0;
  max-width: 6rem;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--color-bg-subtle);
  border: 1px solid var(--color-border);
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-actions {
  display: flex;
  flex-shrink: 0;
}
</style>
