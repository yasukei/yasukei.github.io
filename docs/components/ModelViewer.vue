<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import {
  ACCEPT,
  FORMAT_LABELS,
  formatCount,
  formatLength,
  pickModel,
  snapshotName,
  type ModelFormat
} from '../lib/model-viewer'
// Types only: the scene and what it imports are loaded on demand. Why nothing
// else may be shared with it is in ../lib/model-viewer.
import type { Background, ModelScene, Shown } from '../lib/model-scene'

interface Loaded extends Shown {
  name: string
  format: ModelFormat
}

const BACKGROUND_OPTIONS: { value: Background; label: string }[] = [
  { value: 'dark', label: '暗い背景' },
  { value: 'light', label: '明るい背景' },
  { value: 'transparent', label: '透明な背景' }
]

/** Errors whose message is written for the person using the tool, rather than for a developer. */
const EXPLAINED = new Set(['ModelLoadError', 'WebGLUnavailableError'])

/** Long enough to read a sentence, short enough not to linger over the next action. */
const MESSAGE_TIME = 4000

const canvas = ref<HTMLCanvasElement | null>(null)

const model = shallowRef<Loaded | null>(null)
const loading = ref(false)
const dragging = ref(false)
const wireframe = ref(false)
const zUp = ref(false)
const background = ref<Background>('dark')
const message = ref('')

/**
 * three.js is several hundred kilobytes, so it is fetched once the page is
 * open rather than bundled into the page: VitePress prefetches the page chunk
 * of every link in view, and the sidebar links here from everywhere.
 */
let sceneModule: Promise<typeof import('../lib/model-scene')> | null = null
let scene: ModelScene | null = null
/** Bumped by every load, so a slow one that finishes late does not replace a newer model. */
let loadCount = 0
let messageTimer: ReturnType<typeof setTimeout> | null = null
/** The last saved PNG, kept until the next save so the download has time to start. */
let savedUrl: string | null = null
let unmounted = false

const dimensions = computed(() => {
  const size = model.value?.size
  return size ? [size.x, size.y, size.z].map(formatLength).join(' × ') : ''
})

function say(text: string) {
  message.value = text
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => {
    message.value = ''
    messageTimer = null
  }, MESSAGE_TIME)
}

function loadModule() {
  sceneModule ??= import('../lib/model-scene')
  return sceneModule
}

/** Made on first use, once the canvas is on screen to size the drawing buffer from. */
async function sceneFor(el: HTMLCanvasElement): Promise<ModelScene> {
  if (scene) return scene
  const { ModelScene } = await loadModule()
  scene ??= new ModelScene(el)
  scene.setBackground(background.value)
  return scene
}

async function load(files: Iterable<File>) {
  const picked = pickModel(files)
  if (!picked) {
    say('対応している形式は GLB / glTF / STL / OBJ です。')
    return
  }

  const current = ++loadCount
  loading.value = true
  // The stage shows while loading, so the canvas has its real size to frame the model in.
  await nextTick()
  try {
    const el = canvas.value
    if (!el || unmounted) return
    const viewer = await sceneFor(el)
    if (current !== loadCount || unmounted) return
    const shown = await viewer.load(picked.model, picked.format, picked.resources)
    if (!shown || current !== loadCount) return

    model.value = { ...shown, name: picked.model.name, format: picked.format }
    // A guess from the format, which the toggle can overrule for this model.
    zUp.value = picked.format === 'stl'
    viewer.setZUp(zUp.value)
    // The model itself loaded; what is missing is a texture it can be shown without.
    if (shown.missing.length > 0) say(`${shown.missing.join('、')} が見つからないため、なしで表示しています。`)
    else message.value = ''
  } catch (error) {
    if (current !== loadCount) return
    say(error instanceof Error && EXPLAINED.has(error.name) ? error.message : 'このファイルは読み込めませんでした。')
  } finally {
    if (current === loadCount) loading.value = false
  }
}

function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  void load(input.files ?? [])
  // So the same file can be chosen again.
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  void load(event.dataTransfer?.files ?? [])
}

function onDragLeave(event: DragEvent) {
  // Moving over a child fires dragleave on the parent; only leaving the tool counts.
  const to = event.relatedTarget as Node | null
  if (!to || !(event.currentTarget as Node).contains(to)) dragging.value = false
}

/* ---------- toolbar ---------- */

function toggleWireframe() {
  wireframe.value = !wireframe.value
  scene?.setWireframe(wireframe.value)
}

function toggleZUp() {
  zUp.value = !zUp.value
  scene?.setZUp(zUp.value)
}

function resetView() {
  scene?.resetView()
}

function selectBackground(next: Background) {
  background.value = next
  scene?.setBackground(next)
}

async function save() {
  const loaded = model.value
  if (!scene || !loaded) return
  try {
    const blob = await scene.snapshot()
    if (savedUrl) URL.revokeObjectURL(savedUrl)
    savedUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = savedUrl
    link.download = snapshotName(loaded.name)
    link.click()
  } catch (error) {
    say(error instanceof Error ? error.message : '画像を保存できませんでした。')
  }
}

onMounted(() => {
  // Start fetching three.js now, so it is usually there by the time a file is chosen.
  void loadModule().catch(() => {
    sceneModule = null
  })
})

