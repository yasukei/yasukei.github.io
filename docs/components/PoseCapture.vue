<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { associateHands, type DetailEstimator, type DetailKind, type FaceFrame, type HandFrame } from '../lib/detail-tracking'
import { POSE_MODELS, type PoseModel } from '../lib/pose-models'
import VrmPreview from './VrmPreview.vue'
import type { PoseFrame } from '../lib/vrm-pose'
import type { PoseEstimator } from '../lib/pose-estimator'
import { withBase } from 'vitepress'

const video = ref<HTMLVideoElement>()
const canvas = ref<HTMLCanvasElement>()
const supported = ref(false)
const active = ref(false)
const pending = ref(false)
const message = ref('共有するタブまたはウィンドウを選んでください。')
const size = reactive({ width: 0, height: 0 })
// Coordinates always use the source video's pixels, independent of preview size.
const crop = reactive({ x: 0, y: 0, width: 1, height: 1 })
const fps = ref(0)
const poseLoading = ref(false)
const poseEnabled = ref(false)
const poseStatus = ref('追跡を開始すると、推定用モデルをダウンロードします。')
const poseModel = ref<PoseModel>('lite')
const poseModelLabel = computed(() => POSE_MODELS.find(model => model.value === poseModel.value)!.label)
const poseFps = ref(0)
const vrmPose = shallowRef<PoseFrame | null>(null)
const trackingWanted = ref(false)
const poseSelected = ref(true)
const detailSelected = reactive({ face: false, hands: false })
const vrmFace = shallowRef<FaceFrame | null>(null)
const vrmHands = shallowRef<HandFrame[]>([])
const detailNames = { face: 'Face（顔）', hands: 'Hand（両手）' }
const detailState = reactive({
  face: { enabled: false, loading: false, status: '停止中', fps: 0, frames: 0, since: 0 },
  hands: { enabled: false, loading: false, status: '停止中', fps: 0, frames: 0, since: 0 }
})
const details: Partial<Record<DetailKind, DetailEstimator>> = {}
const detailRuns = { face: 0, hands: 0 }
const kinds: DetailKind[] = ['face', 'hands']
const anyLoading = computed(() => poseLoading.value || kinds.some(k => detailState[k].loading))
const anySelected = computed(() => poseSelected.value || kinds.some(k => detailSelected[k]))
const allReady = computed(() => anySelected.value && (!poseSelected.value || poseEnabled.value)
  && kinds.every(k => !detailSelected[k] || detailState[k].enabled))
let cleanInput: HTMLCanvasElement | undefined
let detailModule: Promise<typeof import('../lib/detail-estimator')> | undefined

function startTracking() {
  trackingWanted.value = true
  if (poseSelected.value && !poseEnabled.value && !poseLoading.value) void startPose()
  for (const kind of kinds) if (detailSelected[kind] && !detailState[kind].enabled && !detailState[kind].loading) void startDetail(kind)
}
function stopTracking() {
  trackingWanted.value = false
  stopPose()
  for (const kind of kinds) stopDetail(kind)
}
function stopDetail(kind: DetailKind) {
  detailRuns[kind]++
  details[kind]?.close()
  delete details[kind]
  Object.assign(detailState[kind], { enabled: false, loading: false, status: '停止中', fps: 0 })
  if (kind === 'face') vrmFace.value = null
  else vrmHands.value = []
  lastTime = -1
}
async function startDetail(kind: DetailKind) {
  const run = ++detailRuns[kind]
  const state = detailState[kind]
  state.loading = true
  state.status = 'モデルを読み込み中…'
  try {
    const { createDetailEstimator } = await (detailModule ??= import('../lib/detail-estimator'))
    if (run !== detailRuns[kind] || disposed) return
    const loaded = await createDetailEstimator(kind)
    if (run !== detailRuns[kind] || disposed || !active.value) { loaded.close(); return }
    details[kind] = loaded
    Object.assign(state, { enabled: true, frames: 0, since: performance.now(), status: `${loaded.delegate}・検出待ち` })
    lastTime = -1
  } catch (error) {
    if (run !== detailRuns[kind] || disposed) return
    detailModule = undefined
    state.status = `読み込み失敗。追跡を開始して再試行できます。${error instanceof Error ? ` (${error.message})` : ''}`
  } finally { if (run === detailRuns[kind]) state.loading = false }
}
watch(poseSelected, selected => {
  if (!selected) stopPose()
  else if (trackingWanted.value && active.value) void startPose()
})
for (const kind of kinds) watch(() => detailSelected[kind], selected => {
  if (!selected) stopDetail(kind)
  else if (trackingWanted.value && active.value) void startDetail(kind)
})
let estimator: PoseEstimator | undefined
let poseRun = 0
let poseFrames = 0
let poseSince = 0

