<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { heightFor, parseRatio, widthFor } from '../lib/aspect-ratio'
import {
  acceptFiles,
  exceedsCanvasLimit,
  formatBytes,
  outputMime,
  outputName,
  qualityApplies,
  stepPlan,
  type OutputChoice,
  type Rejection,
  type Size
} from '../lib/image-resize'
import {
  MAX_COLLAGE_FILES,
  containBox,
  coverCrop,
  layout,
  type FillMode,
  type HeroPosition,
  type Rect
} from '../lib/collage-layout'
import { createCanvas, decode, release, renderPlan, toBlob } from '../lib/canvas-resize'
import StepField from './StepField.vue'

type Fit = 'cover' | 'contain'

interface Item {
  id: number
  file: File
  /** The source, already reduced to the largest size this canvas can use. */
  prepared: HTMLCanvasElement | null
  /** Long edge the preparation was made for, so it is redone only when that changes. */
  preparedFor: number
  error: string | null
}

const RATIOS = ['16:9', '3:2', '4:3', '1:1', '4:5', '9:16']
const LAYOUTS: { value: FillMode; label: string }[] = [
  { value: 'grid', label: 'Grid — even' },
  { value: 'mosaic', label: 'Mosaic — mixed sizes' },
  { value: 'random', label: 'Random' }
]
const HERO_POSITIONS: { value: HeroPosition; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'none', label: 'No hero' }
]
const BACKGROUNDS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'White' },
  { value: '#000000', label: 'Black' },
  { value: 'transparent', label: 'Transparent' }
]
const FITS: { value: Fit; label: string }[] = [
  { value: 'cover', label: 'Cover — fill, crop the rest' },
  { value: 'contain', label: 'Contain — show all of it' }
]
const FORMATS: { choice: OutputChoice; label: string }[] = [
  { choice: 'image/png', label: 'PNG' },
  { choice: 'image/webp', label: 'WebP' },
  { choice: 'image/jpeg', label: 'JPEG' }
]

const REDRAW_DELAY = 250

const items = ref<Item[]>([])
const rejected = ref<Rejection[]>([])
const dragging = ref(false)
const busy = ref(false)
const failure = ref<string | null>(null)
const result = ref<{ url: string; bytes: number; size: Size } | null>(null)

const ratio = ref('16:9')
const longEdge = ref('1920')
const mode = ref<FillMode>('mosaic')
const heroPosition = ref<HeroPosition>('left')
const heroId = ref<number | null>(null)
const gap = ref(12)
const padding = ref(12)
// The hero is the picture being shown, so its own shape is worth keeping;
// the cells around it are filling a space, and a crop is the price of that.
const heroFit = ref<Fit>('contain')
const cellFit = ref<Fit>('cover')
const background = ref('#ffffff')
const format = ref<OutputChoice>('image/png')
const seed = ref(1)

// Percentages rather than fractions: whole units are what the arrows on a
// StepField step by, and what its box can show without rounding.
const heroPercent = ref(50)
const qualityPercent = ref(90)

/** The output canvas: the chosen ratio, scaled so its longer side is `longEdge`. */
const canvasSize = computed<Size | null>(() => {
  const shape = parseRatio(ratio.value)
  const edge = Number(longEdge.value)
  if (!shape || !Number.isFinite(edge) || edge < 16) return null

  const landscape = shape.width >= shape.height
  const width = landscape ? edge : (widthFor(edge, shape) ?? edge)
  const height = landscape ? (heightFor(edge, shape) ?? edge) : edge
  return { width: Math.round(width), height: Math.round(height) }
})

const mime = computed(() => outputMime('image/png', format.value))
const quality = computed(() => qualityPercent.value / 100)
const showQuality = computed(() => qualityApplies(mime.value))
const canShuffle = computed(() => mode.value !== 'grid')
const heroItem = computed(() => items.value.find((item) => item.id === heroId.value) ?? null)

let nextId = 1
let currentRun = 0
let redrawTimer: ReturnType<typeof setTimeout> | null = null

function discardResult() {
  if (result.value) URL.revokeObjectURL(result.value.url)
  result.value = null
}

