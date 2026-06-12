<script setup lang="ts">
withDefaults(defineProps<{ size?: number | string }>(), { size: 16 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="yellow-card-icon"
  >
    <rect x="6" y="3" width="12" height="18" rx="1.75" fill="#facc15" stroke="#ca8a04" stroke-width="1.25" />
  </svg>
</template>
