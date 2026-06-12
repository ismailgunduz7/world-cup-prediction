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
    class="corner-flag-icon"
  >
    <path d="M4 20V4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    <path d="M4 20h16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" opacity="0.35" />
    <path d="M4 4L12.5 7.25L4 10.5Z" fill="#38bdf8" stroke="#2563eb" stroke-width="0.75" stroke-linejoin="round" />
  </svg>
</template>
