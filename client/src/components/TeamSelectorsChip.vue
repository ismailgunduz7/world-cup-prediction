<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { SelectorGroup } from '@/utils/leaderboard';

export type { SelectorGroup };

const props = withDefaults(
  defineProps<{
    groups: SelectorGroup[];
    /** 'real' = gerçek seçim (mavi, kişi ikonu), 'random' = rastgele atama (amber, şimşek ikonu). */
    variant?: 'real' | 'random';
  }>(),
  { variant: 'real' },
);

const isRandom = () => props.variant === 'random';

const total = () => props.groups.reduce((n, g) => n + g.players.length, 0);

const chipEl = ref<HTMLElement | null>(null);
const open = ref(false);
const pos = ref({ top: 0, left: 0 });

function place() {
  const el = chipEl.value;
  if (!el) return;
  const r = el.getBoundingClientRect();
  pos.value = { top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX };
}

function show() {
  place();
  open.value = true;
}

function hide() {
  open.value = false;
}

// Masaüstü: hover ile aç/kapa. Mobil: dokunuşta (click) aç/kapa.
function toggle() {
  if (open.value) hide();
  else show();
}

// Popover açıkken dışarı bir tık/dokunuş kapatır (mobil için gerekli).
function onDocPointer(e: Event) {
  const target = e.target as Node;
  if (chipEl.value && !chipEl.value.contains(target)) hide();
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocPointer, true);
    window.addEventListener('scroll', hide, true);
  } else {
    document.removeEventListener('click', onDocPointer, true);
    window.removeEventListener('scroll', hide, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocPointer, true);
  window.removeEventListener('scroll', hide, true);
});
</script>

<template>
  <span
    ref="chipEl"
    class="selectors-chip"
    :class="{ 'selectors-chip--random': isRandom() }"
    role="button"
    tabindex="0"
    :aria-expanded="open"
    :aria-label="isRandom() ? 'Bu takımın rastgele atandığı oyuncular' : 'Bu takımı seçen oyuncular'"
    @mouseenter="show"
    @mouseleave="hide"
    @click.stop="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <i :class="[isRandom() ? 'pi pi-bolt' : 'pi pi-users', 'selectors-chip-icon']" aria-hidden="true" />
    <span class="selectors-chip-count">{{ total() }}</span>

    <Teleport to="body">
      <div
        v-if="open"
        class="selectors-pop"
        :class="{ 'selectors-pop--random': isRandom() }"
        role="tooltip"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      >
        <div v-for="g in groups" :key="g.competitionName" class="selectors-pop-group">
          <span class="selectors-pop-comp">{{ g.competitionName }}</span>
          <span class="selectors-pop-players">{{ g.players.join(', ') }}</span>
        </div>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.selectors-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--p-primary-100, #dbeafe);
  color: var(--p-primary-700, #1d4ed8);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
  user-select: none;
  vertical-align: middle;
}

.selectors-chip--random {
  background: var(--p-amber-100, #fef3c7);
  color: var(--p-amber-700, #b45309);
}

.selectors-chip-icon {
  font-size: 0.7rem;
}

/* Popover body'e teleport edildiği için global stil (scoped değil). */
</style>

<style>
.selectors-pop {
  position: absolute;
  z-index: 1200;
  max-width: 280px;
  padding: 0.55rem 0.7rem;
  border-radius: 10px;
  background: var(--color-surface, #fff);
  color: var(--color-text-primary, #0f172a);
  border: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.selectors-pop-group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.selectors-pop-comp {
  font-weight: 700;
  font-size: 0.72rem;
  color: var(--color-primary-hover, #2563eb);
}

.selectors-pop--random .selectors-pop-comp {
  color: var(--p-amber-600, #d97706);
}

.selectors-pop-players {
  color: var(--color-text-secondary, #334155);
  line-height: 1.35;
}
</style>
