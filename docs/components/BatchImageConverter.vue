<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  IMAGE_FORMATS, convertBatch, numberedName, planConversion, planFileConversion, validStart,
  type ImageDirectory, type ImageFormat
} from '../lib/batch-image-convert'
import { convertToZip } from '../lib/batch-image-zip'

type DirectoryPicker = (options: { id: string; mode: 'read' | 'readwrite' }) => Promise<ImageDirectory>
const supported = ref(false)
const folderInputSupported = ref(true)
const mode = ref<'folder' | 'zip'>('zip')
const source = shallowRef<ImageDirectory>()
const destination = shallowRef<ImageDirectory>()
const files = shallowRef<File[]>([])
const zipUrl = ref('')
const input = ref<ImageFormat>('png')
const output = ref<ImageFormat>('jpg')
const start = ref('1')
const quality = ref(0.9)
const busy = ref(false)
const status = ref('')
const error = ref('')
const total = ref(0)
const saved = ref(0)
const cancelled = ref(false)
const example = computed(() => validStart(start.value) ? numberedName(Number(start.value), output.value) : '—')
const sourceName = computed(() => files.value[0]?.webkitRelativePath?.split('/')[0] || `${files.value.length} 枚の画像`)
const canRun = computed(() => validStart(start.value) && !busy.value && (mode.value === 'zip'
  ? files.value.length > 0
  : supported.value && !!source.value && !!destination.value))

onMounted(() => {
  supported.value = window.isSecureContext && !!navigator.locks && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  folderInputSupported.value = 'webkitdirectory' in document.createElement('input')
  mode.value = supported.value ? 'folder' : 'zip'
})
onBeforeUnmount(() => { cancelled.value = true; clearZip() })
watch([mode, input, output, start, quality, files], resetResults)