async function addFiles(incoming: File[]) {
  const outcome = acceptFiles(
    items.value.map((item) => item.file),
    incoming,
    MAX_COLLAGE_FILES
  )
  rejected.value = outcome.rejected

  for (const file of outcome.accepted) {
    items.value.push({ id: nextId++, file, prepared: null, preparedFor: 0, error: null })
  }
  if (heroId.value === null && items.value.length > 0) heroId.value = items.value[0].id
  if (outcome.accepted.length > 0) await draw()
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles([...(input.files ?? [])])
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  addFiles([...(event.dataTransfer?.files ?? [])])
}

function remove(id: number) {
  items.value = items.value.filter((item) => item.id !== id)
  if (heroId.value === id) heroId.value = items.value[0]?.id ?? null
  rejected.value = []
  if (items.value.length === 0) {
    discardResult()
    return
  }
  void draw()
}

function clearAll() {
  items.value = []
  heroId.value = null
  rejected.value = []
  discardResult()
}

function shuffle() {
  seed.value = Math.floor(Math.random() * 1_000_000)
}

function chooseHero(id: number) {
  if (heroId.value === id) return
  heroId.value = id
  void draw()
}

/**
 * Reduces a source once to the largest size this canvas could ask of it, and
 * keeps that.
 *
 * Unlike the resizer, what is held is already small -- a prepared copy is at
 * most the canvas itself, not the original 12 megapixels -- and a collage is
 * redrawn constantly as sliders move, so re-decoding every image on every
 * redraw would make the whole thing feel broken.
 */
async function prepare(item: Item, cap: number): Promise<void> {
  if (item.prepared && item.preparedFor === cap) return

  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await decode(item.file)
    const source = { width: bitmap.width, height: bitmap.height }
    const scale = Math.min(1, cap / Math.max(source.width, source.height))
    const target = {
      width: Math.max(1, Math.round(source.width * scale)),
      height: Math.max(1, Math.round(source.height * scale))
    }
    item.prepared = renderPlan(bitmap, stepPlan(source, target))
    item.preparedFor = cap
    item.error = null
  } catch (error) {
    item.prepared = null
    item.error = error instanceof Error ? error.message : 'This image could not be read.'
  } finally {
    release(bitmap)
  }
}

/** Whole pixels, and never a side of nothing. */
function snap(rect: Rect): Rect {
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)
  return {
    x,
    y,
    width: Math.max(1, Math.round(rect.x + rect.width) - x),
    height: Math.max(1, Math.round(rect.y + rect.height) - y)
  }
}

function place(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  cell: Rect,
  how: Fit
) {
  const size = { width: source.width, height: source.height }

  if (how === 'cover') {
    const crop = coverCrop(size, cell)
    const drawn = renderPlan(source, stepPlan(crop, cell), crop)
    ctx.drawImage(drawn, cell.x, cell.y, cell.width, cell.height)
    return
  }

  const box = snap(containBox(size, cell))
  const drawn = renderPlan(source, stepPlan(size, box))
  ctx.drawImage(drawn, box.x, box.y, box.width, box.height)
}

