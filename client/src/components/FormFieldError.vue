<script setup lang="ts">
defineProps<{ message?: string }>();
</script>

<template>
  <small v-if="message" class="field-error">{{ message }}</small>
</template>

<style scoped>
.field-error {
  color: var(--color-danger);
  font-size: 0.8rem;
}
</style>
