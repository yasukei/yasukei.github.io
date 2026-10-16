<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { EncryptedPDFError, PDFDocument } from 'pdf-lib'
import { exportPdf, MAX_PDF_BYTES, MAX_PDF_PAGES, parsePageSelection, splitPdf, type PdfPageRef } from '../lib/pdf-editor'
import type { openPdfPreview } from '../lib/pdf-preview'

interface Page extends PdfPageRef {
  id: number
  filename: string
  selected: boolean
  thumbnail: string | null
}

const pages = ref<Page[]>([])
const sources = new Map<number, PDFDocument>()
const sourceSizes = new Map<number, number>()
const totalBytes = ref(0)
const busy = ref(false)
const ready = ref(false)
const progress = ref('')
const errors = ref<string[]>([])
const notice = ref('')
const range = ref('')
const draggedId = ref<number | null>(null)
const dropTarget = ref<number | null>(null)
const selected = computed(() => pages.value.filter(page => page.selected))
let nextId = 1
let alive = true
let preview: ReturnType<typeof openPdfPreview> | null = null
const downloadUrls = new Map<string, ReturnType<typeof setTimeout>>()

function message(error: unknown): string {
  return error instanceof Error ? error.message : '処理に失敗しました。'
}

async function addFiles(files: File[]) {
  if (!ready.value || busy.value || files.length === 0) return
  busy.value = true
  errors.value = []
  notice.value = ''
  try {
    for (const file of files) {
      if (!alive) break
      if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
        errors.value.push(`${file.name}: PDFファイルを選択してください。`)
        continue
      }
      if (file.size + totalBytes.value > MAX_PDF_BYTES) {
        errors.value.push(`${file.name}: PDFは合計100MBまで追加できます。`)
        continue
      }
      progress.value = `${file.name} を読み込み中…`
      let source: PDFDocument
      let bytes: Uint8Array
      let count: number
      try {
        bytes = new Uint8Array(await file.arrayBuffer())
        source = await PDFDocument.load(bytes)
        // Page trees are checked lazily by pdf-lib, so this can also throw.
        count = source.getPageCount()
      } catch (error) {
        // pdf-lib's ES5 Error subclass loses its prototype in some builds.
        const encrypted = error instanceof EncryptedPDFError ||
          (error instanceof Error && error.message === new EncryptedPDFError().message)
        if (alive) errors.value.push(`${file.name}: ${encrypted ? 'パスワード付きPDFには対応していません。保護を解除したPDFを選択してください。' : 'PDFを読み込めませんでした。破損していないPDFを選択してください。'}`)
        continue
      }
      if (!alive) break
      if (count === 0 || pages.value.length + count > MAX_PDF_PAGES) {
        errors.value.push(`${file.name}: 1〜${MAX_PDF_PAGES}ページ、合計${MAX_PDF_PAGES}ページ以内のPDFを選択してください。`)
        continue
      }
      const sourceId = nextId++
      sources.set(sourceId, source)
      sourceSizes.set(sourceId, file.size)
      totalBytes.value += file.size
      const added: Page[] = Array.from({ length: count }, (_, pageIndex) => ({
        id: nextId++, sourceId, pageIndex, filename: file.name, selected: true, thumbnail: null
      }))
      pages.value.push(...added)
      let failedPreview = false
      try {
        const { openPdfPreview } = await import('../lib/pdf-preview')
        if (!alive) break
        preview = openPdfPreview(bytes)
        for (const page of added) {
          if (!alive) break
          progress.value = `${file.name}: プレビュー ${page.pageIndex + 1} / ${count}`
          try {
            const image = await preview.thumbnail(page.pageIndex)
            // Assign through the reactive array, rather than the original object.
            const target = pages.value.find(item => item.id === page.id)
            if (alive && target) target.thumbnail = image
          } catch {
            failedPreview = true
          }
        }
      } catch {
        failedPreview = true
      } finally {
        await preview?.destroy().catch(() => {})
        preview = null
      }
      if (alive && failedPreview) errors.value.push(`${file.name}: 一部のプレビューを表示できませんでした。ページ番号で選択・保存できます。`)
    }
  } finally {
    if (alive) {
      busy.value = false
      progress.value = ''
    }
  }
}

function chooseFiles(event: Event) {
  const input = event.target as HTMLInputElement
  void addFiles(Array.from(input.files ?? []))
  input.value = ''
}

function dropFiles(event: DragEvent) {
  if (event.dataTransfer?.files.length) void addFiles(Array.from(event.dataTransfer.files))
}

function move(from: number, to: number) {
  if (busy.value || from < 0 || to < 0 || from >= pages.value.length || to >= pages.value.length || from === to) return
  const [page] = pages.value.splice(from, 1)
  pages.value.splice(to, 0, page)
  notice.value = `${page.filename} の${page.pageIndex + 1}ページ目を${to + 1}番目に移動しました。`
}