function clearZip() {
  if (zipUrl.value) URL.revokeObjectURL(zipUrl.value)
  zipUrl.value = ''
}
function resetResults() {
  clearZip()
  saved.value = total.value = 0
  error.value = status.value = ''
}
function readFolder(event: Event) {
  const element = event.target as HTMLInputElement
  files.value = Array.from(element.files ?? [])
  element.value = ''
}
async function pick(target: 'source' | 'destination') {
  resetResults()
  try {
    const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker
    const directory = await picker.call(window, { id: target, mode: target === 'source' ? 'read' : 'readwrite' })
    if (target === 'source') source.value = directory
    else destination.value = directory
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = cause instanceof Error ? cause.message : 'フォルダを選択できませんでした。'
  }
}
async function runFolder() {
  const src = source.value
  const dst = destination.value
  if (!src || !dst) return
  await navigator.locks.request('batch-image-converter', { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('別のタブで変換中です。完了してから再実行してください。')
    const items = await planConversion(src, dst, input.value, output.value, Number(start.value))
    total.value = items.length
    if (!items.length) { status.value = '対象の画像が見つかりませんでした。'; return }
    status.value = '変換・保存中…'
    await convertBatch(items, dst, output.value, quality.value, {
      cancelled: () => cancelled.value,
      saved: item => { saved.value++; status.value = `${item.path} → ${item.output}` }
    })
    status.value = cancelled.value ? '中止しました。保存済みのファイルは残ります。' : '変換・保存が完了しました。'
  })
}
async function runZip() {
  const items = planFileConversion(files.value, input.value, output.value, Number(start.value))
  total.value = items.length
  if (!items.length) { status.value = '対象の画像が見つかりませんでした。'; return }
  status.value = '変換・ZIP 作成中…'
  const zip = await convertToZip(items, output.value, quality.value, {
    cancelled: () => cancelled.value,
    converted: item => { saved.value++; status.value = `${item.path} → ${item.output}` }
  })
  if (zip && !cancelled.value) {
    zipUrl.value = URL.createObjectURL(zip)
    status.value = 'ZIP を作成しました。ダウンロードボタンから保存してください。'
  } else status.value = '中止しました。ZIP は作成されていません。'
}
async function run() {
  if (!canRun.value) return
  resetResults()
  busy.value = true
  cancelled.value = false
  status.value = '対象ファイルを確認中…'
  try {
    if (mode.value === 'folder') await runFolder()
    else await runZip()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '変換・保存に失敗しました。'
    status.value = mode.value === 'folder'
      ? '処理を停止しました。保存済みのファイルは残ります。'
      : '処理を停止しました。ZIP は作成されていません。'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="batch-converter">
    <p>src 配下の画像をサブフォルダも含めて変換し、001.jpg、002.jpg のような連番で保存します。画像はアップロードされず、このブラウザ内で処理されます。</p>
    <p v-if="!supported" role="status">このブラウザでは、フォルダを読み込んで ZIP でダウンロードできます。ZIP を展開して、保存したいフォルダへ移動してください。</p>
    <fieldset :disabled="busy">
      <legend>変換設定</legend>
      <label>保存方法
        <select v-model="mode">
          <option value="folder" :disabled="!supported">dst フォルダに直接保存（Chrome / Edge）</option>
          <option value="zip">ZIP でダウンロード</option>
        </select>
      </label>
      <div v-if="mode === 'folder'" class="folders">
        <div><button type="button" @click="pick('source')">src フォルダを選択</button> <span>{{ source?.name ?? '未選択' }}</span></div>
        <div><button type="button" @click="pick('destination')">dst フォルダを選択</button> <span>{{ destination?.name ?? '未選択' }}</span></div>
      </div>
      <div v-else class="folders">
        <label>{{ folderInputSupported ? 'src フォルダを読み込む' : '画像をまとめて選択' }}
          <input type="file" :webkitdirectory="folderInputSupported ? '' : undefined" multiple accept=".png,.jpg,.jpeg,.webp" @change="readFolder" />
        </label>
        <span v-if="files.length">{{ sourceName }}（{{ files.length }} ファイル読み込み済み）</span>
      </div>
      <div class="settings">
        <label>入力形式<select v-model="input"><option v-for="f in IMAGE_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option></select></label>
        <label>出力形式<select v-model="output"><option v-for="f in IMAGE_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option></select></label>
        <label>開始番号<input v-model="start" type="text" inputmode="numeric" :aria-invalid="!validStart(start)" /></label>
        <label v-if="output !== 'png'">画質 {{ Math.round(quality * 100) }}%<input v-model.number="quality" type="range" min="0.1" max="1" step="0.01" /></label>
      </div>
      <p v-if="!validStart(start)" class="error">開始番号には 0 以上の安全な整数を指定してください。</p>
      <p>保存名の例: {{ example }}（最低3桁・1000以降は桁数を増やします）</p>
    </fieldset>
    <p v-if="mode === 'folder'" class="hint">既存ファイルは上書きしません。dst は src の外に指定してください。変換中は他のアプリから保存先を変更しないでください。</p>
    <p v-else class="hint">ZIP 内には連番の画像を直下にまとめます。メモリ使用量を抑えるため、ZIP は 256 MiB・65,535 枚までです。大きいフォルダは分けて変換してください。</p>
    <p class="hint">相対パスを数字の順も考慮して並べ、連番を付けます（例: 2.png → 10.png）。JPEG の透明部分は白色になります。画像サイズはそのままで、EXIF などのメタデータは削除されます。</p>
    <div class="actions">
      <button type="button" :disabled="!canRun" @click="run">{{ mode === 'folder' ? '変換して保存' : '変換して ZIP を作成' }}</button>
      <button v-if="busy" type="button" :disabled="cancelled" @click="cancelled = true">中止</button>
      <a v-if="zipUrl" :href="zipUrl" download="converted-images.zip">ZIP をダウンロード</a>
    </div>
    <div role="status" aria-live="polite"><p>{{ status }}</p><p v-if="total">{{ mode === 'folder' ? '保存済み' : '変換済み' }} {{ saved }} / {{ total }} 枚</p></div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.batch-converter { margin-top: 16px; }
fieldset { border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 16px; min-width: 0; }
legend { padding: 0 6px; font-weight: 600; }
.folders { display: grid; gap: 12px; margin-top: 16px; overflow-wrap: anywhere; }
.settings, .actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; }
label { display: flex; flex-direction: column; gap: 6px; }
button, select, input[type='text'] { border: 1px solid var(--vp-c-border); border-radius: 6px; padding: 6px 12px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
input[type='text'] { width: 160px; }
button { cursor: pointer; }
button:hover:enabled { border-color: var(--vp-c-brand-1); }
button:disabled, fieldset:disabled { opacity: 0.6; }
.error { color: var(--vp-c-danger-1); }
.hint { font-size: 13px; color: var(--vp-c-text-2); }
</style>
