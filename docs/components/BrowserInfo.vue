<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  DISPLAY_FEATURES,
  clientHintsSection,
  displaySection,
  localeSection,
  mediaQueryOf,
  privacySection,
  toJson,
  userAgentSection,
  type Section,
  type Value
} from '../lib/browser-info'

// Empty until mounted: the page is prerendered at build time, where there is
// no navigator, and what the build machine would report is not the reader's.
const sections = ref<Section[]>([])

function collect(): Section[] {
  return [
    userAgentSection(navigator),
    localeSection(navigator, new Date()),
    privacySection(navigator),
    displaySection(window.matchMedia.bind(window))
  ]
}

/** Bumped per refresh, so a slow client-hints answer cannot overwrite a newer one. */
let generation = 0

async function refresh() {
  const mine = ++generation
  const sync = collect()
  sections.value = sync
  const hints = await clientHintsSection(navigator)
  if (mine !== generation) return
  // Client hints read best right after the UA string they replace.
  sections.value = [sync[0], hints, ...sync.slice(1)]
}

// Changing the OS theme or language while the page is open updates the table,
// which is the point being made: a page is told about it, not just at load.
const stops: (() => void)[] = []

onMounted(() => {
  refresh()

  for (const feature of DISPLAY_FEATURES) {
    for (const value of feature.values) {
      const list = window.matchMedia(mediaQueryOf(feature.feature, value))
      list.addEventListener('change', refresh)
      stops.push(() => list.removeEventListener('change', refresh))
    }
  }
  window.addEventListener('languagechange', refresh)
  stops.push(() => window.removeEventListener('languagechange', refresh))
})

onBeforeUnmount(() => {
  for (const stop of stops) stop()
})

function isUnavailable(value: Value): value is null {
  return value === null
}

const copied = ref(false)

async function copyJson() {
  try {
    await navigator.clipboard.writeText(toJson(sections.value))
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
      <button class="bi-btn" @click="refresh">再取得</button>
      <button class="bi-btn" :disabled="sections.length === 0" @click="copyJson">
        {{ copied ? 'Copied' : 'JSONでコピー' }}
      </button>
    </div>

    <p v-if="sections.length === 0" class="bi-loading">読み込み中…</p>

    <section v-for="section in sections" :key="section.id" class="bi-section" :data-section="section.id">
      <div class="bi-section-title">{{ section.title }}</div>
      <div v-for="row in section.rows" :key="row.label" class="bi-row">
        <div class="bi-label">
          <div class="bi-label-text">{{ row.label }}</div>
          <code class="bi-api">{{ row.api }}</code>
        </div>
        <div class="bi-value">
          <span v-if="isUnavailable(row.value)" class="bi-na">取得できない (このブラウザは未対応)</span>
          <ul v-else-if="Array.isArray(row.value)" class="bi-list">
            <li v-for="(item, i) in row.value" :key="i">{{ item }}</li>
          </ul>
          <span v-else-if="row.value === ''" class="bi-na">(空文字)</span>
          <span v-else class="bi-text">{{ row.value }}</span>
          <div v-if="row.note" class="bi-note">{{ row.note }}</div>
        </div>
      </div>
    </section>
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
  padding: 6px 12px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  font-size: 14px;
  font-weight: 600;
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