function startDrag(event: DragEvent, id: number) {
  if (busy.value || !event.dataTransfer) { event.preventDefault(); return }
  draggedId.value = id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(id))
}

function endDrag() {
  draggedId.value = null
  dropTarget.value = null
}

function dropPage(id: number) {
  if (draggedId.value !== null) move(pages.value.findIndex(page => page.id === draggedId.value), pages.value.findIndex(page => page.id === id))
  endDrag()
}

function removePage(id: number) {
  if (busy.value) return
  const page = pages.value.find(page => page.id === id)
  pages.value = pages.value.filter(page => page.id !== id)
  if (page && !pages.value.some(item => item.sourceId === page.sourceId)) {
    sources.delete(page.sourceId)
    totalBytes.value -= sourceSizes.get(page.sourceId) ?? 0
    sourceSizes.delete(page.sourceId)
  }
}

function selectAll(value: boolean) {
  pages.value.forEach(page => { page.selected = value })
}

function selectRange() {
  try {
    const selection = parsePageSelection(range.value, pages.value.length)
    pages.value.forEach((page, index) => { page.selected = selection.has(index) })
    errors.value = []
  } catch (error) {
    errors.value = [message(error)]
  }
}

function clear() {
  if (busy.value) return
  pages.value = []
  sources.clear()
  sourceSizes.clear()
  totalBytes.value = 0
  range.value = ''
  errors.value = []
  notice.value = ''
  endDrag()
}