function stopPose() {
  vrmPose.value = null
  poseRun++
  estimator?.close()
  estimator = undefined
  poseLoading.value = false
  poseEnabled.value = false
  poseFps.value = 0
  lastTime = -1 // Redraw the clean video, including when it is paused.
  poseStatus.value = '骨格表示は停止中です。'
}
watch(poseModel, () => {
  if (!poseEnabled.value && !poseLoading.value) return
  stopPose()
  if (active.value) void startPose()
})
async function startPose() {
  const model = poseModel.value
  const run = ++poseRun
  poseLoading.value = true
  poseStatus.value = `${poseModelLabel.value} モデルを読み込み中…（初回は時間がかかります）`
  try {
    const { createPoseEstimator } = await import('../lib/pose-estimator')
    if (run !== poseRun || disposed) return
    const loaded = await createPoseEstimator(model)
    if (run !== poseRun || disposed || !active.value) { loaded.close(); return }
    estimator = loaded
    poseEnabled.value = true
    poseFrames = 0
    poseSince = performance.now()
    lastTime = -1
    poseStatus.value = `骨格表示中（${poseModelLabel.value} / ${loaded.delegate}）。人物を検出しています。`
  } catch (error) {
    if (run !== poseRun || disposed) return
    poseStatus.value = `モデルを読み込めませんでした。通信環境や WebGL 対応を確認し、再度開始してください。${error instanceof Error ? ` (${error.message})` : ''}`
  } finally { if (run === poseRun) poseLoading.value = false }
}
const frameStyle = computed(() => ({
  left: `${crop.x / size.width * 100}%`, top: `${crop.y / size.height * 100}%`,
  width: `${crop.width / size.width * 100}%`, height: `${crop.height / size.height * 100}%`
}))
let stream: MediaStream | undefined
let animation = 0
let disposed = false
let frames = 0
let since = 0
let lastTime = -1
let lastCrop = ''
let gesture: { id: number; x: number; y: number; scaleX: number; scaleY: number; resize: boolean; crop: typeof crop } | undefined

onMounted(() => { supported.value = !!navigator.mediaDevices?.getDisplayMedia && window.isSecureContext })
onBeforeUnmount(() => { disposed = true; stop() })

