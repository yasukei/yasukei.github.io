<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import InfoPanel from './InfoPanel.vue'
import { BehaviorLog, SENSOR_WAIT_MS, describeElement, sensorPermissionMessage } from '../lib/behavior'
import type { Section } from '../lib/browser-info'

/**
 * Records how this page is being used from the moment it opens, and shows it
 * back. The table is redrawn on a timer rather than per event: pointermove
 * alone fires faster than the screen refreshes, and speeds have to fall back
 * to zero when nothing moves.
 */

const TICK_MS = 150

const log = new BehaviorLog()
const sections = ref<Section[]>([])
const trail = ref<HTMLCanvasElement | null>(null)
/** iOS (and now Chromium too) can hide the motion sensors until asked, from a click. */
const sensorsNeedAsking = ref(false)
const askingSensors = ref(false)
/** The outcome of the last request, shown beside the button. */
const sensorStatus = ref('')

interface PermissionAsking {
  requestPermission?: () => Promise<string>
}

/** getSelection() does not see inside text fields, so those are read separately. */
function selectedText(): string {
  const el = document.activeElement
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
  }
  return document.getSelection()?.toString() ?? ''
}

function scrollDepth(): number {
  const height = document.documentElement.scrollHeight
  return height > 0 ? (window.scrollY + window.innerHeight) / height : 0
}

const listeners: [EventTarget, string, (e: Event) => void][] = [
  [window, 'pointermove', (e) => log.move((e as PointerEvent).clientX, (e as PointerEvent).clientY, e.timeStamp)],
  [
    window,
    'click',
    (e) => {
      const m = e as MouseEvent
      const target = m.target instanceof Element ? describeElement(m.target) : '?'
      log.click(m.clientX, m.clientY, e.timeStamp, target)
    }
  ],
  [window, 'scroll', (e) => log.scroll(window.scrollY, scrollDepth(), e.timeStamp)],
  [
    window,
    'keydown',
    (e) => {
      const k = e as KeyboardEvent
      log.keyDown(k.key, k.code, e.timeStamp, k.repeat)
    }
  ],
  [window, 'keyup', (e) => log.keyUp((e as KeyboardEvent).code, e.timeStamp)],
  [document, 'selectionchange', () => log.select(selectedText())],
  [window, 'copy', () => log.copy(selectedText())],
  [window, 'paste', (e) => log.paste((e as ClipboardEvent).clipboardData?.getData('text') ?? '')],
  [document, 'visibilitychange', (e) => log.visibility(document.visibilityState, e.timeStamp)],
  [window, 'focus', (e) => log.focus(e.timeStamp)],
  [window, 'blur', (e) => log.blur(e.timeStamp)],
  [
    window,
    'deviceorientation',
    (e) => {
      const o = e as DeviceOrientationEvent
      if (o.alpha === null && o.beta === null && o.gamma === null) return
      log.orient(o.alpha ?? NaN, o.beta ?? NaN, o.gamma ?? NaN)
    }
  ],
  [
    window,
    'devicemotion',
    (e) => {
      const a = (e as DeviceMotionEvent).accelerationIncludingGravity
      if (!a || (a.x === null && a.y === null && a.z === null)) return
      log.accelerate(a.x ?? NaN, a.y ?? NaN, a.z ?? NaN)
    }
  ]
]

/** The trail on a picture of the viewport: older movement fades, clicks are dots. */
function draw(now: number) {
  const canvas = trail.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  const dpr = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
  }
  const sx = (width / window.innerWidth) * dpr
  const sy = (height / window.innerHeight) * dpr
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const color = getComputedStyle(canvas).color
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5 * dpr
  const points = log.trail
  for (let i = 1; i < points.length; i++) {
    const age = now - points[i].t
    ctx.globalAlpha = Math.max(0.08, 1 - age / 10000)
    ctx.beginPath()
    ctx.moveTo(points[i - 1].x * sx, points[i - 1].y * sy)
    ctx.lineTo(points[i].x * sx, points[i].y * sy)
    ctx.stroke()
  }

  ctx.globalAlpha = 1
  ctx.fillStyle = '#e5484d'
  for (const click of log.clicks.slice(-30)) {
    ctx.beginPath()
    ctx.arc(click.x * sx, click.y * sy, 3.5 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
}

function tick() {
  const now = performance.now()
  sections.value = log.sections(now)
  draw(now)
}

async function askSensors() {
  askingSensors.value = true
  sensorStatus.value = ''
  let answers: string[] | 'error'
  try {
    // Both asked before awaiting either: Safari only allows asking while the
    // click is fresh, and an await in between can use that up.
    const asking = [DeviceOrientationEvent, typeof DeviceMotionEvent === 'undefined' ? undefined : DeviceMotionEvent]
      .map((type) => (type as unknown as PermissionAsking | undefined)?.requestPermission?.())
      .filter((answer): answer is Promise<string> => answer !== undefined)
    answers = await Promise.all(asking)
  } catch {
    answers = 'error'
  }
  if (answers !== 'error' && answers.every((answer) => answer === 'granted') && !log.sensed) {
    await new Promise((resolve) => setTimeout(resolve, SENSOR_WAIT_MS))
  }
  sensorStatus.value = sensorPermissionMessage(answers, log.sensed)
  askingSensors.value = false
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn, { passive: true })
  log.scroll(window.scrollY, scrollDepth(), performance.now())
  sensorsNeedAsking.value =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof (DeviceOrientationEvent as unknown as PermissionAsking).requestPermission === 'function'
  tick()
  timer = setInterval(tick, TICK_MS)
})

onBeforeUnmount(() => {
  for (const [target, type, fn] of listeners) target.removeEventListener(type, fn)
  clearInterval(timer)
})
</script>

<template>
  <InfoPanel :sections="sections">
    <div class="bt-demo">
      <figure class="bt-figure">
        <canvas ref="trail" class="bt-trail" role="img" aria-label="マウスの軌跡とクリックした場所"></canvas>
        <figcaption class="bt-caption">ページが受け取ったマウスの軌跡(画面全体の縮図)。赤い点はクリックした場所。</figcaption>
      </figure>
      <label class="bt-input">
        <span class="bt-caption">送信ボタンのない入力欄です。何か入力したり貼り付けたりしてみてください。</span>
        <textarea
          class="bt-textarea"
          aria-label="試しに入力する欄"
          placeholder="ここに入力…"
          spellcheck="false"
          @input="log.input(($event.target as HTMLTextAreaElement).value)"
        />
      </label>
    </div>
    <template #before-sensors>
      <div v-if="sensorsNeedAsking" class="bt-sensors">
        <button class="bt-btn" :disabled="askingSensors" @click="askSensors">傾き・加速度センサーの許可をリクエスト</button>
        <span class="bt-status" role="status">{{ askingSensors ? '確認中…' : sensorStatus }}</span>
      </div>
    </template>
  </InfoPanel>
</template>

<style scoped>
.bt-demo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

@media (max-width: 640px) {
  .bt-demo {
    grid-template-columns: 1fr;
  }
}

.bt-figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bt-trail {
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1);
}

.bt-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bt-textarea {
  flex: 1;
  min-height: 120px;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  resize: vertical;
}

.bt-caption {
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.bt-sensors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.bt-status {
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.bt-btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.bt-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
