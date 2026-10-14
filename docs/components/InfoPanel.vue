<script setup lang="ts">
import { ref } from 'vue'
import ActionButton from './ActionButton.vue'
import { toJson, type Section, type Value } from '../lib/browser-info'

/**
 * The sections of one category as a table, with the buttons above it. Where
 * the rows come from and when they change is up to the parent.
 */
const props = defineProps<{
  sections: Section[]
  /** Show a 再取得 button that emits `refresh`. */
  refreshable?: boolean
}>()

defineEmits<{ refresh: [] }>()

function isUnavailable(value: Value): value is null {
  return value === null
}

const copied = ref(false)

async function copyJson() {
  try {
    await navigator.clipboard.writeText(toJson(props.sections))
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    // Clipboard access can be denied; the button simply never confirms.
  }
}
</script>

<template>
  <div class="bi-root">
    <div class="bi-toolbar">
      <ActionButton v-if="refreshable" @click="$emit('refresh')">再取得</ActionButton>
      <ActionButton :disabled="sections.length === 0" @click="copyJson">
        {{ copied ? 'Copied' : 'JSONでコピー' }}
      </ActionButton>
    </div>

    <slot />

    <p v-if="sections.length === 0" class="bi-loading">読み込み中…</p>

    <template v-for="section in sections" :key="section.id">
      <!-- e.g. #before-sensors: controls that act on one section, placed right above it. -->
      <slot :name="`before-${section.id}`" />
      <section class="bi-section" :data-section="section.id">
        <div class="bi-section-title">{{ section.title }}</div>
        <div v-for="row in section.rows" :key="row.label" class="bi-row">
          <div class="bi-label">
            <div class="bi-label-text">{{ row.label }}</div>
            <code v-if="row.api" class="bi-api">{{ row.api }}</code>
          </div>
          <div class="bi-value">
            <span v-if="isUnavailable(row.value)" class="bi-na">{{ row.missing ?? '取得できない (このブラウザは未対応)' }}</span>
            <ul v-else-if="Array.isArray(row.value)" class="bi-list">
              <li v-for="(item, i) in row.value" :key="i">{{ item }}</li>
            </ul>
            <span v-else-if="row.value === ''" class="bi-na">(空文字)</span>
            <span v-else class="bi-text">{{ row.value }}</span>
            <img v-if="row.image" :src="row.image" class="bi-image" :alt="`${row.label}の画像`" />
            <div v-if="row.note" class="bi-note">{{ row.note }}</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.bi-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.bi-toolbar {
  display: flex;
  gap: 8px;
}

.bi-loading {
  margin: 0;
  color: var(--vp-c-text-2);
}

.bi-section {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  overflow: hidden;
}

.bi-section-title {
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  font-size: 16px;
  /* 700 rather than 600: most Japanese system fonts have no semibold, so 600
     renders at regular weight and the title looks like any other row. */
  font-weight: 700;
}

.bi-row {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: 12px;
  padding: 10px 12px;
}

.bi-row + .bi-row {
  border-top: 1px solid var(--vp-c-divider);
}

@media (max-width: 640px) {
  .bi-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

.bi-label-text {
  font-size: 14px;
  font-weight: 500;
}

.bi-api {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--vp-c-text-2);
  overflow-wrap: anywhere;
}

.bi-value {
  min-width: 0;
  font-size: 14px;
}

.bi-text {
  font-family: var(--vp-font-family-mono);
  overflow-wrap: anywhere;
}

.bi-list {
  margin: 0;
  padding-left: 18px;
  font-family: var(--vp-font-family-mono);
}

.bi-list li {
  margin: 0;
}

.bi-image {
  display: block;
  max-width: 100%;
  margin-top: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: repeating-conic-gradient(var(--vp-c-bg-soft) 0 25%, var(--vp-c-bg) 0 50%) 0 0 / 12px 12px;
}

.bi-na {
  color: var(--vp-c-text-3);
}

.bi-note {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
</style>