function resetCrop() {
  Object.assign(crop, { x: 0, y: 0, width: size.width, height: size.height })
}
function stop() {
  cancelAnimationFrame(animation)
  stopTracking()
  cleanInput = undefined
  gesture = undefined
  stream?.getTracks().forEach(track => track.stop())
  stream = undefined
  if (video.value) video.value.srcObject = null
  canvas.value?.getContext('2d')?.clearRect(0, 0, canvas.value.width, canvas.value.height)
  active.value = false
  fps.value = 0
}
async function start() {
  pending.value = true
  message.value = ''
  try {
    const captured = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
    if (disposed) { captured.getTracks().forEach(track => track.stop()); return }
    stream = captured
    const track = captured.getVideoTracks()[0]
    track.addEventListener('ended', () => { stop(); message.value = '画面共有が終了しました。' }, { once: true })
    video.value!.srcObject = captured
    await video.value!.play()
    if (disposed || stream !== captured) return
    active.value = true
    frames = 0
    since = performance.now()
    lastTime = -1
    message.value = '共有中です。青い枠をドラッグし、右下のハンドルでサイズを変えられます。'
    draw()
  } catch (error) {
    stop()
    message.value = error instanceof DOMException && error.name === 'NotAllowedError'
      ? '共有がキャンセルされたか、許可されませんでした。再度開始できます。'
      : `画面共有を開始できませんでした。ブラウザや OS の画面収録権限を確認してください。${error instanceof Error ? ` (${error.message})` : ''}`
  } finally { pending.value = false }
}
function draw() {
  const source = video.value
  const output = canvas.value
  if (!active.value || !source || !output) return
  if (source.videoWidth && source.videoHeight && source.readyState >= 2) {
    if (size.width !== source.videoWidth || size.height !== source.videoHeight) {
      size.width = source.videoWidth
      size.height = source.videoHeight
      gesture = undefined
      resetCrop()
    }
    const cropKey = `${crop.x},${crop.y},${crop.width},${crop.height}`
    if (source.currentTime !== lastTime || cropKey !== lastCrop) {
      lastCrop = cropKey
      lastTime = source.currentTime
      const width = Math.max(1, Math.round(crop.width))
      const height = Math.max(1, Math.round(crop.height))
      if (output.width !== width) output.width = width
      if (output.height !== height) output.height = height
      output.getContext('2d')?.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
      frames++
      if (kinds.some(k => details[k])) {
        // All tasks see the same clean crop, never another task's drawn markers.
        cleanInput ??= document.createElement('canvas')
        const scale = Math.min(1, 640 / Math.max(width, height))
        const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale))
        if (cleanInput.width !== w) cleanInput.width = w
        if (cleanInput.height !== h) cleanInput.height = h
        cleanInput.getContext('2d')!.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h)
      }
      if (estimator) {
        try {
          const count = estimator.draw(output, performance.now(), pose => { vrmPose.value = pose })
          poseFrames++
          poseStatus.value = count ? `骨格表示中（${poseModelLabel.value} / ${estimator.delegate}）・1 人検出` : `骨格表示中（${poseModelLabel.value} / ${estimator.delegate}）・人物が見つかりません。全身が枠内に入るよう調整してください。`
        } catch (error) {
          stopPose()
          poseStatus.value = `ポーズ推定を停止しました。再度開始できます。${error instanceof Error ? ` (${error.message})` : ''}`
        }
      }
      for (const kind of kinds) {
        const task = details[kind]
        if (!task || !cleanInput) continue
        const state = detailState[kind]
        try {
          const result = task.draw(cleanInput, output, performance.now())
          if (kind === 'face') vrmFace.value = result.face
          else vrmHands.value = associateHands(result.hands, vrmPose.value?.imagePoints)
          state.frames++
          state.status = `${task.delegate}・${result.count ? `${result.count} ${kind === 'face' ? '顔' : '手'}検出` : '未検出'}`
        } catch (error) {
          stopDetail(kind)
          state.status = `推定を停止しました。追跡を開始して再試行できます。${error instanceof Error ? ` (${error.message})` : ''}`
        }
      }
    }
    const now = performance.now()
    for (const kind of kinds) {
      const state = detailState[kind]
      if (state.enabled && now - state.since >= 1000) {
        state.fps = Math.round(state.frames * 1000 / (now - state.since))
        state.frames = 0
        state.since = now
      }
    }
    if (poseEnabled.value && now - poseSince >= 1000) {
      poseFps.value = Math.round(poseFrames * 1000 / (now - poseSince))
      poseFrames = 0
      poseSince = now
    }
    if (now - since >= 1000) { fps.value = Math.round(frames * 1000 / (now - since)); frames = 0; since = now }
  }
  animation = requestAnimationFrame(draw)
}
function begin(event: PointerEvent, resize = false) {
  if (!active.value || event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  const bounds = video.value!.getBoundingClientRect()
  element.setPointerCapture(event.pointerId)
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY,
    scaleX: size.width / bounds.width, scaleY: size.height / bounds.height, resize, crop: { ...crop } }
  event.preventDefault()
}
function move(event: PointerEvent) {
  const g = gesture
  if (!g || g.id !== event.pointerId) return
  const dx = (event.clientX - g.x) * g.scaleX
  const dy = (event.clientY - g.y) * g.scaleY
  if (g.resize) {
    crop.width = Math.max(1, Math.min(size.width - crop.x, g.crop.width + dx))
    crop.height = Math.max(1, Math.min(size.height - crop.y, g.crop.height + dy))
  } else {
    crop.x = Math.max(0, Math.min(size.width - crop.width, g.crop.x + dx))
    crop.y = Math.max(0, Math.min(size.height - crop.height, g.crop.y + dy))
  }
}
function keyboard(event: KeyboardEvent) {
  const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const direction = directions[event.key]
  if (!direction) return
  event.preventDefault()
  const step = event.shiftKey ? 10 : 1
  if (event.currentTarget === event.target && (event.target as HTMLElement).dataset.resize) {
    crop.width = Math.max(1, Math.min(size.width - crop.x, crop.width + direction[0] * step))
    crop.height = Math.max(1, Math.min(size.height - crop.y, crop.height + direction[1] * step))
  } else {
    crop.x = Math.max(0, Math.min(size.width - crop.width, crop.x + direction[0] * step))
    crop.y = Math.max(0, Math.min(size.height - crop.height, crop.y + direction[1] * step))
  }
  event.stopPropagation()
}
</script>

