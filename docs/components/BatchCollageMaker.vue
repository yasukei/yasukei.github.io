<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  collageSources, planCollages, validateBatchCollage,
  type BatchCollageOptions, type CollageJob
} from '../lib/batch-collage'
import { renderBatchCollage } from '../lib/batch-collage-canvas'
import { imagesToZip } from '../lib/batch-image-zip'
import { formatBytes, type Size } from '../lib/image-resize'

const files = shallowRef<File[]>([])
const folderSupported = ref(false)
const rows = ref('2')
const columns = ref('2')
const count = ref('1')
const width = ref('')
const height = ref('')
const watermarkEnabled = ref(false)
const watermark = ref('Sample')
const busy = ref(false)
const cancelled = ref(false)
const completed = ref(0)
const status = ref('')
const error = ref('')
const zip = ref<{ url: string; bytes: number } | null>(null)
const preview = ref<{ url: string; size: Size } | null>(null)
const jobs = shallowRef<CollageJob[]>([])

const sources = computed(() => collageSources(files.value))
const options = computed<BatchCollageOptions>(() => ({
  rows: Number(rows.value), columns: Number(columns.value), count: Number(count.value),
  width: width.value.trim() === '' ? undefined : Number(width.value),
  height: height.value.trim() === '' ? undefined : Number(height.value),
  watermark: watermarkEnabled.value ? watermark.value : undefined
}))
const validation = computed(() => {
  try {
    const needed = validateBatchCollage(options.value)
    return { needed, message: sources.value.length < needed
      ? `画像が不足しています。必要: ${needed} 枚、選択済み: ${sources.value.length} 枚。` : '' }
  } catch (cause) {
    return { needed: null, message: cause instanceof Error ? cause.message : '設定を確認してください。' }
  }
})

onMounted(() => { folderSupported.value = 'webkitdirectory' in document.createElement('input') })
onBeforeUnmount(() => { cancelled.value = true; discardResults() })
watch([files, options], () => {
  discardResults()
  completed.value = 0
  status.value = error.value = ''
})

function discardResults() {
  if (zip.value) URL.revokeObjectURL(zip.value.url)
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  zip.value = preview.value = null
  jobs.value = []
}

function pick(event: Event) {
  const input = event.target as HTMLInputElement
  files.value = [...(input.files ?? [])]
  input.value = ''
}

