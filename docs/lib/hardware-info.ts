/**
 * What a page can read about the hardware without asking for permission.
 *
 * Like browser-info.ts this only arranges values into sections of rows. The
 * values that have to be produced by drawing or rendering something (canvas,
 * WebGL, audio) or by awaiting an API come in as `HardwareProbes`, gathered by
 * hardware-probes.ts in a real browser, so everything here can be tested in
 * Node with plain objects.
 */

import {
  bool,
  joinName,
  mediaRow,
  str,
  type MatchMedia,
  type MediaFeature,
  type Section,
  type Value
} from './browser-info'

/** navigator.connection, which only Chromium has. */
export interface ConnectionLike {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  type?: string
}

/** The part of `navigator` read here. The real `navigator` is assignable to it. */
export interface HardwareNavigator {
  hardwareConcurrency?: number
  deviceMemory?: number
  maxTouchPoints?: number
  connection?: ConnectionLike
}

export interface ScreenLike {
  width: number
  height: number
  availWidth: number
  availHeight: number
  colorDepth: number
  orientation?: { type: string }
}

export interface WebGLInfo {
  version: string
  vendor: string
  renderer: string
  /** From WEBGL_debug_renderer_info, which not every browser exposes. */
  unmaskedVendor: string | null
  unmaskedRenderer: string | null
  maxTextureSize: number
  extensions: string[]
}

export interface WebGPUInfo {
  vendor: string
  architecture: string
  description: string
}

/** Something drawn off screen: a hash of the result and the picture itself. */
export interface ImageProbe {
  hash: string
  image: string
}

export interface AudioProbe {
  /** Sum of the absolute sample values at the end of the rendered buffer. */
  sum: number
  hash: string
}

export interface DeviceCounts {
  videoinput: number
  audioinput: number
  audiooutput: number
  /** Devices whose label is not empty, i.e. that the page was allowed to name. */
  labelled: number
}

export interface BatteryInfo {
  level: number
  charging: boolean
  chargingTime: number
  dischargingTime: number
}

/** null means the probe found nothing: the API is missing, refused, or timed out. */
export interface HardwareProbes {
  webgl: WebGLInfo | null
  webglImage: ImageProbe | null
  webgpu: WebGPUInfo | null
  canvas: ImageProbe | null
  audio: AudioProbe | null
  devices: DeviceCounts | null
  battery: BatteryInfo | null
}

export interface HardwareEnv {
  nav: HardwareNavigator
  screen: ScreenLike
  devicePixelRatio: number
  matchMedia: MatchMedia
  probes: HardwareProbes
}

/**
 * 32-bit FNV-1a, as 8 hex digits. Not for security: it only has to turn a long
 * rendering result into something short enough to compare by eye.
 * Strings are hashed by UTF-16 code unit, numbers as bytes.
 */
export function fnv1a(input: string | ArrayLike<number>): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= typeof input === 'string' ? input.charCodeAt(i) : input[i]
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Battery times are in seconds, and Infinity when the browser cannot tell,
 * which is also what it says while not charging (chargingTime) or while
 * charging (dischargingTime).
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '不明 (Infinity)'
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}時間${m}分` : `${m}分`
}

function num(value: unknown, unit = ''): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}${unit}` : null
}

// ---------------------------------------------------------------------------

export function cpuMemorySection(nav: HardwareNavigator): Section {
  return {
    id: 'cpu-memory',
    title: 'CPU・メモリ',
    rows: [
      {
        label: 'CPUの論理コア数',
        api: 'navigator.hardwareConcurrency',
        value: num(nav.hardwareConcurrency),
        note: 'ハイパースレッディングを含めたスレッド数。プライバシー保護の強いブラウザや設定では、実際より少ない値や固定値を返す。'
      },
      {
        label: 'メモリ量の目安',
        api: 'navigator.deviceMemory',
        value: num(nav.deviceMemory, ' GB'),
        note: '実際の量ではなく、2の累乗(… / 4 / 8 / 16 / 32)に丸めた値。上限で頭打ちにもされ、上限はブラウザのバージョンで変わる(以前は 8GB だった)。Chrome系のみ。'
      }
    ]
  }
}

export const SCREEN_FEATURES: MediaFeature[] = [
  {
    label: '色域',
    feature: 'color-gamut',
    // Cumulative: a P3 display matches srgb too, so the widest goes first.
    values: ['rec2020', 'p3', 'srgb'],
    note: 'p3 なら最近の Mac や iPhone のような広色域ディスプレイ。'
  },
  {
    label: 'HDR',
    feature: 'dynamic-range',
    values: ['high', 'standard']
  }
]

