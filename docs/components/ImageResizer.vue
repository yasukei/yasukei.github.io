<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  MAX_FILES,
  OUTPUT_FORMATS,
  acceptFiles,
  exceedsCanvasLimit,
  formatBytes,
  isEnlargement,
  outputMime,
  outputName,
  qualityApplies,
  sizeDelta,
  stepPlan,
  targetSize,
  type OutputChoice,
  type Rejection,
  type ResizeMode,
  type Size
} from '../lib/image-resize'
import { decode, release, renderPlan, toBlob } from '../lib/canvas-resize'

interface Item {
  id: number
  file: File
  /** Size of the source, remembered so the row can show it without a bitmap in hand. */
  source: Size | null
  result: { url: string; name: string; size: Size; bytes: number } | null
  error: string | null
  busy: boolean
}

const MODES: { value: ResizeMode; label: string; unit: string }[] = [
  { value: 'longest-edge', label: 'Longest edge', unit: 'px' },
  { value: 'width', label: 'Width', unit: 'px' },
  { value: 'height', label: 'Height', unit: 'px' },
  { value: 'percent', label: 'Percent', unit: '%' }
]

/** Long enough that typing a four digit number is one run, not four. */
const RERUN_DELAY = 250

const items = ref<Item[]>([])
const rejected = ref<Rejection[]>([])
const dragging = ref(false)

const mode = ref<ResizeMode>('longest-edge')
// One remembered value per mode: switching to Percent and back should not find
// 1600 sitting in a field that now means 1600%.
const values = reactive<Record<ResizeMode, string>>({
  'longest-edge': '1600',
  width: '1200',
  height: '1200',
  percent: '50'
})
const format = ref<OutputChoice>('source')
const quality = ref(0.85)
const allowEnlarge = ref(false)

const unit = computed(() => MODES.find((m) => m.value === mode.value)?.unit ?? 'px')
const amount = computed(() => Number(values[mode.value]))
const spec = computed(() => ({ mode: mode.value, value: amount.value }))
const showQuality = computed(() =>
  items.value.some((item) => qualityApplies(outputMime(item.file.type, format.value)))
)

const done = computed(() => items.value.filter((item) => item.result !== null))
const totals = computed(() => {
  const before = done.value.reduce((sum, item) => sum + item.file.size, 0)
  const after = done.value.reduce((sum, item) => sum + (item.result?.bytes ?? 0), 0)
  return { before, after, delta: sizeDelta(before, after) }
})

let nextId = 1
/** Only the newest run may write results; an older one has stale settings. */
let currentRun = 0
let rerunTimer: ReturnType<typeof setTimeout> | null = null

function dimensions(size: Size | null): string {
  return size ? `${size.width} × ${size.height}` : ''
}

function discardResult(item: Item) {
  if (item.result) URL.revokeObjectURL(item.result.url)
  item.result = null
}

async function addFiles(incoming: File[]) {
  const outcome = acceptFiles(
    items.value.map((item) => item.file),
    incoming
  )
  rejected.value = outcome.rejected

  for (const file of outcome.accepted) {
    items.value.push({
      id: nextId++,
      file,
      source: null,
      result: null,
      error: null,
      busy: true
    })
  }
  if (outcome.accepted.length > 0) await run()
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles([...(input.files ?? [])])
  // So the same file can be chosen again after being removed.
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles([...(event.dataTransfer?.files ?? [])])
}

function remove(id: number) {
  const item = items.value.find((candidate) => candidate.id === id)
  if (!item) return

  discardResult(item)
  items.value = items.value.filter((candidate) => candidate.id !== id)
  rejected.value = []
}

function clearAll() {
  for (const item of items.value) discardResult(item)
  items.value = []
  rejected.value = []
}

/**
 * Resizes every image at the current settings, one at a time.
 *
 * Each bitmap is decoded for this run and released at the end of it, rather
 * than kept for the next one. Holding ten decoded 12 megapixel photos is most
 * of a gigabyte of pixels -- enough to have the tab killed on a phone -- and
 * decoding again costs a fraction of a second per image, which a run only pays
 * once the settings have settled.
 */