async function run() {
  if (busy.value || validation.value.message) return
  discardResults()
  completed.value = 0
  status.value = 'コラージュを生成中…'
  error.value = ''
  busy.value = true
  cancelled.value = false
  const settings = { ...options.value }
  try {
    const plan = planCollages(files.value, settings)
    const blob = await imagesToZip(plan, {
      cancelled: () => cancelled.value,
      converted: () => { completed.value++ }
    }, async job => {
      const rendered = await renderBatchCollage(job.files, settings, () => cancelled.value)
      if (!cancelled.value && !preview.value) {
        preview.value = { url: URL.createObjectURL(rendered.blob), size: rendered.size }
      }
      return rendered.blob
    })
    if (blob && !cancelled.value) {
      zip.value = { url: URL.createObjectURL(blob), bytes: blob.size }
      jobs.value = plan
      status.value = '生成が完了しました。ZIP をダウンロードして保存してください。'
    } else {
      discardResults()
      status.value = '中止しました。ZIP は作成されていません。'
    }
  } catch (cause) {
    discardResults()
    status.value = cancelled.value ? '中止しました。ZIP は作成されていません。' : '生成を停止しました。'
    if (!cancelled.value) error.value = cause instanceof Error ? cause.message : 'コラージュを生成できませんでした。'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="batch-collage">
    <p>JPG / JPEG からランダムに画像を選び、指定した行数 × 列数のコラージュを一括生成します。画像はアップロードされず、このブラウザ内で処理されます。</p>
    <fieldset :disabled="busy">
      <legend>画像と生成設定</legend>
      <div class="sources">
        <label>画像をまとめて選択
          <input type="file" multiple accept=".jpg,.jpeg" @change="pick" />
        </label>
        <label v-if="folderSupported">フォルダを選択
          <input type="file" webkitdirectory multiple @change="pick" />
        </label>
      </div>
      <p class="hint">選択し直すと入力画像を入れ替えます。フォルダは直下の JPG / JPEG だけが対象です。サブフォルダ内の画像は含めません。</p>
      <p role="status">対象画像: {{ sources.length }} 枚<span v-if="files.length > sources.length">（対象外: {{ files.length - sources.length }} ファイル）</span></p>
      <div class="settings">
        <label>行数<input v-model="rows" type="text" inputmode="numeric" /></label>
        <label>列数<input v-model="columns" type="text" inputmode="numeric" /></label>
        <label>生成枚数<input v-model="count" type="text" inputmode="numeric" /></label>
        <label>幅（px・省略可）<input v-model="width" type="text" inputmode="numeric" placeholder="自動" /></label>
        <label>高さ（px・省略可）<input v-model="height" type="text" inputmode="numeric" placeholder="自動" /></label>
      </div>
      <p class="hint">幅・高さを省略すると、コラージュごとに元画像の平均寸法から計算します。片方だけ指定すると、その比率に合わせてもう片方を計算します。</p>
      <label class="checkbox"><input v-model="watermarkEnabled" type="checkbox" />透かしを入れる</label>
      <label v-if="watermarkEnabled" class="watermark">透かしの文字<input v-model="watermark" type="text" /></label>
      <p v-if="validation.needed !== null">必要な画像: {{ validation.needed }} 枚（{{ count }} 枚 × {{ rows }} 行 × {{ columns }} 列）</p>
      <p v-if="validation.message" class="error">{{ validation.message }}</p>
    </fieldset>
    <p class="hint">同じ画像は一度の生成全体で 1 回だけ使用し、各コラージュ内ではファイル名の昇順で左上から横方向に並べます。画像は縦横比を変えて各枠いっぱいに配置し、間隔・余白は設けません。</p>
    <p class="hint">透かしは半透明の白文字を 45 度傾けて繰り返します。JPEG を collage-001.jpg からの連番で ZIP にまとめます。ZIP は最大 256 MiB、画像は 1 枚あたり最大 16,777,216 画素・一辺 16,384 px です。</p>
    <div class="actions">
      <button type="button" :disabled="busy || !!validation.message" @click="run">{{ zip ? '再抽選して生成' : '生成して ZIP を作成' }}</button>
      <button v-if="busy" type="button" :disabled="cancelled" @click="cancelled = true">中止</button>
      <a v-if="zip" :href="zip.url" download="collages.zip">ZIP をダウンロード（{{ formatBytes(zip.bytes) }}）</a>
    </div>
    <div role="status" aria-live="polite">
      <p>{{ status }}</p>
      <p v-if="busy || completed">生成済み: {{ completed }} / {{ count }} 枚</p>
    </div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <figure v-if="preview">
      <img :src="preview.url" alt="最初のコラージュのプレビュー" />
      <figcaption>collage-001.jpg · {{ preview.size.width }} × {{ preview.size.height }} px</figcaption>
    </figure>
    <details v-if="jobs.length">
      <summary>生成画像と使用ファイル</summary>
      <ul>
        <li v-for="job in jobs" :key="job.output"><strong>{{ job.output }}</strong>: {{ job.files.map(file => file.name).join(', ') }}</li>
      </ul>
    </details>
  </div>
</template>

<style scoped>
.batch-collage { margin-top: 16px; }
fieldset { border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 16px; min-width: 0; }
legend { padding: 0 6px; font-weight: 600; }
.sources, .settings, .actions { display: flex; flex-wrap: wrap; gap: 16px; }
.settings, .actions { margin-top: 16px; }
label { display: flex; flex-direction: column; gap: 6px; }
.checkbox { flex-direction: row; align-items: center; }
.watermark { margin-top: 12px; }
button, input[type='text'] { border: 1px solid var(--vp-c-border); border-radius: 6px; padding: 6px 12px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.settings input { width: 140px; max-width: 100%; }
.watermark input { width: 320px; max-width: 100%; }
.sources input { max-width: 100%; }
button { cursor: pointer; }
button:hover:enabled { border-color: var(--vp-c-brand-1); }
button:disabled, fieldset:disabled { opacity: 0.6; }
.error { color: var(--vp-c-danger-1); }
.hint, figcaption { font-size: 13px; color: var(--vp-c-text-2); }
figure { margin: 16px 0; }
figure img { max-width: 100%; max-height: 600px; border: 1px solid var(--vp-c-border); }
details { overflow-wrap: anywhere; }
</style>
