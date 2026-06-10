<script setup lang="ts" generic="T extends string">
/**
 * Horizontally scrollable, underline-style tab bar shared across the
 * leaderboard, admin panel and tournament guide. Use with `v-model` bound to
 * the active tab key.
 */
defineProps<{
  tabs: ReadonlyArray<{ key: T; label: string }>;
  modelValue: T;
  ariaLabel?: string;
}>();

defineEmits<{ (e: 'update:modelValue', value: T): void }>();
</script>

<template>
  <nav class="tab-bar" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      role="tab"
      class="tab-bar__tab"
      :class="{ 'is-active': modelValue === tab.key }"
      :aria-selected="modelValue === tab.key"
      @click="$emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
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

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab-bar__tab {
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

.tab-bar__tab:hover {
  color: var(--color-text);
}

.tab-bar__tab.is-active {
  color: var(--color-primary-hover);
  border-bottom-color: var(--color-primary);
}

@media (max-width: 768px) {
  .tab-bar__tab {
    padding: 0.65rem 0.75rem;
    font-size: 0.85rem;
  }
}
</style>
