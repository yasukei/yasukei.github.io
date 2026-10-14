<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import InfoPanel from './InfoPanel.vue'
import { BehaviorLog, describeElement } from '../lib/behavior'
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

type Listener = [EventTarget, string, (e: Event) => void]

// Built when mounted: the page is prerendered at build time, where there is
// no window or document to listen to.
let listeners: Listener[] = []

function makeListeners(): Listener[] {
  return [
    [window, 'pointermove', (e) => log.move((e as PointerEvent).clientX, (e as PointerEvent).clientY, e.timeStamp)],
    [
      window,
      'click',
      (e) => {
        const m = e as MouseEvent
        const target = m.target instanceof Element ? describeElement(m.target) : '?'
        // A click made with Enter or Space has detail 0 and no position (0, 0).
        log.click(m.detail === 0 ? null : { x: m.clientX, y: m.clientY }, e.timeStamp, target)
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
    [window, 'blur', (e) => log.blur(e.timeStamp)]
  ]
}

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
  for (const { at } of log.clicks.slice(-30)) {
    if (!at) continue
    ctx.beginPath()
    ctx.arc(at.x * sx, at.y * sy, 3.5 * dpr, 0, Math.PI * 2)
    ctx.fill()
  }
}

function tick() {
  const now = performance.now()
  sections.value = log.sections(now)
  draw(now)
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  listeners = makeListeners()
  for (const [target, type, fn] of listeners) target.addEventListener(type, fn, { passive: true })
  log.scroll(window.scrollY, scrollDepth(), performance.now())
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
</style>
