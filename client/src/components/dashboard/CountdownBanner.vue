<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
  targetAt: string | null;
  label: string;
}>();

const remaining = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

function updateRemaining() {
  if (!props.targetAt) {
    remaining.value = '';
    return;
  }

  const diff = new Date(props.targetAt).getTime() - Date.now();
  if (diff <= 0) {
    remaining.value = '0 sn';
    return;
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0 || days > 0) parts.push(`${hours} sa`);
  parts.push(`${minutes} dk`, `${seconds} sn`);
  remaining.value = parts.join(' ');
}

const targetLabel = computed(() => {
  if (!props.targetAt) return null;
  return new Date(props.targetAt).toLocaleString('tr-TR');
});

onMounted(() => {
  updateRemaining();
  timer = setInterval(updateRemaining, 1000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div v-if="targetAt" class="countdown-banner">
    <p class="countdown-label">{{ label }}</p>
    <p class="countdown-value">{{ remaining }}</p>
    <p class="countdown-target text-muted">{{ targetLabel }}</p>
  </div>
</template>

<style scoped>
.countdown-banner {
  padding: 1rem 1.15rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-subtle);
}

.countdown-label {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.countdown-value {
  margin: 0.35rem 0 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-primary-hover);
  letter-spacing: 0.01em;
}

.countdown-target {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
}
</style>
