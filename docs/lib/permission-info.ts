/**
 * What a page can read once the visitor says yes: the current position, the
 * camera and microphone, and the names of the devices.
 *
 * Unlike the other categories nothing here is read on load. Each value starts
 * out as "not asked yet" and only fills in after a button is pressed, so the
 * state of every request is part of the input (`Ask`). The browser-only work
 * (calling getCurrentPosition, getUserMedia, ...) is in permission-probes.ts;
 * this file only arranges the results into rows, so it runs in Node.
 */

import { fnv1a } from './hardware-info'
import type { Row, Section, Value } from './browser-info'

/** Where one request stands. `failed` carries the reason, already worded for the reader. */
export type Ask<T> =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'done'; value: T }
  | { status: 'failed'; message: string }

/** The answer of Permissions API for one name, or null where the browser cannot say. */
export type PermissionState = 'granted' | 'denied' | 'prompt'

export interface PositionInfo {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  heading: number | null
  speed: number | null
  /** Milliseconds since the epoch, as GeolocationPosition.timestamp. */
  timestamp: number
}

export interface CameraInfo {
  label: string
  width?: number
  height?: number
  frameRate?: number
  facingMode?: string
  /** The largest picture the camera offers, from getCapabilities(). */
  maxWidth?: number
  maxHeight?: number
}

export interface MicrophoneInfo {
  label: string
  sampleRate?: number
  channelCount?: number
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
}

export interface DeviceName {
  kind: string
  label: string
  deviceId: string
}

export interface Orientation {
  alpha: number
  beta: number
  gamma: number
}

export interface Motion {
  x: number
  y: number
  z: number
}

/** The latest reading of each motion sensor, or null while none has arrived. */
export interface SensorReadings {
  orientation: Orientation | null
  motion: Motion | null
}

export interface PermissionData {
  /** null for a name the browser does not know (Firefox has no 'camera'). */
  permissions: { geolocation: PermissionState | null; camera: PermissionState | null; microphone: PermissionState | null }
  geolocation: Ask<PositionInfo>
  camera: Ask<CameraInfo>
  microphone: Ask<MicrophoneInfo>
  /** null when enumerateDevices() is missing or gave up. */
  devices: DeviceName[] | null
  sensors: SensorReadings
}

// ---------------------------------------------------------------------------
// Wording the errors
// ---------------------------------------------------------------------------

/** GeolocationPositionError.code */
export function describePositionError(code: number): string {
  switch (code) {
    case 1:
      return '許可されなかった (ダイアログで拒否した、またはブラウザやOSの設定で禁止されている)'
    case 2:
      return '現在地を決められなかった (OSの位置情報サービスが切れている、または電波が届かない)'
    case 3:
      return '時間内に答えが返らなかった'
    default:
      return '現在地を取得できなかった'
  }
}

/** DOMException.name from getUserMedia(). */
export function describeMediaError(name: string): string {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '許可されなかった (ダイアログで拒否した、またはブラウザやOSの設定で禁止されている)'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return '使える機器が見つからなかった'
    case 'NotReadableError':
    case 'AbortError':
      return '機器を開けなかった (他のアプリが使っている、またはOSが使わせない)'
    case 'SecurityError':
      return 'このページには使わせない設定になっている (Permissions-Policy など)'
    case 'TypeError':
      return 'このブラウザ、または https でないページでは使えない'
    default:
      return `取得できなかった (${name})`
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

const NOT_ASKED = '未取得 (下のボタンで許可を求める)'

/**
 * The text for a value that is not there yet, depending on how the request
 * went. `unmeasured` is for a request that worked but left this field empty,
 * like the altitude on a PC without a barometer.
 */
function missingOf(ask: Ask<unknown>, unmeasured: string): string {
  switch (ask.status) {
    case 'idle':
      return NOT_ASKED
    case 'asking':
      return '許可を待っています…'
    case 'failed':
      return ask.message
    case 'done':
      return unmeasured
  }
}

/** A row whose value comes out of a finished request and is null until then. */
function askRow<T>(
  ask: Ask<T>,
  label: string,
  api: string,
  read: (value: T) => Value | undefined,
  options: { note?: string; unmeasured?: string } = {}
): Row {
  const value = ask.status === 'done' ? (read(ask.value) ?? null) : null
  return {
    label,
    api,
    value,
    missing: missingOf(ask, options.unmeasured ?? '取得できない (この機器は測っていない)'),
    note: options.note
  }
}

const PERMISSION_WORDS: Record<PermissionState, string> = {
  granted: 'granted (許可済み。JavaScriptは許可ダイアログなしでアクセスできる)',
  denied: 'denied (拒否済み。JavaScriptはアクセスできない)',
  prompt: 'prompt (未定。JavaScriptがアクセスしようとすると許可ダイアログが出る)'
}

function permissionRow(name: string, state: PermissionState | null): Row {
  return {
    label: '許可の状態',
    api: `(await navigator.permissions.query({ name: '${name}' })).state`,
    value: state ? PERMISSION_WORDS[state] : null,
    missing: '取得できない (このブラウザは調べさせない)',
    note: 'この状態そのものは、許可ダイアログなしで JavaScript から調べられる。「許可済み」のサイトなら、ページを開いただけでこの先の値に静かにアクセスされる。'
  }
}

function meters(n: number | undefined | null, digits = 0): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(digits)} m` : null
}

function degrees(n: number | null): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(1)}°` : null
}

