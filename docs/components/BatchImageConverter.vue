<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { IMAGE_FORMATS, convertBatch, numberedName, planConversion, validStart, type ImageDirectory, type ImageFormat } from '../lib/batch-image-convert'

type DirectoryPicker = (options: { id: string; mode: 'read' | 'readwrite' }) => Promise<ImageDirectory>
const supported = ref(false)
const source = shallowRef<ImageDirectory>()
const destination = shallowRef<ImageDirectory>()
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
onMounted(() => { supported.value = window.isSecureContext && !!navigator.locks && typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function' })
onBeforeUnmount(() => { cancelled.value = true })

async function pick(target: 'source' | 'destination') {
  error.value = ''
  status.value = ''
  try {
    const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker }).showDirectoryPicker
    const directory = await picker.call(window, { id: target, mode: target === 'source' ? 'read' : 'readwrite' })
    if (target === 'source') source.value = directory
    else destination.value = directory
  } catch (cause) {
    if (!(cause instanceof Error && cause.name === 'AbortError')) error.value = cause instanceof Error ? cause.message : 'フォルダを選択できませんでした。'
  }
}

async function run() {
  const src = source.value
  const dst = destination.value
  if (!src || !dst || busy.value || !validStart(start.value)) return
  busy.value = true
  cancelled.value = false
  saved.value = 0
  total.value = 0
  error.value = ''
  status.value = '対象ファイルと保存先を確認中…'
  try {
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
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '変換・保存に失敗しました。'
    status.value = '処理を停止しました。保存済みのファイルは残ります。'
  } finally { busy.value = false }
}
</script>

<template>
  <div class="batch-converter">
    <p>src 配下の画像をサブフォルダも含めて変換し、dst 直下に 001.jpg、002.jpg のような連番で保存します。画像はアップロードされず、このブラウザ内で処理されます。</p>
    <p v-if="!supported" role="status">フォルダへの直接保存に対応したデスクトップ版 Chrome または Edge を HTTPS で開いてください。</p>
    <fieldset :disabled="busy || !supported">
      <legend>変換設定</legend>
      <div class="folders">
        <div><button type="button" @click="pick('source')">src フォルダを選択</button> <span>{{ source?.name ?? '未選択' }}</span></div>
        <div><button type="button" @click="pick('destination')">dst フォルダを選択</button> <span>{{ destination?.name ?? '未選択' }}</span></div>
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
    <p class="hint">相対パスを数字の順も考慮して並べ、連番を付けます（例: 2.png → 10.png）。既存ファイルは上書きしません。dst は src の外に指定してください。JPEG の透明部分は白色になります。変換中は他のアプリから保存先を変更しないでください。画像サイズはそのままで、EXIF などのメタデータは削除されます。</p>
    <div class="actions">
      <button type="button" :disabled="!supported || !source || !destination || !validStart(start) || busy" @click="run">変換して保存</button>
      <button v-if="busy" type="button" :disabled="cancelled" @click="cancelled = true">中止</button>
    </div>
    <div role="status" aria-live="polite"><p>{{ status }}</p><p v-if="total">保存済み {{ saved }} / {{ total }} 枚</p></div>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.batch-converter { margin-top: 16px; }
fieldset { border: 1px solid var(--vp-c-border); border-radius: 8px; padding: 16px; min-width: 0; }
legend { padding: 0 6px; font-weight: 600; }
.folders { display: grid; gap: 12px; overflow-wrap: anywhere; }
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
