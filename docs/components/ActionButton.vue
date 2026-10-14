<script setup lang="ts">
/**
 * The small button above the tables of the reveal tabs. One place for its look,
 * so the buttons of InfoPanel and of the panels that add their own stay alike.
 * `class`, `disabled` and `@click` fall through to the <button>.
 */
</script>

<template>
  <button class="bi-btn" type="button"><slot /></button>
</template>

<style scoped>
.bi-btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.bi-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.bi-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