<template>
  <section class="capture-tool">
    <p>映像はブラウザ内だけで処理し、サーバーへ送信しません。音声は取得しません。</p>
    <div class="actions">
      <button :disabled="!supported || active || pending" @click="start">{{ pending ? '共有を選択中…' : '画面共有を開始' }}</button>
      <button :disabled="!active" @click="stop(); message = '画面共有を停止しました。'">共有を停止</button>
      <button :disabled="!active" @click="resetCrop">枠を全体に戻す</button>
    </div>
    <fieldset class="tracking-options">
      <legend>追跡対象（同時に有効にできます）</legend>
      <label><input v-model="poseSelected" type="checkbox" /> Pose（全身）</label>
      <label><input v-model="detailSelected.face" type="checkbox" /> Face（顔・表情）</label>
      <label><input v-model="detailSelected.hands" type="checkbox" /> Hand（手・指）</label>
    </fieldset>
    <div class="actions pose-actions">
      <label class="model-select">推定モデル
        <select v-model="poseModel" :disabled="!poseSelected">
          <option v-for="model in POSE_MODELS" :key="model.value" :value="model.value">{{ model.label }}（{{ model.description }}）</option>
        </select>
      </label>
      <button :disabled="!active || !anySelected || anyLoading || allReady" @click="startTracking">{{ anyLoading ? 'モデルを読み込み中…' : '追跡を開始' }}</button>
      <button :disabled="!trackingWanted" @click="stopTracking">追跡を停止</button>
    </div>
    <p class="hint">初期設定は Lite です。推定中に変更するとモデルを読み替えて再開します。モデルごとの初回読み込みにはダウンロードが必要です。Heavy は処理負荷が高く、FPS が下がる場合があります。</p>
    <p class="hint">顔・手だけの追跡も可能です。追跡中の ON／OFF はすぐ反映されます。同時に有効にするほど負荷が増えます。顔と手が十分な大きさに映るよう枠を調整してください。1 人を対象に使用してください。</p>
    <p aria-live="polite">Pose：{{ poseStatus }}</p>
    <p v-for="kind in kinds" :key="kind" aria-live="polite">{{ detailNames[kind] }}：{{ detailState[kind].status }} <span v-if="detailState[kind].enabled">／ {{ detailState[kind].fps }} FPS</span></p>
    <p v-if="!supported">画面共有には HTTPS または localhost と、Screen Capture API 対応ブラウザが必要です。PC の Chrome を推奨します。</p>
    <p role="status">{{ message }}</p>
    <div class="panels">
      <div class="source-panel">
        <h2>共有プレビュー</h2>
        <div class="preview" :class="{ inactive: !active }">
          <video ref="video" autoplay muted playsinline aria-label="共有映像" />
          <div v-if="active && size.width" class="selection" :style="frameStyle" tabindex="0" role="group" aria-label="切り出し枠。矢印キーで移動、Shift で10ピクセル移動"
            @pointerdown="begin($event)" @pointermove="move" @pointerup="gesture = undefined" @pointercancel="gesture = undefined" @lostpointercapture="gesture = undefined" @keydown="keyboard">
            <span class="handle" tabindex="0" role="button" data-resize="true" aria-label="枠のサイズ変更。矢印キーで調整"
              @pointerdown.stop="begin($event, true)" @keydown.stop="keyboard" />
          </div>
        </div>
      </div>
      <div>
        <h2>枠内の切り出し映像・ランドマーク</h2>
        <canvas ref="canvas" aria-label="切り出した映像" />
      </div>
      <VrmPreview :pose="vrmPose" :face="vrmFace" :hands="vrmHands" />
    </div>
    <p v-if="active">共有映像 {{ size.width }} × {{ size.height }} px ／ 枠 x={{ Math.round(crop.x) }}, y={{ Math.round(crop.y) }}, {{ Math.round(crop.width) }} × {{ Math.round(crop.height) }} px ／ 描画 {{ fps }} FPS <span v-if="poseEnabled">／ ポーズ推定 {{ poseFps }} FPS</span></p>
    <p class="hint">枠と右下のハンドルは、フォーカス後に矢印キーでも操作できます（Shift で10px）。FPS は切り出した映像の描画頻度です。</p>
    <p class="hint">Pose は全身 33 点、Face は顔 478 点の輪郭・目・口、Hand は片手 21 点を表示します。モデル・WASM は外部 CDN から取得しますが、映像は送信しません。</p>
    <p class="hint">MediaPipe（Apache License 2.0）を使用しています。
      <a :href="withBase('/licenses/mediapipe-LICENSE.txt')" target="_blank" rel="noopener">ライセンス</a>
      · <a href="https://github.com/google-ai-edge/mediapipe" target="_blank" rel="noopener">MediaPipe</a>
    </p>
  </section>