async function draw() {
  const runId = ++currentRun
  const canvas = canvasSize.value

  if (items.value.length === 0 || canvas === null) {
    discardResult()
    return
  }
  if (exceedsCanvasLimit(canvas)) {
    failure.value = 'That canvas is too large for the browser to draw.'
    return
  }

  busy.value = true
  failure.value = null
  try {
    const cap = Math.max(canvas.width, canvas.height)
    for (const item of items.value) await prepare(item, cap)
    if (runId !== currentRun) return

    const usable = items.value.filter((item) => item.prepared !== null)
    if (usable.length === 0) {
      failure.value = 'None of these images could be read.'
      discardResult()
      return
    }

    const hero = heroItem.value?.prepared ? heroItem.value : usable[0]
    const rest = usable.filter((item) => item !== hero)
    const plan = layout({
      canvas,
      count: usable.length,
      mode: mode.value,
      hero: heroPosition.value,
      heroFraction: heroPercent.value / 100,
      gap: gap.value,
      padding: padding.value,
      seed: seed.value
    })

    const output = createCanvas(canvas)
    const ctx = output.getContext('2d')
    if (!ctx) throw new Error('This browser would not give us a 2D canvas to draw on.')

    // JPEG has no transparency: without this the gaps come out black.
    if (background.value !== 'transparent' || mime.value === 'image/jpeg') {
      ctx.fillStyle = background.value === 'transparent' ? '#ffffff' : background.value
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const ordered = plan.hero ? [hero, ...rest] : usable
    const rects = plan.hero ? [plan.hero, ...plan.cells] : plan.cells
    for (let i = 0; i < rects.length && i < ordered.length; i++) {
      // Only the first rectangle is the hero, and only when there is one.
      const how = plan.hero && i === 0 ? heroFit.value : cellFit.value
      place(ctx, ordered[i].prepared as HTMLCanvasElement, snap(rects[i]), how)
    }

    const blob = await toBlob(output, mime.value, showQuality.value ? quality.value : undefined)
    if (runId !== currentRun) return

    discardResult()
    result.value = { url: URL.createObjectURL(blob), bytes: blob.size, size: canvas }
  } catch (error) {
    failure.value = error instanceof Error ? error.message : 'The collage could not be drawn.'
  } finally {
    if (runId === currentRun) busy.value = false
  }
}

function scheduleDraw() {
  if (redrawTimer) clearTimeout(redrawTimer)
  redrawTimer = setTimeout(() => {
    redrawTimer = null
    void draw()
  }, REDRAW_DELAY)
}

watch(
  [
    ratio,
    longEdge,
    mode,
    heroPosition,
    heroPercent,
    gap,
    padding,
    heroFit,
    cellFit,
    background,
    format,
    qualityPercent,
    seed
  ],
  () => {
    if (items.value.length > 0) scheduleDraw()
  }
)

function save() {
  if (!result.value) return
  const link = document.createElement('a')
  link.href = result.value.url
  link.download = outputName('collage', result.value.size, mime.value)
  link.click()
}

onBeforeUnmount(() => {
  if (redrawTimer) clearTimeout(redrawTimer)
  discardResult()
})
</script>

<template>
  <div class="cm-root">
    <label
      class="cm-drop"
      :class="{ 'cm-drop-over': dragging }"
      @dragover.prevent="dragging = true"
      @dragenter.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        class="cm-file"
        type="file"
        accept="image/*"
        multiple
        @change="onPick"
        aria-label="Choose images"
      />
      <strong>Drop images here</strong>
      <span class="cm-drop-note">
        or click to choose — up to {{ MAX_COLLAGE_FILES }}. The first one is the hero; click any
        thumbnail to promote it.
      </span>
    </label>

    <ul v-if="rejected.length" class="cm-rejected">
      <li v-for="note in rejected" :key="note.name">
        <strong>{{ note.name }}</strong> — {{ note.reason }}
      </li>
    </ul>

    <ul v-if="items.length" class="cm-strip">
      <li
        v-for="item in items"
        :key="item.id"
        class="cm-chip"
        :class="{ 'cm-chip-hero': item.id === heroId && heroPosition !== 'none' }"
      >
        <button class="cm-chip-name" :title="item.file.name" @click="chooseHero(item.id)">
          <span v-if="item.id === heroId && heroPosition !== 'none'" class="cm-star">★</span>
          {{ item.file.name }}
        </button>
        <button class="cm-chip-x" :aria-label="`Remove ${item.file.name}`" @click="remove(item.id)">
          ×
        </button>
      </li>
    </ul>

    <div class="cm-settings">
      <label class="cm-field">
        <span class="cm-label">Canvas</span>
        <select class="cm-input" v-model="ratio" aria-label="Canvas ratio">
          <option v-for="value in RATIOS" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>

      <label class="cm-field cm-field-narrow">
        <span class="cm-label">Long edge</span>
        <input
          class="cm-input"
          v-model="longEdge"
          type="text"
          inputmode="numeric"
          spellcheck="false"
          aria-label="Long edge"
        />
      </label>

      <label class="cm-field">
        <span class="cm-label">Layout</span>
        <select class="cm-input" v-model="mode" aria-label="Layout">
          <option v-for="option in LAYOUTS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="cm-field">
        <span class="cm-label">Hero</span>
        <select class="cm-input" v-model="heroPosition" aria-label="Hero position">
          <option v-for="option in HERO_POSITIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <StepField
        v-if="heroPosition !== 'none'"
        v-model="heroPercent"
        :min="20"
        :max="80"
        label="Hero size"
        unit="%"
      />

      <label v-if="heroPosition !== 'none'" class="cm-field">
        <span class="cm-label">Hero fit</span>
        <select class="cm-input" v-model="heroFit" aria-label="Hero fit">
          <option v-for="option in FITS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="cm-field">
        <span class="cm-label">{{ heroPosition === 'none' ? 'Fit' : 'Fit — the rest' }}</span>
        <select class="cm-input" v-model="cellFit" aria-label="Fit">
          <option v-for="option in FITS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <StepField v-model="gap" :min="0" :max="60" label="Gap" unit="px" />

      <StepField v-model="padding" :min="0" :max="80" label="Margin" unit="px" />

      <label class="cm-field">
        <span class="cm-label">Background</span>
        <select class="cm-input" v-model="background" aria-label="Background">
          <option v-for="option in BACKGROUNDS" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="cm-field">
        <span class="cm-label">Format</span>
        <select class="cm-input" v-model="format" aria-label="Format">
          <option v-for="option in FORMATS" :key="option.choice" :value="option.choice">
            {{ option.label }}
          </option>
        </select>
      </label>

      <StepField
        v-if="showQuality"
        v-model="qualityPercent"
        :min="40"
        :max="100"
        label="Quality"
      />
    </div>

    <div class="cm-toolbar">
      <button class="cm-btn cm-btn-main" :disabled="!result || busy" @click="save">Download</button>
      <button class="cm-btn" :disabled="!canShuffle || items.length < 3" @click="shuffle">
        Shuffle
      </button>
      <button class="cm-btn" :disabled="items.length === 0" @click="clearAll">Clear</button>
      <span v-if="result" class="cm-totals">
        {{ result.size.width }} × {{ result.size.height }} · {{ formatBytes(result.bytes) }}
      </span>
    </div>

    <p v-if="failure" class="cm-error">{{ failure }}</p>

    <div v-if="result" class="cm-preview" :class="{ 'cm-preview-busy': busy }">
      <img :src="result.url" alt="The collage" />
    </div>
    <p v-else-if="items.length === 0" class="cm-hint">
      Drop two or more images to see a collage here.
    </p>

    <p class="cm-hint">
      Everything is drawn in this browser; nothing is uploaded. Images keep their aspect ratio in
      both fits — Cover crops what will not fit the cell, Contain leaves background around it — and
      the hero can use a different one from the images beside it. Each image is stepped down to its
      cell rather than resampled in one jump.
    </p>
  </div>
</template>

<style scoped>
.cm-root {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.cm-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 24px 16px;
  border: 2px dashed var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  text-align: center;
}

.cm-drop:hover,
.cm-drop-over {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}

.cm-drop-note {
  max-width: 44ch;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.cm-file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.cm-rejected {
  margin: 0;
  padding: 10px 12px 10px 28px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.cm-strip {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
}

.cm-chip {
  display: flex;
  align-items: center;
  max-width: 220px;
  border: 1px solid var(--vp-c-border);
  border-radius: 999px;
  background: var(--vp-c-bg-soft);
}

.cm-chip-hero {
  border-color: var(--vp-c-brand-1);
}

.cm-chip-name {
  flex: 1;
  min-width: 0;
  padding: 3px 4px 3px 12px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cm-star {
  color: var(--vp-c-brand-1);
}

.cm-chip-x {
  padding: 2px 10px 2px 4px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
}

.cm-chip-x:hover {
  color: var(--vp-c-danger-1, #d64545);
}

.cm-settings {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 14px;
}

.cm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cm-field-narrow {
  max-width: 110px;
}

.cm-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.cm-input {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
  font-size: 14px;
}

.cm-input:focus {
  border-color: var(--vp-c-brand-1);
}

.cm-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cm-btn {
  padding: 6px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.cm-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.cm-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.cm-btn-main {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.cm-totals {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.cm-preview {
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  overflow: hidden;
  line-height: 0;
  transition: opacity 0.15s;
  /* A checkerboard, so a transparent background reads as transparent. */
  background-color: var(--vp-c-bg-soft);
  background-image:
    linear-gradient(45deg, var(--vp-c-bg-mute) 25%, transparent 25%),
    linear-gradient(-45deg, var(--vp-c-bg-mute) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--vp-c-bg-mute) 75%),
    linear-gradient(-45deg, transparent 75%, var(--vp-c-bg-mute) 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.cm-preview-busy {
  opacity: 0.6;
}

.cm-preview img {
  width: 100%;
  height: auto;
}

.cm-error {
  margin: 0;
  font-size: 13px;
  color: var(--vp-c-danger-1, #d64545);
}

.cm-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
