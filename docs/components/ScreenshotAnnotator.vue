<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  COLORS,
  EMPTY_HISTORY,
  LINE_HEIGHT,
  SIZES,
  TEXT_FONT,
  addShape,
  annotatedName,
  arrowOf,
  cleanText,
  clearShapes,
  ellipseOf,
  isTooSmall,
  outlineFor,
  redo,
  scaleUnit,
  shortcutFor,
  toImagePoint,
  undo,
  type History,
  type Point,
  type Shape,
  type Tool
} from '../lib/annotate'
import { exceedsCanvasLimit, type Size } from '../lib/image-resize'
import { decode, release, toBlob } from '../lib/canvas-resize'

interface Loaded {
  bitmap: ImageBitmap
  /** File name, or null for an image pasted from the clipboard. */
  name: string | null
  size: Size
}

interface Editor {
  at: Point
  size: number
  color: string
  /** Screen pixels per image pixel when the editor opened, to place it over the canvas. */
  scale: number
  value: string
}

const TOOLS: { value: Tool; label: string; key: string; icon: string }[] = [
  { value: 'ellipse', label: '丸', key: 'O', icon: 'M3 12a9 7 0 1 0 18 0a9 7 0 1 0-18 0' },
  { value: 'rect', label: '四角', key: 'R', icon: 'M4 6h16v12H4z' },
  { value: 'arrow', label: '矢印', key: 'A', icon: 'M5 19 19 5M10 5h9v9' },
  { value: 'pen', label: 'ペン', key: 'P', icon: 'M4 17c3-6 5 2 8-3s4-6 8-4' },
  { value: 'text', label: '文字', key: 'T', icon: 'M5 6h14M12 6v13' }
]

/** Long enough to read a sentence, short enough not to linger over the next action. */
const MESSAGE_TIME = 3000

const canvas = ref<HTMLCanvasElement | null>(null)
const textarea = ref<HTMLTextAreaElement | null>(null)

const image = shallowRef<Loaded | null>(null)
const history = shallowRef<History>(EMPTY_HISTORY)
const tool = ref<Tool>('ellipse')
const colorIndex = ref(0)
const sizeIndex = ref(1)
const editor = ref<Editor | null>(null)
const dragging = ref(false)
const message = ref('')

/** The shape being dragged out. Not reactive: a pen stroke adds a point per pointer move. */
let draft: Shape | null = null
let messageTimer: ReturnType<typeof setTimeout> | null = null
/** The last saved PNG, kept until the next save so the download has time to start. */
let savedUrl: string | null = null

const canUndo = computed(() => history.value.past.length > 0)
const canRedo = computed(() => history.value.future.length > 0)
const hasShapes = computed(() => history.value.present.length > 0)

const editorStyle = computed(() => {
  const open = editor.value
  if (!open) return {}
  return {
    left: `${open.at.x * open.scale}px`,
    top: `${open.at.y * open.scale}px`,
    fontSize: `${open.size * open.scale}px`,
    // The same as it will be drawn in, so what is typed lines up with the result.
    fontFamily: TEXT_FONT,
    lineHeight: LINE_HEIGHT,
    color: open.color
  }
})

function say(text: string) {
  message.value = text
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    message.value = ''
    messageTimer = null
  }, MESSAGE_TIME)
}

/* ---------- drawing ---------- */

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape) {
  ctx.save()
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (shape.type) {
    case 'pen': {
      ctx.lineWidth = shape.width
      ctx.beginPath()
      shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      // A click without a drag: a line of no length draws nothing, so nudge it into a dot.
      if (shape.points.length === 1) ctx.lineTo(shape.points[0].x + 0.1, shape.points[0].y)
      ctx.stroke()
      break
    }
    case 'rect': {
      ctx.lineWidth = shape.width
      const { from, to } = shape
      ctx.strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y))
      break
    }
    case 'ellipse': {
      ctx.lineWidth = shape.width
      const { cx, cy, rx, ry } = ellipseOf(shape.from, shape.to, shape.circle)
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'arrow': {
      ctx.lineWidth = shape.width
      const { shaftEnd, head } = arrowOf(shape.from, shape.to, shape.width)
      ctx.beginPath()
      ctx.moveTo(shape.from.x, shape.from.y)
      ctx.lineTo(shaftEnd.x, shaftEnd.y)
      ctx.stroke()
      ctx.beginPath()
      head.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'text': {
      ctx.font = `700 ${shape.size}px ${TEXT_FONT}`
      ctx.textBaseline = 'top'
      ctx.lineWidth = Math.max(2, shape.size / 7)
      ctx.strokeStyle = outlineFor(shape.color)
      shape.text.split('\n').forEach((line, i) => {
        const y = shape.at.y + i * shape.size * LINE_HEIGHT
        ctx.strokeText(line, shape.at.x, y)
        ctx.fillText(line, shape.at.x, y)
      })
      break
    }
  }
  ctx.restore()
}

