/**
 * What a page can record about how it is being used: where the mouse goes,
 * how far and how fast the page is scrolled, the rhythm of typing, what is
 * selected, copied and pasted, when the tab is left, and the motion sensors.
 *
 * `BehaviorLog` is fed plain values (the component unpacks the DOM events)
 * with the event's timestamp in milliseconds, and turns what it has seen so
 * far into sections. It never reads a clock itself, so tests can play events
 * at exact times.
 */

import type { Section } from './browser-info'

export interface Point {
  x: number
  y: number
  t: number
}

export interface Click extends Point {
  target: string
}

export interface KeyStroke {
  key: string
  /** How long the key was held down. */
  dwell: number
  /** Time from the previous key's release to this key's press; null after a pause. */
  flight: number | null
}

/** Speed is measured over this much of the most recent movement. */
const SPEED_WINDOW_MS = 300
/** A gap this long between keys is a pause, not part of the typing rhythm. */
const PAUSE_MS = 2000
const TRAIL_LENGTH = 500
const KEYS_KEPT = 200
const RECENT_KEYS_SHOWN = 8
const TEXT_SHOWN = 200

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Pixels per second over the points in the last SPEED_WINDOW_MS before `now`. */
export function speedOf(points: readonly { t: number; d: number }[], now: number): number {
  const recent = points.filter((p) => now - p.t <= SPEED_WINDOW_MS)
  const distance = recent.reduce((sum, p) => sum + p.d, 0)
  return (distance / SPEED_WINDOW_MS) * 1000
}

/** Long text cut short for display, with whitespace runs folded so it fits a row. */
export function clip(text: string, max = TEXT_SHOWN): string {
  const folded = text.replace(/\s+/g, ' ')
  return folded.length > max ? `${folded.slice(0, max)}…` : folded
}

export interface ElementLike {
  tagName: string
  id?: string
  className?: unknown
  textContent?: string | null
}

/** e.g. `button.bi-btn "再取得"`: enough to see which thing was clicked. */
export function describeElement(el: ElementLike): string {
  let out = el.tagName.toLowerCase()
  if (el.id) out += `#${el.id}`
  // SVG elements have an SVGAnimatedString here, not a string.
  const firstClass = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''
  if (firstClass) out += `.${firstClass}`
  const text = clip(el.textContent ?? '', 20).trim()
  return text ? `${out} "${text}"` : out
}