</template>

<style scoped>
.tracking-options { display: flex; flex-wrap: wrap; gap: 12px; border: 1px solid var(--vp-c-divider); padding: 8px 12px; margin-top: 16px; border-radius: 6px; }
.tracking-options label { display: flex; align-items: center; gap: 6px; }
.model-select { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
select { padding: 6px 10px; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); }
.pose-actions { margin-top: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
button { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 6px 12px; background: var(--vp-c-bg-soft); }
button:disabled { opacity: .45; cursor: not-allowed; }
button:enabled { cursor: pointer; }
.panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
h2 { font-size: 18px; margin-top: 20px; }
.source-panel { grid-column: 1 / -1; }
.source-panel .preview { max-width: 640px; margin-inline: auto; }
.preview { position: relative; line-height: 0; }
video, canvas { display: block; width: 100%; height: auto; background: #171923; }
.inactive { min-height: 160px; background: #171923; }
.inactive video { visibility: hidden; }
.selection { position: absolute; border: 2px solid #38bdf8; box-sizing: border-box; cursor: move; touch-action: none; }
.handle { position: absolute; right: -3px; bottom: -3px; width: 20px; height: 20px; background: #38bdf8; border: 2px solid white; cursor: nwse-resize; touch-action: none; }
.selection:focus-visible, .handle:focus-visible { outline: 3px solid #fbbf24; outline-offset: 3px; }
.hint { font-size: 13px; color: var(--vp-c-text-2); }
@media (max-width: 700px) { .panels { grid-template-columns: minmax(0, 1fr); } }
</style>