async function save(split: boolean) {
  if (busy.value || selected.value.length === 0) return
  busy.value = true
  errors.value = []
  progress.value = split ? 'ページを分割中…' : 'PDFを作成中…'
  try {
    const data = await (split ? splitPdf : exportPdf)(selected.value, sources)
    if (!alive) return
    const url = URL.createObjectURL(new Blob([new Uint8Array(data).buffer], { type: split ? 'application/zip' : 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = split ? 'pdf-pages.zip' : 'edited.pdf'
    downloadUrls.set(url, setTimeout(() => {
      URL.revokeObjectURL(url)
      downloadUrls.delete(url)
    }, 60_000))
    document.body.append(link)
    try { link.click() } finally { link.remove() }
    notice.value = `${selected.value.length}ページの${split ? 'ZIP' : 'PDF'}を作成しました。`
  } catch {
    if (alive) errors.value = ['保存できませんでした。ページ数を減らすか、PDFを追加し直してください。']
  } finally {
    if (alive) { busy.value = false; progress.value = '' }
  }
}

onMounted(() => { ready.value = true })

onBeforeUnmount(() => {
  alive = false
  void preview?.destroy().catch(() => {})
  sources.clear()
  for (const [url, timer] of downloadUrls) { clearTimeout(timer); URL.revokeObjectURL(url) }
  downloadUrls.clear()
})
</script>

<template>
  <div class="pdf-editor" :aria-busy="busy || !ready">
    <p>PDFを結合・分割し、ページを並べ替えます。ファイルは外部に送信せず、ブラウザ内で処理します。</p>
    <div class="pdf-upload" @dragover.prevent @drop.prevent="dropFiles">
      <label class="pdf-file-label">
        PDFを追加
        <input type="file" accept=".pdf,application/pdf" multiple :disabled="busy || !ready" aria-label="PDFを追加" @change="chooseFiles">
      </label>
      <span>ここにPDFをドロップすることもできます（合計100MB・300ページまで）。</span>
    </div>
    <p class="pdf-help">複数のPDFは追加した順に並びます。カードをドラッグするか「前へ」「次へ」で移動してください。保存対象はチェックしたページです。</p>
    <p class="pdf-help">ページ内容をコピーします。しおり・電子署名・フォームの保持には対応していません。パスワード付きPDFは事前に保護を解除してください。</p>
    <p v-if="busy" role="status">{{ progress }}</p>
    <div v-if="errors.length" role="alert" class="pdf-errors"><p v-for="(error, index) in errors" :key="index">{{ error }}</p></div>
    <p class="pdf-notice" role="status" aria-live="polite">{{ notice }}</p>
    <template v-if="pages.length">
      <div class="pdf-toolbar">
        <strong data-testid="pdf-count">{{ pages.length }}ページ中 {{ selected.length }}ページ選択</strong>
        <button type="button" :disabled="busy" @click="selectAll(true)">すべて選択</button>
        <button type="button" :disabled="busy" @click="selectAll(false)">選択解除</button>
        <button type="button" :disabled="busy" @click="clear">すべてクリア</button>
      </div>
      <form class="pdf-toolbar" @submit.prevent="selectRange">
        <label for="pdf-range">現在の並び順で選択</label>
        <input id="pdf-range" v-model="range" type="text" placeholder="例: 1-3, 5" :disabled="busy" aria-describedby="pdf-range-help">
        <button type="submit" :disabled="busy">ページ指定を適用</button>
        <small id="pdf-range-help">表示中の番号をカンマ・ハイフンで指定します。</small>
      </form>
      <ol class="pdf-pages" aria-label="PDFページ一覧">
        <li v-for="(page, index) in pages" :key="page.id" class="pdf-page" :class="{ 'pdf-page-target': dropTarget === page.id && draggedId !== page.id, 'pdf-page-selected': page.selected }" :draggable="!busy" @dragstart="startDrag($event, page.id)" @dragend="endDrag" @dragover.prevent="dropTarget = page.id" @drop.prevent.stop="dropPage(page.id)">
          <label class="pdf-page-selection">
            <input v-model="page.selected" type="checkbox" :disabled="busy" :aria-label="`${index + 1}番目のページを選択`">
            <span>{{ index + 1 }}</span>
          </label>
          <div class="pdf-thumbnail">
            <img v-if="page.thumbnail" :src="page.thumbnail" :alt="`${page.filename} の${page.pageIndex + 1}ページ目`" draggable="false">
            <span v-else>{{ busy ? 'プレビュー準備中' : 'プレビューなし' }}</span>
          </div>
          <p class="pdf-filename" :title="page.filename">{{ page.filename }}</p>
          <p class="pdf-original-page">元の {{ page.pageIndex + 1 }} ページ目</p>
          <div class="pdf-page-actions">
            <button type="button" :aria-label="`${index + 1}番目のページを前へ`" :disabled="busy || index === 0" @click="move(index, index - 1)">前へ</button>
            <button type="button" :aria-label="`${index + 1}番目のページを次へ`" :disabled="busy || index === pages.length - 1" @click="move(index, index + 1)">次へ</button>
            <button type="button" :aria-label="`${index + 1}番目のページを削除`" :disabled="busy" @click="removePage(page.id)">削除</button>
          </div>
        </li>
      </ol>
      <div class="pdf-toolbar pdf-save">
        <button class="pdf-primary" type="button" :disabled="busy || !selected.length" @click="save(false)">選択ページをPDF保存</button>
        <button type="button" :disabled="busy || !selected.length" @click="save(true)">1ページずつ分割してZIP保存</button>
      </div>
      <p class="pdf-help">1つのPDF内で一部を選ぶと抽出、複数のPDFのページを選ぶと結合できます。ZIP内のPDFは表示順に page-001.pdf から連番になります。</p>
    </template>
  </div>
</template>

<style scoped>
.pdf-editor { margin: 1.5rem 0; }
.pdf-upload { display: flex; flex-direction: column; gap: .75rem; padding: 1.25rem; border: 2px dashed var(--vp-c-divider); border-radius: 10px; background: var(--vp-c-bg-soft); }
.pdf-file-label { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; font-weight: 600; }
.pdf-file-label input { max-width: 100%; font: inherit; }
.pdf-help, .pdf-upload > span { color: var(--vp-c-text-2); font-size: .875rem; }
.pdf-toolbar { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; margin: 1rem 0; }
.pdf-toolbar small { flex-basis: 100%; color: var(--vp-c-text-2); }
button { padding: .4rem .65rem; border: 1px solid var(--vp-c-divider); border-radius: 6px; font: inherit; font-size: .875rem; background: var(--vp-c-bg-soft); cursor: pointer; }
button:disabled { opacity: .45; cursor: default; }
button:not(:disabled):hover { border-color: var(--vp-c-brand-1); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 3px; }
.pdf-toolbar input[type='text'] { width: 10rem; max-width: 100%; border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: .4rem .6rem; font: inherit; }
.pdf-pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 1rem; padding: 0; list-style: none; }
.pdf-page { min-width: 0; margin: 0; padding: .65rem; border: 2px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft); }
.pdf-page[draggable='true'] { cursor: grab; }
.pdf-page-selected { border-color: var(--vp-c-brand-2); }
.pdf-page-target { outline: 3px dashed var(--vp-c-brand-1); outline-offset: 2px; }
.pdf-page-selection { display: flex; gap: .5rem; align-items: center; font-weight: 600; cursor: pointer; }
.pdf-thumbnail { height: 180px; margin: .5rem 0; display: flex; align-items: center; justify-content: center; background: var(--vp-c-bg); color: var(--vp-c-text-2); font-size: .8rem; }
.pdf-thumbnail img { display: block; max-height: 180px; max-width: 100%; object-fit: contain; }
.pdf-filename { margin: .25rem 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; }
.pdf-original-page { margin: .25rem 0 .6rem; font-size: .8rem; color: var(--vp-c-text-2); }
.pdf-page-actions { display: flex; flex-wrap: wrap; gap: .3rem; }
.pdf-primary { background: var(--vp-c-brand-3); color: var(--vp-c-white); }
.pdf-errors { padding: .5rem .8rem; border: 1px solid var(--vp-c-danger-1); border-radius: 6px; color: var(--vp-c-danger-1); }
.pdf-errors p { margin: .3rem 0; overflow-wrap: anywhere; }
.pdf-notice { min-height: 1.5em; color: var(--vp-c-text-2); font-size: .875rem; }
</style>