onBeforeUnmount(() => {
  unmounted = true
  if (messageTimer) clearTimeout(messageTimer)
  if (savedUrl) URL.revokeObjectURL(savedUrl)
  scene?.dispose()
  scene = null
})
</script>

<template>
  <div
    class="mv-root"
    :class="{ 'mv-over': dragging }"
    @dragover.prevent="dragging = true"
    @dragenter.prevent="dragging = true"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <label v-if="!model && !loading" class="mv-drop">
      <input class="mv-file" type="file" :accept="ACCEPT" multiple aria-label="モデルを選択" @change="onPick" />
      <strong>3D モデルをドロップ</strong>
      <span class="mv-drop-note">または クリックして選択（GLB / glTF / STL / OBJ）</span>
    </label>

    <div v-if="model" class="mv-bar" role="toolbar" aria-label="表示">
      <div class="mv-group">
        <button class="mv-btn" :aria-pressed="wireframe" title="ポリゴンの辺だけを表示" @click="toggleWireframe">ワイヤーフレーム</button>
        <button class="mv-btn" :aria-pressed="zUp" title="Z 軸を上にする（CAD や 3D プリント用のデータ向け）" @click="toggleZUp">Z 軸を上に</button>
        <button class="mv-btn" title="全体が見える向きに戻す" @click="resetView">視点リセット</button>
      </div>

      <div class="mv-group" role="group" aria-label="背景">
        <button
          v-for="option in BACKGROUND_OPTIONS"
          :key="option.value"
          class="mv-swatch"
          :class="`mv-bg-${option.value}`"
          :aria-pressed="background === option.value"
          :aria-label="option.label"
          :title="option.label"
          @click="selectBackground(option.value)"
        ></button>
      </div>

      <div class="mv-group mv-end">
        <label class="mv-btn" title="別のモデルを開く">
          開く
          <input class="mv-file" type="file" :accept="ACCEPT" multiple aria-label="別のモデルを選択" @change="onPick" />
        </label>
        <button class="mv-btn mv-main" @click="save">PNG で保存</button>
      </div>
    </div>

    <div v-show="model || loading" class="mv-stage" :class="`mv-bg-${background}`">
      <canvas ref="canvas" aria-label="3D モデルの表示"></canvas>
      <p v-if="loading" class="mv-loading">読み込み中…</p>
    </div>

    <dl v-if="model" class="mv-meta">
      <div><dt>ファイル</dt><dd>{{ model.name }}（{{ FORMAT_LABELS[model.format] }}）</dd></div>
      <div><dt>ポリゴン</dt><dd>{{ formatCount(model.stats.triangles) }} 三角形</dd></div>
      <div><dt>頂点</dt><dd>{{ formatCount(model.stats.vertices) }}</dd></div>
      <div><dt>メッシュ</dt><dd>{{ formatCount(model.stats.meshes) }}</dd></div>
      <div><dt>マテリアル</dt><dd>{{ formatCount(model.stats.materials) }}</dd></div>
      <div><dt>サイズ (X × Y × Z)</dt><dd>{{ dimensions }}</dd></div>
    </dl>

    <p class="mv-status" role="status">{{ message }}</p>

    <p class="mv-hint">
      左ドラッグで回転、右ドラッグ（または Shift + ドラッグ）で移動、ホイールで拡大縮小。スマホは 1 本指で回転、2 本指で移動と拡大縮小。
      .gltf と .obj は、参照している .bin・テクスチャ・.mtl も一緒に選ぶかドロップしてください。
      サイズの単位はファイル次第です（glTF はメートル、STL はたいてい mm）。
      モデルはこのブラウザの中だけで処理され、どこにも送信されません。
    </p>
  </div>
</template>

<style scoped>
.mv-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
  border-radius: 8px;
}

.mv-over {
  outline: 2px dashed var(--vp-c-brand-1);
  outline-offset: 4px;
}

.mv-drop {
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

.mv-drop:hover,
.mv-over .mv-drop {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-mute);
}

.mv-drop-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.mv-file {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.mv-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 6px 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.mv-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.mv-end {
  margin-left: auto;
}

.mv-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.mv-btn:hover {
  background: var(--vp-c-bg-mute);
}

.mv-btn[aria-pressed='true'] {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
}

.mv-main {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.mv-swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid var(--vp-c-border);
  border-radius: 50%;
  cursor: pointer;
}

.mv-swatch[aria-pressed='true'] {
  outline: 2px solid var(--vp-c-text-1);
  outline-offset: 2px;
}

/* The scene clears to the same colours; these only show through while it loads. */
.mv-bg-dark {
  background: #1e1f24;
}

.mv-bg-light {
  background: #f2f3f5;
}

.mv-bg-transparent {
  background: repeating-conic-gradient(#c8c8c8 0 25%, #ffffff 0 50%) 0 0 / 16px 16px;
}

.mv-stage {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--vp-shadow-2);
}

canvas {
  display: block;
  width: 100%;
  height: min(70dvh, 560px);
  touch-action: none;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.mv-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  font-size: 14px;
}

.mv-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}

.mv-meta div {
  display: flex;
  gap: 6px;
}

.mv-meta dd {
  margin: 0;
  color: var(--vp-c-text-1);
}

.mv-status {
  margin: 0;
  min-height: 1.5em;
  font-size: 13px;
  color: var(--vp-c-brand-1);
}

.mv-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}
</style>