async function run() {
  const runId = ++currentRun

  for (const item of items.value) {
    if (runId !== currentRun) return

    item.busy = true
    item.error = null
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await decode(item.file)
      item.source = { width: bitmap.width, height: bitmap.height }
      if (runId !== currentRun) return

      const target = targetSize(item.source, spec.value, { allowEnlarge: allowEnlarge.value })
      if (target === null) {
        item.error = 'Enter a size to resize to.'
        continue
      }

      const plan = stepPlan(item.source, target)
      if (plan.length > 0 && exceedsCanvasLimit(plan[0])) {
        item.error = 'This image is too large for the browser to redraw.'
        continue
      }

      const mime = outputMime(item.file.type, format.value)
      const canvas = renderPlan(bitmap, plan)
      const blob = await toBlob(canvas, mime, qualityApplies(mime) ? quality.value : undefined)
      if (runId !== currentRun) return

      discardResult(item)
      item.result = {
        url: URL.createObjectURL(blob),
        name: outputName(item.file.name, target, mime),
        size: target,
        bytes: blob.size
      }
    } catch (error) {
      item.error = error instanceof Error ? error.message : 'This image could not be resized.'
    } finally {
      release(bitmap)
      item.busy = false
    }
  }
}

function scheduleRun() {
  if (rerunTimer) clearTimeout(rerunTimer)
  rerunTimer = setTimeout(() => {
    rerunTimer = null
    void run()
  }, RERUN_DELAY)
}

watch([mode, values, format, quality, allowEnlarge], () => {
  if (items.value.length > 0) scheduleRun()
})

function save(item: Item) {
  if (!item.result) return
  const link = document.createElement('a')
  link.href = item.result.url
  link.download = item.result.name
  link.click()
}

function saveAll() {
  // Staggered: browsers treat a burst of downloads from one gesture as a popup
  // and drop all but the first.
  done.value.forEach((item, index) => {
    setTimeout(() => save(item), index * 150)
  })
}

onBeforeUnmount(() => {
  if (rerunTimer) clearTimeout(rerunTimer)
  clearAll()
})
</script>

