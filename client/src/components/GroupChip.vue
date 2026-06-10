<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import Tag from 'primevue/tag';

export type GroupChipTeam = { id: number; name: string };

const props = withDefaults(
  defineProps<{
    groupCode: string;
    teams: GroupChipTeam[];
    currentTeamId?: number;
    align?: 'start' | 'end' | 'center';
  }>(),
  { align: 'end' },
);

const GAP_PX = 6;
const VIEWPORT_PADDING = 8;

const chipRef = ref<HTMLButtonElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const isHovered = ref(false);
const isPinned = ref(false);
const placement = ref<'top' | 'bottom'>('bottom');
const tooltipStyle = ref<Record<string, string>>({
  position: 'fixed',
  visibility: 'hidden',
  zIndex: '1100',
});

const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const isVisible = computed(() => isHovered.value || isPinned.value);
const sortedTeams = computed(() =>
  [...props.teams].sort((a, b) => a.name.localeCompare(b.name, 'tr')),
);

let closeTimer: ReturnType<typeof setTimeout> | null = null;
let outsideClickHandler: ((event: MouseEvent) => void) | null = null;
let resizeObserver: ResizeObserver | null = null;

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function scheduleHoverClose() {
  if (isPinned.value) return;
  clearCloseTimer();
  closeTimer = setTimeout(() => {
    isHovered.value = false;
  }, 120);
}

function onPointerEnter() {
  if (!supportsHover) return;
  clearCloseTimer();
  isHovered.value = true;
}

function onPointerLeave() {
  if (!supportsHover) return;
  scheduleHoverClose();
}

function onToggleClick(event: MouseEvent) {
  event.stopPropagation();
  isPinned.value = !isPinned.value;
  if (isPinned.value) {
    isHovered.value = false;
    clearCloseTimer();
  }
}

function updatePlacement() {
  const chip = chipRef.value;
  const tooltip = tooltipRef.value;
  if (!chip || !tooltip) return false;

  const chipRect = chip.getBoundingClientRect();
  const tooltipHeight = tooltip.offsetHeight;
  const tooltipWidth = tooltip.offsetWidth;
  if (tooltipHeight === 0 || tooltipWidth === 0) return false;

  const spaceBelow = window.innerHeight - chipRect.bottom - VIEWPORT_PADDING;
  const spaceAbove = chipRect.top - VIEWPORT_PADDING;

  placement.value =
    spaceBelow < tooltipHeight + GAP_PX && spaceAbove > spaceBelow ? 'top' : 'bottom';

  let left: number;
  if (props.align === 'center') {
    left = chipRect.left + chipRect.width / 2 - tooltipWidth / 2;
  } else if (props.align === 'end') {
    left = chipRect.right - tooltipWidth;
  } else {
    left = chipRect.left;
  }

  left = Math.max(
    VIEWPORT_PADDING,
    Math.min(left, window.innerWidth - tooltipWidth - VIEWPORT_PADDING),
  );

  const top =
    placement.value === 'bottom'
      ? chipRect.bottom + GAP_PX
      : chipRect.top - GAP_PX - tooltipHeight;

  tooltipStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    visibility: 'visible',
    zIndex: '1100',
  };
  return true;
}

async function schedulePlacement() {
  tooltipStyle.value = {
    position: 'fixed',
    top: '0',
    left: '0',
    visibility: 'hidden',
    zIndex: '1100',
  };

  await nextTick();

  const measure = () => {
    if (!isVisible.value) return;
    updatePlacement();
  };

  measure();
  requestAnimationFrame(() => {
    measure();
    requestAnimationFrame(measure);
  });
}

function observeTooltip() {
  unobserveTooltip();
  const tooltip = tooltipRef.value;
  if (!tooltip) return;

  resizeObserver = new ResizeObserver(() => {
    if (isVisible.value) updatePlacement();
  });
  resizeObserver.observe(tooltip);
}

function unobserveTooltip() {
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function addGlobalListeners() {
  window.addEventListener('scroll', updatePlacement, true);
  window.addEventListener('resize', updatePlacement);

  outsideClickHandler = (event: MouseEvent) => {
    const target = event.target as Node;
    if (chipRef.value?.contains(target) || tooltipRef.value?.contains(target)) return;
    isPinned.value = false;
    isHovered.value = false;
  };
  setTimeout(() => {
    if (outsideClickHandler && isVisible.value) {
      document.addEventListener('click', outsideClickHandler);
    }
  }, 0);
}

function removeGlobalListeners() {
  window.removeEventListener('scroll', updatePlacement, true);
  window.removeEventListener('resize', updatePlacement);
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

watch(isVisible, async (visible) => {
  if (visible) {
    await schedulePlacement();
    await nextTick();
    observeTooltip();
    addGlobalListeners();
  } else {
    unobserveTooltip();
    removeGlobalListeners();
    tooltipStyle.value = {
      position: 'fixed',
      visibility: 'hidden',
      zIndex: '1100',
    };
  }
});

onUnmounted(() => {
  clearCloseTimer();
  unobserveTooltip();
  removeGlobalListeners();
});
</script>

<template>
  <span class="group-chip-wrap" @click.stop>
    <button
      ref="chipRef"
      type="button"
      class="group-chip-btn"
      :aria-expanded="isVisible"
      :aria-label="`Grup ${groupCode} takımlarını göster`"
      @mouseenter="onPointerEnter"
      @mouseleave="onPointerLeave"
      @click="onToggleClick"
    >
      <Tag :value="`Grup ${groupCode}`" severity="secondary" class="group-chip" />
    </button>

    <Teleport to="body">
      <div
        v-if="isVisible"
        ref="tooltipRef"
        class="group-tooltip"
        :class="`is-${placement}`"
        :style="tooltipStyle"
        role="tooltip"
        @mouseenter="onPointerEnter"
        @mouseleave="onPointerLeave"
      >
        <p class="group-tooltip-title">Grup {{ groupCode }}</p>
        <ul class="group-tooltip-list">
          <li
            v-for="team in sortedTeams"
            :key="team.id"
            :class="{ 'is-current': team.id === currentTeamId }"
          >
            {{ team.name }}
          </li>
        </ul>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
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
</style>

<style>
.group-tooltip {
  min-width: 10rem;
  max-width: 14rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  box-shadow: var(--shadow-md);
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
</style>