/** Synchronous, so a copy or save straight after a change gets the change. */
function render() {
  const el = canvas.value
  const loaded = image.value
  const ctx = el?.getContext('2d')
  if (!el || !loaded || !ctx) return

  ctx.clearRect(0, 0, el.width, el.height)
  ctx.drawImage(loaded.bitmap, 0, 0)
  for (const shape of history.value.present) drawShape(ctx, shape)
  if (draft) drawShape(ctx, draft)
}

function setHistory(next: History) {
  history.value = next
  render()
}

/* ---------- loading ---------- */

async function load(file: Blob, name: string | null) {
  editor.value = null
  draft = null

  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file)
  } catch {
    say('この画像は読み込めませんでした。')
    return
  }
  const size = { width: bitmap.width, height: bitmap.height }
  if (exceedsCanvasLimit(size)) {
    release(bitmap)
    say('この画像はブラウザで扱うには大きすぎます。')
    return
  }

  release(image.value?.bitmap)
  image.value = { bitmap, name, size }
  history.value = EMPTY_HISTORY

  // The canvas only exists once there is an image to show.
  await nextTick()
  if (!canvas.value) return
  canvas.value.width = size.width
  canvas.value.height = size.height
  render()
}

function firstImage(files: Iterable<File>): File | null {
  return [...files].find((file) => file.type.startsWith('image/')) ?? null
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = firstImage(input.files ?? [])
  if (file) void load(file, file.name)
  // So the same file can be chosen again.
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  const file = firstImage(event.dataTransfer?.files ?? [])
  if (file) void load(file, file.name)
  else say('画像ファイルをドロップしてください。')
}

function onDragLeave(event: DragEvent) {
  // Moving over a child fires dragleave on the parent; only leaving the tool counts.
  const to = event.relatedTarget as Node | null
  if (!to || !(event.currentTarget as Node).contains(to)) dragging.value = false
}

/** Typing somewhere else on the page, such as the site search, is not meant for the tool. */
function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function onPaste(event: ClipboardEvent) {
  if (isEditable(event.target)) return
  const item = [...(event.clipboardData?.items ?? [])].find(
    (candidate) => candidate.kind === 'file' && candidate.type.startsWith('image/')
  )
  const file = item?.getAsFile()
  if (!file) {
    say('クリップボードに画像がありません。')
    return
  }
  event.preventDefault()
  void load(file, null)
}

/* ---------- pointer ---------- */

function pointAt(event: PointerEvent): Point {
  const el = canvas.value as HTMLCanvasElement
  return toImagePoint({ x: event.clientX, y: event.clientY }, el.getBoundingClientRect(), {
    width: el.width,
    height: el.height
  })
}

function onPointerDown(event: PointerEvent) {
  const loaded = image.value
  if (event.button !== 0 || !loaded || !canvas.value) return
  const at = pointAt(event)

  if (tool.value === 'text') {
    event.preventDefault()
    // A click away from an open editor finishes it; the next click starts another.
    if (editor.value) commitText()
    else openEditor(at)
    return
  }

  canvas.value.setPointerCapture?.(event.pointerId)
  const color = COLORS[colorIndex.value]
  const width = SIZES[sizeIndex.value].stroke * scaleUnit(loaded.size)
  draft =
    tool.value === 'pen'
      ? { type: 'pen', points: [at], color, width }
      : { type: tool.value, from: at, to: { ...at }, color, width }
  render()
}

function onPointerMove(event: PointerEvent) {
  if (!draft) return
  const at = pointAt(event)
  if (draft.type === 'pen') draft.points.push(at)
  else if (draft.type !== 'text') {
    draft.to = at
    draft.circle = draft.type === 'ellipse' && event.shiftKey
  }
  render()
}

function endDraft() {
  if (!draft) return
  const done = draft
  draft = null
  if (isTooSmall(done)) render()
  else setHistory(addShape(history.value, done))
}

/* ---------- text ---------- */

function openEditor(at: Point) {
  const el = canvas.value
  const loaded = image.value
  if (!el || !loaded) return
  editor.value = {
    at,
    size: SIZES[sizeIndex.value].text * scaleUnit(loaded.size),
    color: COLORS[colorIndex.value],
    scale: el.width ? el.getBoundingClientRect().width / el.width : 1,
    value: ''
  }
  // After the click that opened it has finished moving focus about.
  void nextTick(() => setTimeout(() => {
    fitEditor()
    textarea.value?.focus()
  }))
}