/** How a key is shown: the space bar and other invisible keys get a name. */
export function keyLabel(key: string): string {
  if (key === ' ') return '␣'
  return key
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} 秒`
}

function round(n: number | null): number | null {
  return n === null ? null : Math.round(n)
}

/** How long to wait for a first sensor reading after permission is granted. */
export const SENSOR_WAIT_MS = 1000

/**
 * What to say after asking for the motion sensors. No API tells whether the
 * device has the sensors, so it is told by whether readings arrive once they
 * are allowed: a desktop grants the permission and then simply sends nothing.
 *
 * `answers` are what each requestPermission() resolved to, or 'error' if asking
 * failed outright.
 */
export function sensorPermissionMessage(answers: string[] | 'error', sensed: boolean): string {
  if (answers === 'error') return '許可をリクエストできませんでした。'
  if (answers.some((answer) => answer !== 'granted')) return '許可されませんでした。'
  if (sensed) return '許可されました。'
  return `許可されましたが、${SENSOR_WAIT_MS / 1000}秒待ってもセンサーの値が届きません。この端末にはセンサーが付いていないようです。`
}

export class BehaviorLog {
  /** Every movement, with the distance from the one before it. */
  readonly trail: (Point & { d: number })[] = []
  readonly clicks: Click[] = []
  private distance = 0

  private scrollY: number | null = null
  private maxDepth = 0
  private readonly scrolls: { t: number; d: number }[] = []

  readonly keys: KeyStroke[] = []
  private readonly down = new Map<string, { key: string; t: number }>()
  private lastUp: number | null = null
  private pressed = 0
  private typed = ''

  private selection = ''
  private copied: string | null = null
  private pasted: string | null = null

  private hiddenCount = 0
  private hiddenSince: number | null = null
  private hiddenTotal = 0
  private blurCount = 0
  private lastEvent: { what: string; t: number } | null = null

  private orientation: { alpha: number; beta: number; gamma: number } | null = null
  private motion: { x: number; y: number; z: number } | null = null

  move(x: number, y: number, t: number): void {
    const last = this.trail[this.trail.length - 1]
    const d = last ? Math.hypot(x - last.x, y - last.y) : 0
    this.distance += d
    this.trail.push({ x, y, t, d })
    if (this.trail.length > TRAIL_LENGTH) this.trail.shift()
  }

  click(x: number, y: number, t: number, target: string): void {
    this.clicks.push({ x, y, t, target })
  }

  /** `depth` is how much of the page has been on screen, from 0 to 1. */
  scroll(y: number, depth: number, t: number): void {
    if (this.scrollY !== null) this.scrolls.push({ t, d: Math.abs(y - this.scrollY) })
    if (this.scrolls.length > TRAIL_LENGTH) this.scrolls.shift()
    this.scrollY = y
    this.maxDepth = Math.max(this.maxDepth, Math.min(1, depth))
  }

  keyDown(key: string, code: string, t: number, repeat: boolean): void {
    // Holding a key down repeats keydown; only the first press is a keystroke.
    if (repeat || this.down.has(code)) return
    this.down.set(code, { key, t })
    this.pressed++
  }

  keyUp(code: string, t: number): void {
    const pressed = this.down.get(code)
    if (!pressed) return
    this.down.delete(code)
    const flight = this.lastUp === null ? null : pressed.t - this.lastUp
    this.keys.push({
      key: pressed.key,
      dwell: t - pressed.t,
      flight: flight !== null && flight >= 0 && flight < PAUSE_MS ? flight : null
    })
    if (this.keys.length > KEYS_KEPT) this.keys.shift()
    this.lastUp = t
  }

  input(text: string): void {
    this.typed = text
  }

  select(text: string): void {
    this.selection = text
  }

  copy(text: string): void {
    this.copied = text
  }

  paste(text: string): void {
    this.pasted = text
  }

  visibility(state: string, t: number): void {
    if (state === 'hidden' && this.hiddenSince === null) {
      this.hiddenCount++
      this.hiddenSince = t
      this.lastEvent = { what: '他のタブに切り替えた', t }
    } else if (state === 'visible' && this.hiddenSince !== null) {
      this.hiddenTotal += t - this.hiddenSince
      this.hiddenSince = null
      this.lastEvent = { what: 'タブに戻ってきた', t }
    }
  }

  focus(t: number): void {
    this.lastEvent = { what: 'ウィンドウにフォーカスが戻った', t }
  }

  blur(t: number): void {
    this.blurCount++
    this.lastEvent = { what: 'フォーカスが外れた', t }
  }

  orient(alpha: number, beta: number, gamma: number): void {
    this.orientation = { alpha, beta, gamma }
  }

  accelerate(x: number, y: number, z: number): void {
    this.motion = { x, y, z }
  }

  /** Whether any sensor reading has arrived at all. */
  get sensed(): boolean {
    return this.orientation !== null || this.motion !== null
  }

  sections(now: number): Section[] {
    return [
      this.mouseSection(now),
      this.scrollSection(now),
      this.keySection(),
      this.clipboardSection(),
      this.tabSection(now),
      this.sensorSection()
    ]
  }

  private mouseSection(now: number): Section {
    const last = this.trail[this.trail.length - 1]
    const click = this.clicks[this.clicks.length - 1]
    return {
      id: 'mouse',
      title: 'マウス・タッチ',
      rows: [
        {
          label: '今の位置',
          api: "addEventListener('pointermove', e => [e.clientX, e.clientY])",
          value: last ? `${Math.round(last.x)}, ${Math.round(last.y)}` : null,
          missing: 'まだ動いていません',
          note: '動かし方の癖(速さ、加速の仕方、まっすぐ動かすか、ボタンの手前で減速するか)は人ごとに違い、ボット検知や本人の識別に使われる。上の図が、ページが受け取っている軌跡そのもの。'
        },
        {
          label: '動かした距離',
          api: '前の位置との距離を足していく',
          value: `${Math.round(this.distance)} px`
        },
        {
          label: '今の速さ',
          api: '',
          value: `${Math.round(speedOf(this.trail, now))} px/秒`
        },
        {
          label: 'クリックした回数',
          api: "addEventListener('click', ...)",
          value: `${this.clicks.length} 回`
        },
        {
          label: '最後にクリックした場所',
          api: 'e.clientX, e.clientY, e.target',
          value: click ? `${Math.round(click.x)}, ${Math.round(click.y)} の ${click.target}` : null,
          missing: 'まだクリックしていません',
          note: 'どの要素を押したかも分かる。'
        }
      ]
    }
  }

  private scrollSection(now: number): Section {
    return {
      id: 'scroll',
      title: 'スクロール',
      rows: [
        {
          label: 'スクロール位置',
          api: 'window.scrollY',
          value: this.scrollY === null ? null : `${Math.round(this.scrollY)} px`,
          missing: 'まだ記録していません'
        },
        {
          label: 'ページのどこまで見たか',
          api: '(scrollY + innerHeight) / scrollHeight の最大値',
          value: `${Math.round(this.maxDepth * 100)}%`,
          note: '記事がどこまで読まれたか(読了率)を測るのに、ごく普通に使われている。'
        },
        {
          label: 'スクロールの速さ',
          api: '',
          value: `${Math.round(speedOf(this.scrolls, now))} px/秒`,
          note: '流し読みしているか、じっくり読んでいるかの手がかりになる。'
        }
      ]
    }
  }

  private keySection(): Section {
    const dwell = round(mean(this.keys.map((k) => k.dwell)))
    const flights = this.keys.map((k) => k.flight).filter((f): f is number => f !== null)
    const flight = round(mean(flights))
    const recent = this.keys.slice(-RECENT_KEYS_SHOWN).reverse()
    return {
      id: 'keys',
      title: 'キー入力',
      rows: [
        {
          label: '入力欄の中身 (送信前)',
          api: "addEventListener('input', e => e.target.value)",
          value: clip(this.typed),
          note: '送信ボタンを押さなくても、1文字打つごとにページ側は読める。入力途中で閉じたフォームの中身を送信していたサイトが見つかったという研究もある。'
        },
        {
          label: 'キーを押した回数',
          api: "addEventListener('keydown', ...)",
          value: `${this.pressed} 回`,
          note: '入力欄の外で押したキーも、このページにいる限りすべて届く。'
        },
        {
          label: 'キーを押している時間の平均',
          api: 'keyup の時刻 - keydown の時刻',
          value: dwell === null ? null : `${dwell} ms`,
          missing: 'まだキー入力がありません',
          note: 'キーを押している時間と、キーからキーへの間隔のリズムは人ごとに違う(キーストロークダイナミクス)。パスワードが合っていても「打ち方が本人と違う」と判定する仕組みに使われる。'
        },
        {
          label: 'キーとキーの間隔の平均',
          api: '次の keydown - 前の keyup',
          value: flight === null ? null : `${flight} ms`,
          missing: 'まだキー入力がありません',
          note: `${PAUSE_MS / 1000}秒以上空いたところは、考えている時間として除いている。`
        },
        {
          label: '最近のキー',
          api: 'e.key',
          value:
            recent.length === 0
              ? null
              : recent.map(
                  (k) => `${keyLabel(k.key)}  押下 ${Math.round(k.dwell)}ms / 間隔 ${k.flight === null ? '-' : `${Math.round(k.flight)}ms`}`
                ),
          missing: 'まだキー入力がありません'
        }
      ]
    }
  }

  private clipboardSection(): Section {
    return {
      id: 'clipboard',
      title: '選択・コピー・貼り付け',
      rows: [
        {
          label: '選択中のテキスト',
          api: 'document.getSelection().toString()',
          value: clip(this.selection),
          note: 'ページ上の文字をドラッグで選ぶと、選んだそばから読める。'
        },
        {
          label: '最後にコピーした内容',
          api: "addEventListener('copy', ...)",
          value: this.copied === null ? null : clip(this.copied),
          missing: 'まだコピーしていません',
          note: 'コピーした瞬間が分かるだけでなく、コピーされる内容をページが書き換えることもできる(貼り付けると「続きはこちら: URL」が付いてくるのはこれ)。'
        },
        {
          label: '最後に貼り付けた内容',
          api: "addEventListener('paste', e => e.clipboardData.getData('text'))",
          value: this.pasted === null ? null : clip(this.pasted),
          missing: 'まだ貼り付けていません',
          note: 'このページに貼り付けたものは読める。ページの外でコピーしたものを、貼り付けなしに勝手に読むには許可が必要。'
        }
      ]
    }
  }

  private tabSection(now: number): Section {
    const hidden = this.hiddenTotal + (this.hiddenSince === null ? 0 : now - this.hiddenSince)
    return {
      id: 'tab',
      title: 'タブの切り替え・フォーカスの記録',
      rows: [
        {
          label: '他のタブに切り替えた回数',
          api: "addEventListener('visibilitychange', ...)",
          value: `${this.hiddenCount} 回`,
          note: '他のタブを見てから戻ってくると増える。オンライン試験の不正検知や、動画広告が本当に見られたかの判定に使われる。'
        },
        {
          label: '他のタブにいた時間の合計',
          api: 'hidden になってから visible に戻るまで',
          value: seconds(hidden)
        },
        {
          label: 'フォーカスが外れた回数',
          api: "addEventListener('blur', ...)",
          value: `${this.blurCount} 回`,
          note: '別のアプリをクリックしたときなど、タブは見えたままでも数えられる。'
        },
        {
          label: '最後の出来事',
          api: '',
          value: this.lastEvent ? `${this.lastEvent.what} (${seconds(now - this.lastEvent.t)}前)` : null,
          missing: 'まだありません'
        }
      ]
    }
  }

  private sensorSection(): Section {
    const missing = 'イベントが届いていません (センサーの無い端末か、許可が必要なブラウザ)'
    const o = this.orientation
    const m = this.motion
    const n = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
    return {
      id: 'sensors',
      title: '傾き・加速度センサー (スマホ)',
      rows: [
        {
          label: '傾き',
          api: "addEventListener('deviceorientation', e => [e.alpha, e.beta, e.gamma])",
          value: o ? `α ${n(o.alpha)}° / β ${n(o.beta)}° / γ ${n(o.gamma)}°` : null,
          missing,
          note: 'Android の Chrome では許可なしで届く。iOS では許可ダイアログが必要(上のボタン)。持ち方や手の震えにも人ごとの癖が出る。'
        },
        {
          label: '加速度 (重力込み)',
          api: "addEventListener('devicemotion', e => e.accelerationIncludingGravity)",
          value: m ? `x ${n(m.x)} / y ${n(m.y)} / z ${n(m.z)} m/s²` : null,
          missing
        }
      ]
    }
  }
}