export function screenSection(screen: ScreenLike, devicePixelRatio: number, matchMedia: MatchMedia): Section {
  const physical = (n: number) => Math.round(n * devicePixelRatio)
  return {
    id: 'screen',
    title: '画面',
    rows: [
      {
        label: '画面解像度',
        api: 'screen.width × screen.height',
        value: `${screen.width} × ${screen.height}`,
        note: 'OSの拡大設定で割った後の大きさ(CSSピクセル)。'
      },
      {
        label: '拡大率',
        api: 'window.devicePixelRatio',
        value: String(devicePixelRatio),
        note: 'OSの拡大設定 × ブラウザのズーム。ズーム(Ctrl + / Ctrl -)してから「再取得」すると変わる。'
      },
      {
        label: '物理ピクセル数 (推定)',
        api: 'screen.width * devicePixelRatio',
        value: `${physical(screen.width)} × ${physical(screen.height)}`,
        note: '画面解像度 × 拡大率。ブラウザをズームしているとずれる。'
      },
      {
        label: '利用可能領域',
        api: 'screen.availWidth × screen.availHeight',
        value: `${screen.availWidth} × ${screen.availHeight}`,
        note: 'タスクバー、Dock、メニューバーを除いた範囲。'
      },
      {
        label: 'タスクバーなどの大きさ',
        api: 'screen.width - screen.availWidth, screen.height - screen.availHeight',
        value: `横 ${screen.width - screen.availWidth}px / 縦 ${screen.height - screen.availHeight}px`,
        note: 'この差からタスクバーの位置や大きさ、OSの見当がつく(Windows 11 のタスクバーは48px前後、macOS のメニューバーは25px前後など)。'
      },
      {
        label: '色深度',
        api: 'screen.colorDepth',
        value: `${screen.colorDepth} bit`
      },
      {
        label: '画面の向き',
        api: 'screen.orientation.type',
        value: str(screen.orientation?.type)
      },
      ...SCREEN_FEATURES.map((feature) => mediaRow(matchMedia, feature))
    ]
  }
}

export const INPUT_FEATURES: MediaFeature[] = [
  {
    label: '主なポインタ',
    feature: 'pointer',
    values: ['fine', 'coarse', 'none'],
    note: 'fine はマウスやペン、coarse は指。'
  },
  {
    label: 'ホバーできるか',
    feature: 'hover',
    values: ['hover', 'none']
  },
  {
    label: '使えるポインタすべて',
    feature: 'any-pointer',
    values: ['fine', 'coarse'],
    all: true,
    note: 'タッチパネル付きのノートPCなら両方が出る。'
  }
]

export function inputSection(nav: HardwareNavigator, matchMedia: MatchMedia): Section {
  return {
    id: 'input',
    title: 'タッチ・ポインタ',
    rows: [
      {
        label: '同時にタッチできる点の数',
        api: 'navigator.maxTouchPoints',
        value: num(nav.maxTouchPoints),
        note: '0 ならタッチ非対応。iPad は Mac と同じ UA を名乗るが、ここが 5 になるので見分けられる。'
      },
      ...INPUT_FEATURES.map((feature) => mediaRow(matchMedia, feature))
    ]
  }
}

export function gpuSection(webgl: WebGLInfo | null, webgpu: WebGPUInfo | null): Section {
  const debug = "gl.getExtension('WEBGL_debug_renderer_info')"
  const adapter = webgpu ? [webgpu.vendor, webgpu.architecture, webgpu.description].filter(Boolean) : null
  return {
    id: 'gpu',
    title: 'GPU',
    rows: [
      {
        label: 'GPUの機種',
        api: `gl.getParameter(${debug}.UNMASKED_RENDERER_WEBGL)`,
        value: webgl?.unmaskedRenderer ?? null,
        note: 'Chrome / Edge では "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 ...)" のように型番まで出る。Firefox は大まかな名前に丸め、Safari は "Apple GPU" とだけ答える。'
      },
      {
        label: 'GPUのベンダー',
        api: `gl.getParameter(${debug}.UNMASKED_VENDOR_WEBGL)`,
        value: webgl?.unmaskedVendor ?? null
      },
      {
        label: 'WebGLのバージョン',
        api: 'gl.getParameter(gl.VERSION)',
        value: webgl?.version ?? null
      },
      {
        label: '標準のベンダー / レンダラー',
        api: 'gl.getParameter(gl.VENDOR) / gl.getParameter(gl.RENDERER)',
        value: webgl ? `${webgl.vendor} / ${webgl.renderer}` : null,
        note: '拡張機能を使わない方の値。ブラウザによってはこちらにも機種名が入る。'
      },
      {
        label: '最大テクスチャサイズ',
        api: 'gl.getParameter(gl.MAX_TEXTURE_SIZE)',
        value: webgl ? `${webgl.maxTextureSize} px` : null
      },
      {
        label: '対応している拡張機能',
        api: 'gl.getSupportedExtensions()',
        value: webgl ? `${webgl.extensions.length}個 (ハッシュ ${fnv1a(webgl.extensions.join(','))})` : null,
        note: 'GPU・ドライバ・ブラウザの組み合わせで変わる。一覧のハッシュだけでもかなり絞り込める。'
      },
      {
        label: 'WebGPUのアダプタ',
        api: '(await navigator.gpu.requestAdapter()).info',
        value: adapter && adapter.length > 0 ? adapter : null,
        note: 'WebGPU 対応ブラウザのみ。GPUのベンダーと世代(例: nvidia / ampere)が分かる。'
      }
    ]
  }
}