function fitEditor() {
  const el = textarea.value
  if (!el) return
  el.style.height = 'auto'
  el.style.width = 'auto'
  el.style.height = `${el.scrollHeight}px`
  el.style.width = `${el.scrollWidth + 8}px`
}

function commitText() {
  const open = editor.value
  if (!open) return
  editor.value = null
  const text = cleanText(open.value)
  if (text) setHistory(addShape(history.value, { type: 'text', at: open.at, size: open.size, color: open.color, text }))
}

function onEditorKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    commitText()
  } else if (event.key === 'Escape') {
    editor.value = null
  }
}

/* ---------- toolbar ---------- */

function selectTool(next: Tool) {
  commitText()
  tool.value = next
}

function clearAll() {
  if (!hasShapes.value) return
  setHistory(clearShapes(history.value))
  say('書き込みを消去しました（Ctrl+Z で戻せます）。')
}

async function copy() {
  commitText()
  const el = canvas.value
  if (!el) return
  try {
    // The blob goes in as a promise: Safari only allows the write while the
    // click that asked for it is still being handled.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob(el, 'image/png') })])
    say('クリップボードにコピーしました。')
  } catch {
    say('このブラウザではコピーできませんでした。「PNG で保存」を使ってください。')
  }
}

async function save() {
  commitText()
  const el = canvas.value
  const loaded = image.value
  if (!el || !loaded) return
  try {
    const blob = await toBlob(el, 'image/png')
    if (savedUrl) URL.revokeObjectURL(savedUrl)
    savedUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = savedUrl
    link.download = annotatedName(loaded.name)
    link.click()
  } catch (error) {
    say(error instanceof Error ? error.message : '画像を保存できませんでした。')
  }
}

/* ---------- keyboard ---------- */

function onKeydown(event: KeyboardEvent) {
  if (!image.value || editor.value || event.isComposing || isEditable(event.target)) return
  const shortcut = shortcutFor(event)
  if (!shortcut) return
  // Ctrl+C on selected text on the page is still a text copy.
  if (shortcut.action === 'copy' && String(window.getSelection() ?? '') !== '') return

  event.preventDefault()
  switch (shortcut.action) {
    case 'undo':
      if (!draft) setHistory(undo(history.value))
      break
    case 'redo':
      if (!draft) setHistory(redo(history.value))
      break
    case 'copy':
      void copy()
      break
    case 'tool':
      selectTool(shortcut.tool)
      break
    case 'color':
      colorIndex.value = shortcut.index
      break
  }
}

onMounted(() => {
  document.addEventListener('paste', onPaste)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('paste', onPaste)
  document.removeEventListener('keydown', onKeydown)
  if (messageTimer) clearTimeout(messageTimer)
  if (savedUrl) URL.revokeObjectURL(savedUrl)
  release(image.value?.bitmap)
})
</script>