<template>
  <div class="ir-root">
    <label
      class="ir-drop"
      :class="{ 'ir-drop-over': dragging }"
      @dragover.prevent="dragging = true"
      @dragenter.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        class="ir-file"
        type="file"
        accept="image/*"
        multiple
        @change="onPick"
        aria-label="Choose images"
      />
      <strong>Drop images here</strong>
      <span class="ir-drop-note">or click to choose — up to {{ MAX_FILES }} at a time</span>
    </label>

    <div class="ir-settings">
      <label class="ir-field">
        <span class="ir-label">Resize by</span>
        <select class="ir-input" v-model="mode" aria-label="Resize by">
          <option v-for="option in MODES" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="ir-field ir-field-narrow">
        <span class="ir-label">Amount</span>
        <span class="ir-amount">
          <input
            class="ir-input"
            v-model="values[mode]"
            type="text"
            inputmode="numeric"
            spellcheck="false"
            aria-label="Amount"
          />
          <span class="ir-unit">{{ unit }}</span>
        </span>
      </label>

      <label class="ir-field">
        <span class="ir-label">Format</span>
        <select class="ir-input" v-model="format" aria-label="Format">
          <option v-for="option in OUTPUT_FORMATS" :key="option.choice" :value="option.choice">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="showQuality" class="ir-field">
        <span class="ir-label">Quality {{ Math.round(quality * 100) }}</span>
        <input
          class="ir-range"
          v-model.number="quality"
          type="range"
          min="0.4"
          max="1"
          step="0.05"
          aria-label="Quality"
        />
      </label>
    </div>

    <label class="ir-check">
      <input type="checkbox" v-model="allowEnlarge" />
      Allow enlarging (off: an image smaller than the target is left alone)
    </label>

    <ul v-if="rejected.length" class="ir-rejected">
      <li v-for="note in rejected" :key="note.name">
        <strong>{{ note.name }}</strong> — {{ note.reason }}
      </li>
    </ul>

    <ul v-if="items.length" class="ir-items">
      <li v-for="item in items" :key="item.id" class="ir-item">
        <div class="ir-thumb">
          <img v-if="item.result" :src="item.result.url" :alt="item.file.name" />
        </div>
        <div class="ir-detail">
          <div class="ir-name" :title="item.file.name">{{ item.file.name }}</div>
          <div v-if="item.error" class="ir-error">{{ item.error }}</div>
          <div v-else-if="item.result" class="ir-numbers">
            <span>{{ dimensions(item.source) }} → <b>{{ dimensions(item.result.size) }}</b></span>
            <span class="ir-sep">·</span>
            <span>
              {{ formatBytes(item.file.size) }} → <b>{{ formatBytes(item.result.bytes) }}</b>
              <em class="ir-delta">{{ sizeDelta(item.file.size, item.result.bytes) }}</em>
            </span>
            <span
              v-if="item.source && item.result && isEnlargement(item.source, item.result.size)"
              class="ir-warn"
              >enlarged</span
            >
          </div>
          <div v-else class="ir-numbers">Working…</div>
        </div>
        <div class="ir-actions">
          <button class="ir-btn" :disabled="!item.result || item.busy" @click="save(item)">
            Download
          </button>
          <button class="ir-remove" :aria-label="`Remove ${item.file.name}`" @click="remove(item.id)">
            ×
          </button>
        </div>
      </li>
    </ul>

    <div v-if="items.length" class="ir-toolbar">
      <button class="ir-btn ir-btn-main" :disabled="done.length === 0" @click="saveAll">
        Download {{ done.length > 1 ? `all ${done.length}` : 'it' }}
      </button>
      <button class="ir-btn" @click="clearAll">Clear</button>
      <span v-if="done.length" class="ir-totals">
        {{ formatBytes(totals.before) }} → {{ formatBytes(totals.after) }}
        <em class="ir-delta">{{ totals.delta }}</em>
      </span>
    </div>

    <p class="ir-hint">
      Everything happens in this browser — no image is uploaded anywhere. Large reductions are done
      in repeated halvings rather than one pass, which keeps fine detail from breaking up. Note that
      re-encoding drops EXIF data, including the camera settings and any location the photo carried.
    </p>
  </div>
</template>

<style scoped>
.ir-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.ir-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 28px 16px;
  border: 2px dashed var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  text-align: center;
}

.ir-drop:hover,
.ir-drop-over {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}

.ir-drop-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.ir-file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.ir-settings {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
}

.ir-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.ir-field-narrow {
  max-width: 140px;
}

.ir-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ir-input {
  padding: 7px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
  font-size: 15px;
}

.ir-input:focus {
  border-color: var(--vp-c-brand-1);
}

.ir-amount {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ir-amount .ir-input {
  width: 90px;
  font-variant-numeric: tabular-nums;
}

.ir-unit {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.ir-range {
  width: 150px;
}

.ir-check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.ir-rejected {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.ir-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ir-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
}

.ir-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.ir-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.ir-detail {
  flex: 1;
  min-width: 0;
}

.ir-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ir-numbers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.ir-sep {
  opacity: 0.5;
}

.ir-delta {
  margin-left: 4px;
  font-style: normal;
  color: var(--vp-c-brand-1);
}

.ir-warn,
.ir-error {
  font-size: 12px;
  color: var(--vp-c-danger-1, #d64545);
}

.ir-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ir-btn {
  padding: 6px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.ir-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.ir-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ir-btn-main {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.ir-remove {
  padding: 2px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}

.ir-remove:hover {
  color: var(--vp-c-danger-1, #d64545);
}

.ir-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ir-totals {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.ir-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