export function geolocationSection(permission: PermissionState | null, ask: Ask<PositionInfo>): Section {
  const api = (field: string) => `position.coords.${field}`
  return {
    id: 'geolocation',
    title: '位置情報 (Geolocation)',
    rows: [
      permissionRow('geolocation', permission),
      askRow(ask, '緯度', api('latitude'), (p) => p.latitude.toFixed(6), {
        note: '地図に落とせば、家や職場まで分かる細かさ。'
      }),
      askRow(ask, '経度', api('longitude'), (p) => p.longitude.toFixed(6)),
      askRow(ask, '誤差の範囲', api('accuracy'), (p) => meters(p.accuracy), {
        note: 'GPS付きのスマホなら数m。PCはWi-Fiのアクセスポイントの位置やIPアドレスから推定するため、数十m〜数km。'
      }),
      askRow(ask, '高度', api('altitude'), (p) => meters(p.altitude, 1), {
        note: 'GPS付きの端末だけが答える。'
      }),
      askRow(ask, '進んでいる向き', api('heading'), (p) => degrees(p.heading), {
        note: '北を0°として時計回り。動いていないときや、測れない端末では取れない。'
      }),
      askRow(ask, '速さ', api('speed'), (p) => (p.speed === null ? null : `${p.speed.toFixed(1)} m/s`), {
        note: '歩いているのか、電車や車に乗っているのかまで分かる。'
      }),
      askRow(ask, '測った時刻', 'position.timestamp', (p) => new Date(p.timestamp).toLocaleString('ja-JP'))
    ]
  }
}

function facing(mode: string | undefined): string | null {
  if (mode === undefined) return null
  return { user: 'user (自分側のカメラ)', environment: 'environment (背面のカメラ)' }[mode] ?? mode
}

function size(width: number | undefined, height: number | undefined): string | null {
  return width !== undefined && height !== undefined ? `${width} × ${height}` : null
}

function onOff(value: boolean | undefined): string | null {
  return value === undefined ? null : value ? 'on' : 'off'
}

export function cameraSection(permission: PermissionState | null, ask: Ask<CameraInfo>): Section {
  const settings = (field: string) => `stream.getVideoTracks()[0].getSettings().${field}`
  return {
    id: 'camera',
    title: 'カメラ',
    rows: [
      permissionRow('camera', permission),
      {
        label: '映像の取得',
        api: 'await navigator.mediaDevices.getUserMedia({ video: true })',
        value: ask.status === 'done' ? '取得中 (映像はこの画面に出しているだけで、どこにも送っていない)' : null,
        missing: missingOf(ask, ''),
        note: '許可すると、ページは映像に1コマずつアクセスできる。写真の撮影も、顔の検出も、録画もできる。許可を切るまで、ページを開いている間ずっと撮れる。'
      },
      askRow(ask, '使っているカメラ', 'stream.getVideoTracks()[0].label', (c) => c.label || ''),
      askRow(ask, '映像の大きさ', 'getSettings().width, getSettings().height', (c) => size(c.width, c.height)),
      askRow(ask, 'フレームレート', settings('frameRate'), (c) =>
        c.frameRate === undefined ? null : `${Math.round(c.frameRate)} fps`
      ),
      askRow(ask, '出せる最大の大きさ', 'stream.getVideoTracks()[0].getCapabilities().width.max', (c) =>
        size(c.maxWidth, c.maxHeight)
      ),
      askRow(ask, '向き', settings('facingMode'), (c) => facing(c.facingMode), {
        note: 'スマホでは前面か背面か。PCのWebカメラは付いていないことが多い。'
      })
    ]
  }
}

export function microphoneSection(permission: PermissionState | null, ask: Ask<MicrophoneInfo>): Section {
  const settings = (field: string) => `stream.getAudioTracks()[0].getSettings().${field}`
  return {
    id: 'microphone',
    title: 'マイク',
    rows: [
      permissionRow('microphone', permission),
      {
        label: '音声の取得',
        api: 'await navigator.mediaDevices.getUserMedia({ audio: true })',
        value: ask.status === 'done' ? '取得中 (音量を測っているだけで、録音も送信もしていない)' : null,
        missing: missingOf(ask, ''),
        note: '許可すると、ページは音に1サンプルずつアクセスできる。録音も、音声認識も、周りの話し声の文字起こしもできる。'
      },
      askRow(ask, '使っているマイク', 'stream.getAudioTracks()[0].label', (m) => m.label || ''),
      askRow(ask, 'サンプリングレート', settings('sampleRate'), (m) =>
        m.sampleRate === undefined ? null : `${m.sampleRate} Hz`
      ),
      askRow(ask, 'チャンネル数', settings('channelCount'), (m) =>
        m.channelCount === undefined ? null : String(m.channelCount)
      ),
      askRow(ask, 'エコー除去・ノイズ抑制・自動音量調整', 'getSettings().echoCancellation など', (m) =>
        m.echoCancellation === undefined && m.noiseSuppression === undefined && m.autoGainControl === undefined
          ? null
          : [
              `echoCancellation: ${onOff(m.echoCancellation) ?? '-'}`,
              `noiseSuppression: ${onOff(m.noiseSuppression) ?? '-'}`,
              `autoGainControl: ${onOff(m.autoGainControl) ?? '-'}`
            ]
      )
    ]
  }
}