<template>
  <div
    class="sa-root"
    :class="{ 'sa-over': dragging }"
    @dragover.prevent="dragging = true"
    @dragenter.prevent="dragging = true"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <label v-if="!image" class="sa-drop">
      <input class="sa-file" type="file" accept="image/*" aria-label="画像を選択" @change="onPick" />
      <strong><kbd>Ctrl</kbd> + <kbd>V</kbd> でスクショを貼り付け</strong>
      <span class="sa-drop-note">または画像をドロップ／クリックして選択</span>
    </label>

    <template v-else>
      <div class="sa-bar" role="toolbar" aria-label="注釈">
        <div class="sa-group" role="group" aria-label="図形">
          <button
            v-for="option in TOOLS"
            :key="option.value"
            class="sa-btn"
            :aria-pressed="tool === option.value"
            :title="`${option.label} (${option.key})${option.value === 'ellipse' ? '  Shift で正円' : ''}`"
            @click="selectTool(option.value)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="option.icon" /></svg>
            <span class="sa-label">{{ option.label }}</span>
            <kbd class="sa-key">{{ option.key }}</kbd>
          </button>
        </div>

        <div class="sa-group" role="group" aria-label="色">
          <button
            v-for="(color, index) in COLORS"
            :key="color"
            class="sa-swatch"
            :style="{ background: color }"
            :aria-pressed="colorIndex === index"
            :aria-label="`色 ${index + 1}`"
            :title="`色 (${index + 1})`"
            @click="colorIndex = index"
          ></button>
        </div>

        <div class="sa-group" role="group" aria-label="太さ">
          <button
            v-for="(size, index) in SIZES"
            :key="size.label"
            class="sa-btn sa-size"
            :aria-pressed="sizeIndex === index"
            :aria-label="`太さ ${size.label}`"
            :title="size.label"
            @click="sizeIndex = index"
          >
            <b :style="{ width: `${4 + index * 4}px`, height: `${4 + index * 4}px` }"></b>
          </button>
        </div>

        <div class="sa-group">
          <button class="sa-btn" :disabled="!canUndo" aria-label="元に戻す" title="元に戻す (Ctrl+Z)" @click="setHistory(undo(history))">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
          </button>
          <button class="sa-btn" :disabled="!canRedo" aria-label="やり直す" title="やり直す (Ctrl+Shift+Z)" @click="setHistory(redo(history))">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></svg>
          </button>
          <button class="sa-btn" :disabled="!hasShapes" title="書き込みを全部消す" @click="clearAll">消去</button>
        </div>

        <div class="sa-group sa-end">
          <label class="sa-btn" title="別の画像を開く">
            開く
            <input class="sa-file" type="file" accept="image/*" aria-label="別の画像を選択" @change="onPick" />
          </label>
          <button class="sa-btn" title="クリップボードにコピー (Ctrl+C)" @click="copy">コピー</button>
          <button class="sa-btn sa-main" @click="save">PNG で保存</button>
        </div>
      </div>

      <div class="sa-stage">
        <div class="sa-wrap">
          <canvas
            ref="canvas"
            :class="{ 'sa-text': tool === 'text' }"
            aria-label="注釈を書き込む画像"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="endDraft"
            @pointercancel="endDraft"
          ></canvas>
          <textarea
            v-if="editor"
            ref="textarea"
            v-model="editor.value"
            class="sa-editor"
            :style="editorStyle"
            rows="1"
            spellcheck="false"
            aria-label="書き込む文字"
            @input="fitEditor"
            @keydown="onEditorKeydown"
            @blur="commitText"
          ></textarea>
        </div>
      </div>

      <div class="sa-meta">
        <span>{{ image.name ?? '貼り付けた画像' }}</span>
        <span>{{ image.size.width }} × {{ image.size.height }} px</span>
      </div>
    </template>

    <p class="sa-status" role="status">{{ message }}</p>

    <p class="sa-hint">
      文字は Enter で確定、Shift+Enter で改行、Esc で取り消し。ショートカット：O 丸 / R 四角 / A 矢印 / P ペン /
      T 文字 / 1〜6 色 / Ctrl+Z 元に戻す / Ctrl+C コピー。画像はこのブラウザの中だけで処理され、どこにも送信されません。
    </p>
  </div>
</template>

<style scoped>
.sa-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  border-radius: 8px;
}

.sa-over {
  outline: 2px dashed var(--vp-c-brand-1);
  outline-offset: 4px;
}

.sa-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 48px 16px;
  border: 2px dashed var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  text-align: center;
}

.sa-drop:hover,
.sa-over .sa-drop {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}

.sa-drop-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.sa-drop kbd,
.sa-key {
  font-family: var(--vp-font-family-mono);
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  padding: 0 4px;
}

.sa-file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.sa-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 6px 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.sa-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sa-end {
  margin-left: auto;
}

.sa-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.sa-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.sa-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.sa-btn[aria-pressed='true'] {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}

.sa-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.sa-key {
  font-size: 10px;
  line-height: 15px;
  color: var(--vp-c-text-2);
}

.sa-btn[aria-pressed='true'] .sa-key {
  color: inherit;
  border-color: currentColor;
  opacity: 0.7;
}

.sa-size {
  justify-content: center;
  width: 32px;
}

.sa-size b {
  display: block;
  border-radius: 50%;
  background: currentColor;
}

.sa-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid var(--vp-c-border);
  border-radius: 50%;
  cursor: pointer;
}

.sa-swatch[aria-pressed='true'] {
  outline: 2px solid var(--vp-c-text-1);
  outline-offset: 2px;
}

.sa-main {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.sa-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  overflow: auto;
}

.sa-wrap {
  position: relative;
  max-width: 100%;
  line-height: 0;
}

canvas {
  display: block;
  max-width: 100%;
  max-height: calc(100dvh - var(--vp-nav-height, 64px) - 200px);
  touch-action: none;
  cursor: crosshair;
  box-shadow: var(--vp-shadow-2);
}

canvas.sa-text {
  cursor: text;
}

.sa-editor {
  position: absolute;
  margin: 0;
  padding: 0;
  min-width: 40px;
  border: 1px dashed var(--vp-c-brand-1);
  background: rgba(255, 255, 255, 0.12);
  outline: none;
  resize: none;
  overflow: hidden;
  white-space: pre;
  font-weight: 700;
}

.sa-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.sa-status {
  margin: 0;
  min-height: 1.5em;
  font-size: 13px;
  color: var(--vp-c-brand-1);
}

.sa-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

@media (max-width: 640px) {
  .sa-label,
  .sa-key {
    display: none;
  }
}
</style>
