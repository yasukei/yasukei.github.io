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
  type ExactSpec,
  type OutputChoice,
  type Rejection,
  type ResizeMode,
  type ResizeSpec,
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
  { value: 'longest-edge', label: '長辺', unit: 'px' },
  { value: 'width', label: '幅', unit: 'px' },
  { value: 'height', label: '高さ', unit: 'px' },
  { value: 'percent', label: 'パーセント', unit: '%' }
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
// Off only for the occasional stretch to an exact size, e.g. 16:9 into a square.
const keepAspect = ref(true)
const exact = reactive({ width: '100', height: '100' })
const format = ref<OutputChoice>('source')
const quality = ref(0.85)
const allowEnlarge = ref(false)

const unit = computed(() => MODES.find((m) => m.value === mode.value)?.unit ?? 'px')
const amount = computed(() => Number(values[mode.value]))
const spec = computed<ResizeSpec | ExactSpec>(() =>
  keepAspect.value
    ? { mode: mode.value, value: amount.value }
    : { mode: 'exact', width: Number(exact.width), height: Number(exact.height) }
)
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
        item.error = 'リサイズ後のサイズを入力してください。'
        continue
      }

      const plan = stepPlan(item.source, target)
      if (plan.length > 0 && exceedsCanvasLimit(plan[0])) {
        item.error = 'この画像はブラウザで描き直すには大きすぎます。'
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
      item.error = error instanceof Error ? error.message : 'この画像をリサイズできませんでした。'
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

watch([keepAspect, mode, values, exact, format, quality, allowEnlarge], () => {
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
        aria-label="画像を選択"
      />
      <strong>ここに画像をドロップ</strong>
      <span class="ir-drop-note">またはクリックして選択（一度に {{ MAX_FILES }} 枚まで）</span>
    </label>

    <div class="ir-settings">
      <template v-if="keepAspect">
        <label class="ir-field">
          <span class="ir-label">リサイズの基準</span>
          <select class="ir-input" v-model="mode" aria-label="リサイズの基準">
            <option v-for="option in MODES" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>

        <label class="ir-field ir-field-narrow">
          <span class="ir-label">サイズ</span>
          <span class="ir-amount">
            <input
              class="ir-input"
              v-model="values[mode]"
              type="text"
              inputmode="numeric"
              spellcheck="false"
              aria-label="サイズ"
            />
            <span class="ir-unit">{{ unit }}</span>
          </span>
        </label>
      </template>

      <template v-else>
        <label class="ir-field ir-field-narrow">
          <span class="ir-label">幅</span>
          <span class="ir-amount">
            <input
              class="ir-input"
              v-model="exact.width"
              type="text"
              inputmode="numeric"
              spellcheck="false"
              aria-label="幅"
            />
            <span class="ir-unit">px</span>
          </span>
        </label>

        <label class="ir-field ir-field-narrow">
          <span class="ir-label">高さ</span>
          <span class="ir-amount">
            <input
              class="ir-input"
              v-model="exact.height"
              type="text"
              inputmode="numeric"
              spellcheck="false"
              aria-label="高さ"
            />
            <span class="ir-unit">px</span>
          </span>
        </label>
      </template>

      <label class="ir-field">
        <span class="ir-label">形式</span>
        <select class="ir-input" v-model="format" aria-label="形式">
          <option v-for="option in OUTPUT_FORMATS" :key="option.choice" :value="option.choice">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="showQuality" class="ir-field">
        <span class="ir-label">画質 {{ Math.round(quality * 100) }}</span>
        <input
          class="ir-range"
          v-model.number="quality"
          type="range"
          min="0.4"
          max="1"
          step="0.05"
          aria-label="画質"
        />
      </label>
    </div>

    <label class="ir-check">
      <input type="checkbox" v-model="keepAspect" aria-label="縦横比を保つ" />
      縦横比を保つ（オフ：幅と高さを直接指定し、画像を引き伸ばして合わせます）
    </label>

    <label class="ir-check">
      <input type="checkbox" v-model="allowEnlarge" aria-label="拡大を許可" />
      拡大を許可（オフ：指定より小さい画像はそのままにします）
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
              >拡大</span
            >
          </div>
          <div v-else class="ir-numbers">処理中…</div>
        </div>
        <div class="ir-actions">
          <button class="ir-btn" :disabled="!item.result || item.busy" @click="save(item)">
            ダウンロード
          </button>
          <button class="ir-remove" :aria-label="`${item.file.name} を削除`" @click="remove(item.id)">
            ×
          </button>
        </div>
      </li>
    </ul>

    <div v-if="items.length" class="ir-toolbar">
      <button class="ir-btn ir-btn-main" :disabled="done.length === 0" @click="saveAll">
        {{ done.length > 1 ? `${done.length} 枚すべてダウンロード` : '画像をダウンロード' }}
      </button>
      <button class="ir-btn" @click="clearAll">クリア</button>
      <span v-if="done.length" class="ir-totals">
        {{ formatBytes(totals.before) }} → {{ formatBytes(totals.after) }}
        <em class="ir-delta">{{ totals.delta }}</em>
      </span>
    </div>

    <p class="ir-hint">
      処理はすべてこのブラウザ内で行われ、画像がどこかにアップロードされることはありません。大きく縮小するときは
      一度に縮めず半分ずつ段階的に縮小するので、細部が崩れにくくなります。なお、再エンコードによって
      EXIF 情報（カメラの設定や写真に含まれる位置情報など）は削除されます。
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