export function renderingSection(
  canvas: ImageProbe | null,
  webglImage: ImageProbe | null,
  audio: AudioProbe | null
): Section {
  return {
    id: 'rendering',
    title: '描画・音声処理の微妙な差',
    rows: [
      {
        label: 'Canvasの描画結果',
        api: 'canvas.toDataURL()',
        value: canvas?.hash ?? null,
        image: canvas?.image,
        note: '同じ文字と図形を描いても、フォント、アンチエイリアス、GPUの違いでピクセル単位の差が出る。このハッシュを別のPCやブラウザと比べると違う値になる。Brave などはわざとノイズを混ぜて対策している。'
      },
      {
        label: 'WebGLの描画結果',
        api: 'gl.readPixels(...)',
        value: webglImage?.hash ?? null,
        image: webglImage?.image,
        note: 'シェーダーで色を計算させた結果。GPUやドライバごとに小数点の丸め方がわずかに違う。'
      },
      {
        label: 'AudioContextの処理結果',
        api: 'new OfflineAudioContext(1, 5000, 44100).startRendering()',
        value: audio ? [`合計 ${audio.sum}`, `ハッシュ ${audio.hash}`] : null,
        note: '音は鳴らさず、発振器とコンプレッサーで作った波形を計算だけさせる。浮動小数点演算のわずかな差が、OS・CPU・ブラウザごとに違う値として出る。'
      }
    ]
  }
}

export function devicesSection(devices: DeviceCounts | null): Section {
  const count = (n: number | undefined): Value => (n === undefined ? null : `${n} 台`)
  const total = devices ? devices.videoinput + devices.audioinput + devices.audiooutput : 0
  const kind = (k: string) => `enumerateDevices() で kind === '${k}'`
  return {
    id: 'devices',
    title: 'カメラ・マイク・スピーカー',
    rows: [
      { label: 'カメラ', api: kind('videoinput'), value: count(devices?.videoinput) },
      { label: 'マイク', api: kind('audioinput'), value: count(devices?.audioinput) },
      {
        label: 'スピーカー',
        api: kind('audiooutput'),
        value: count(devices?.audiooutput),
        note: 'Firefox などは許可前はスピーカーを一覧に出さないことがある。'
      },
      {
        label: '名前が取れたもの',
        api: 'device.label',
        value: devices ? `${devices.labelled} / ${total}` : null,
        note: '許可していないサイトでは名前(label)は空文字になる。ブラウザによっては許可前は種類ごとに1台だけに見せるなど、台数もぼかしている。'
      }
    ]
  }
}

export function batterySection(battery: BatteryInfo | null): Section {
  const api = (field: string) => `(await navigator.getBattery()).${field}`
  return {
    id: 'battery',
    title: 'バッテリー (Chrome系のみ)',
    rows: [
      {
        label: '残量',
        api: api('level'),
        value: battery ? `${Math.round(battery.level * 100)}%` : null,
        note: 'デスクトップPCは「100%・充電中」と答える。残量と残り時間の組み合わせが、短い間なら別々のサイトで同じ人を結びつける材料になると指摘され、Firefox と Safari は削除した。'
      },
      { label: '充電中か', api: api('charging'), value: bool(battery?.charging) },
      {
        label: '満充電までの時間',
        api: api('chargingTime'),
        value: battery ? formatDuration(battery.chargingTime) : null
      },
      {
        label: '空になるまでの時間',
        api: api('dischargingTime'),
        value: battery ? formatDuration(battery.dischargingTime) : null
      }
    ]
  }
}

export function networkSection(connection: ConnectionLike | undefined): Section {
  const api = (field: string) => `navigator.connection.${field}`
  return {
    id: 'network',
    title: '回線 (Chrome系のみ)',
    rows: [
      {
        label: '回線の速さの区分',
        api: api('effectiveType'),
        value: str(connection?.effectiveType),
        note: 'slow-2g / 2g / 3g / 4g。実測から推定した区分なので、光回線でも "4g" と出る。'
      },
      {
        label: '下り速度の目安',
        api: api('downlink'),
        value: num(connection?.downlink, ' Mbps'),
        note: '細かく分からないように丸められ、10Mbps で頭打ちになる。'
      },
      {
        label: '往復遅延の目安',
        api: api('rtt'),
        value: num(connection?.rtt, ' ms'),
        note: '25ms 単位に丸められる。'
      },
      { label: 'データセーバー', api: api('saveData'), value: bool(connection?.saveData) },
      {
        label: '接続の種類',
        api: api('type'),
        value: str(connection?.type),
        note: 'wifi / cellular / ethernet など。主に Android でのみ取れる。'
      }
    ]
  }
}

/** Every section of the hardware category, in the order shown. */
export function collectHardware(env: HardwareEnv): Section[] {
  const { probes } = env
  return [
    cpuMemorySection(env.nav),
    screenSection(env.screen, env.devicePixelRatio, env.matchMedia),
    inputSection(env.nav, env.matchMedia),
    gpuSection(probes.webgl, probes.webgpu),
    renderingSection(probes.canvas, probes.webglImage, probes.audio),
    devicesSection(probes.devices),
    batterySection(probes.battery),
    networkSection(env.nav.connection)
  ]
}