export const DEVICE_KINDS: { kind: string; label: string }[] = [
  { kind: 'videoinput', label: 'カメラの名前' },
  { kind: 'audioinput', label: 'マイクの名前' },
  { kind: 'audiooutput', label: 'スピーカー・ヘッドホンの名前' }
]

export function devicesSection(devices: DeviceName[] | null): Section {
  const named = (kind: string) => devices?.filter((d) => d.kind === kind && d.label !== '').map((d) => d.label)
  const unnamed = devices && devices.length > 0 && devices.every((d) => d.label === '')
  const rows: Row[] = DEVICE_KINDS.map(({ kind, label }) => {
    const labels = named(kind)
    return {
      label,
      api: `(await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === '${kind}').map(d => d.label)`,
      value: labels && labels.length > 0 ? labels : null,
      missing: !devices
        ? '取得できない (このブラウザは未対応、または https でないページ)'
        : unnamed
          ? '名前は空 (カメラかマイクを許可するとアクセスできる)'
          : '見つからなかった',
      note:
        kind === 'videoinput'
          ? '"Logitech C920"、"Integrated Camera" のように、機種名がそのまま見える。仮想カメラ(OBS など)を入れていることも分かる。'
          : kind === 'audiooutput'
            ? 'Bluetooth のヘッドホンやイヤホンの名前(= 持っている製品)まで出ることがある。'
            : undefined
    }
  })
  const ids = devices?.filter((d) => d.deviceId !== '').map((d) => d.deviceId)
  rows.push({
    label: '機器IDのハッシュ',
    api: 'device.deviceId',
    value: ids && ids.length > 0 ? fnv1a(ids.join(',')) : null,
    missing: devices ? '空 (許可するとアクセスできる)' : undefined,
    note: '機器IDはサイトごとに固定で、Cookie を消すまで変わらないので、同じ人かどうかを見分ける目印に使える。サイトが違えば別の値になる。'
  })
  return { id: 'device-names', title: '機器の名前', rows }
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

export function sensorsSection({ orientation, motion }: SensorReadings): Section {
  const missing = 'イベントが届いていません (センサーの無い端末か、許可が必要なブラウザ)'
  const n = (v: number) => (Number.isFinite(v) ? v.toFixed(1) : '-')
  return {
    id: 'sensors',
    title: '傾き・加速度センサー (スマホ)',
    rows: [
      {
        label: '傾き',
        api: "addEventListener('deviceorientation', e => [e.alpha, e.beta, e.gamma])",
        value: orientation ? `α ${n(orientation.alpha)}° / β ${n(orientation.beta)}° / γ ${n(orientation.gamma)}°` : null,
        missing,
        note: 'Android の Chrome では許可なしでアクセスできる。iOS では許可ダイアログが必要(上のボタン)。持ち方や手の震えにも人ごとの癖が出る。'
      },
      {
        label: '加速度 (重力込み)',
        api: "addEventListener('devicemotion', e => e.accelerationIncludingGravity)",
        value: motion ? `x ${n(motion.x)} / y ${n(motion.y)} / z ${n(motion.z)} m/s²` : null,
        missing
      }
    ]
  }
}

/** Every section of the permission category, in the order shown. */
export function collectPermission(data: PermissionData): Section[] {
  return [
    geolocationSection(data.permissions.geolocation, data.geolocation),
    cameraSection(data.permissions.camera, data.camera),
    microphoneSection(data.permissions.microphone, data.microphone),
    devicesSection(data.devices),
    sensorsSection(data.sensors)
  ]
}

/** All requests untouched, which is how the tab opens (and what it prerenders). */
export function initialPermissionData(): PermissionData {
  return {
    permissions: { geolocation: null, camera: null, microphone: null },
    geolocation: { status: 'idle' },
    camera: { status: 'idle' },
    microphone: { status: 'idle' },
    devices: null,
    sensors: { orientation: null, motion: null }
  }
}

/**
 * Loudness of one frame from an AnalyserNode's getByteTimeDomainData(), where
 * 128 is silence. Returns 0-100, scaled so that normal speech fills about half.
 */
export function levelOf(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128
    sum += v * v
  }
  return Math.min(100, Math.round(Math.sqrt(sum / samples.length) * 300))
}
