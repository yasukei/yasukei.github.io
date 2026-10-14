import { describe, it, expect } from 'vitest'
import {
  batterySection,
  collectHardware,
  cpuMemorySection,
  devicesSection,
  fnv1a,
  formatDuration,
  gpuSection,
  inputSection,
  networkSection,
  renderingSection,
  screenSection,
  type HardwareProbes,
  type WebGLInfo
} from './hardware-info'
import type { Section } from './browser-info'

function row(section: Section, label: string) {
  const found = section.rows.find((r) => r.label === label)
  if (!found) throw new Error(`no row "${label}" in ${section.id}`)
  return found
}

/** A matchMedia that answers yes to exactly the given queries. */
const matching =
  (...queries: string[]) =>
  (query: string) => ({ matches: queries.includes(query) })

const NO_PROBES: HardwareProbes = {
  webgl: null,
  webglImage: null,
  webgpu: null,
  canvas: null,
  audio: null,
  devices: null,
  battery: null
}

const SCREEN = { width: 1920, height: 1080, availWidth: 1920, availHeight: 1032, colorDepth: 24 }

describe('fnv1a', () => {
  it.each([
    ['', '811c9dc5'],
    ['a', 'e40c292c'],
    ['foobar', 'bf9cf968']
  ])('%j -> %s', (input, expected) => {
    expect(fnv1a(input)).toBe(expected)
  })

  it('hashes bytes the same as the equivalent ASCII string', () => {
    expect(fnv1a(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]))).toBe(fnv1a('foobar'))
  })

  it('tells apart inputs that differ by one value', () => {
    expect(fnv1a([1, 2, 3])).not.toBe(fnv1a([1, 2, 4]))
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0分'],
    [59 * 60, '59分'],
    [3725, '1時間2分'],
    [2 * 3600, '2時間0分'],
    [Infinity, '不明 (Infinity)']
  ])('%d -> %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})

describe('cpuMemorySection', () => {
  it('shows cores and memory, or nothing where the browser has none', () => {
    const chrome = cpuMemorySection({ hardwareConcurrency: 8, deviceMemory: 8 })
    const firefox = cpuMemorySection({ hardwareConcurrency: 8 })

    expect(row(chrome, 'CPUの論理コア数').value).toBe('8')
    expect(row(chrome, 'メモリ量の目安').value).toBe('8 GB')
    expect(row(firefox, 'メモリ量の目安').value).toBeNull()
  })

  it('keeps a fractional memory bucket', () => {
    expect(row(cpuMemorySection({ deviceMemory: 0.5 }), 'メモリ量の目安').value).toBe('0.5 GB')
  })
})

describe('screenSection', () => {
  it('works out the physical size and the room the taskbar takes', () => {
    const section = screenSection({ ...SCREEN, orientation: { type: 'landscape-primary' } }, 1.5, matching())

    expect(row(section, '画面解像度').value).toBe('1920 × 1080')
    expect(row(section, '拡大率').value).toBe('1.5')
    expect(row(section, '物理ピクセル数 (推定)').value).toBe('2880 × 1620')
    expect(row(section, '利用可能領域').value).toBe('1920 × 1032')
    expect(row(section, 'タスクバーなどの大きさ').value).toBe('縦 48px / 横 0px')
    expect(row(section, '色深度').value).toBe('24 bit')
    expect(row(section, '画面の向き').value).toBe('landscape-primary')
  })

  it('reports the widest colour gamut, since a P3 screen matches sRGB too', () => {
    const section = screenSection(SCREEN, 2, matching('(color-gamut: srgb)', '(color-gamut: p3)'))

    expect(row(section, '色域').value).toBe('p3')
  })
})

describe('inputSection', () => {
  it('lists every kind of pointer a touch laptop has', () => {
    const section = inputSection(
      { maxTouchPoints: 10 },
      matching('(pointer: fine)', '(hover: hover)', '(any-pointer: fine)', '(any-pointer: coarse)')
    )

    expect(row(section, '同時にタッチできる点の数').value).toBe('10')
    expect(row(section, '主なポインタ').value).toBe('fine')
    expect(row(section, 'ホバーできるか').value).toBe('hover')
    expect(row(section, '使えるポインタすべて').value).toEqual(['fine', 'coarse'])
  })
})

describe('gpuSection', () => {
  const webgl: WebGLInfo = {
    version: 'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
    vendor: 'WebKit',
    renderer: 'WebKit WebGL',
    unmaskedVendor: 'Google Inc. (NVIDIA)',
    unmaskedRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    maxTextureSize: 16384,
    extensions: ['EXT_color_buffer_float', 'OES_texture_float_linear']
  }

  it('shows the model and the parameters', () => {
    const section = gpuSection(webgl, { vendor: 'nvidia', architecture: 'ampere', description: '' })

    expect(row(section, 'GPUの機種').value).toBe(webgl.unmaskedRenderer)
    expect(row(section, '標準のベンダー / レンダラー').value).toBe('WebKit / WebKit WebGL')
    expect(row(section, '最大テクスチャサイズ').value).toBe('16384 px')
    expect(row(section, '対応している拡張機能').value).toMatch(/^2個 \(ハッシュ [0-9a-f]{8}\)$/)
    // Empty fields are dropped rather than shown as blank lines.
    expect(row(section, 'WebGPUのアダプタ').value).toEqual(['nvidia', 'ampere'])
  })

  it('keeps the basic parameters where the debug extension is missing', () => {
    const section = gpuSection({ ...webgl, unmaskedVendor: null, unmaskedRenderer: null }, null)

    expect(row(section, 'GPUの機種').value).toBeNull()
    expect(row(section, 'WebGLのバージョン').value).toBe(webgl.version)
  })

  it('treats an adapter that tells nothing as unavailable', () => {
    const section = gpuSection(null, { vendor: '', architecture: '', description: '' })

    expect(row(section, 'WebGPUのアダプタ').value).toBeNull()
  })
})

describe('renderingSection', () => {
  it('carries the pictures along with the hashes', () => {
    const section = renderingSection(
      { hash: 'aaaaaaaa', image: 'data:image/png;base64,AAA' },
      null,
      { sum: 124.04347527516074, hash: 'bbbbbbbb' }
    )

    expect(row(section, 'Canvasの描画結果')).toMatchObject({
      value: 'aaaaaaaa',
      image: 'data:image/png;base64,AAA'
    })
    expect(row(section, 'WebGLの描画結果')).toMatchObject({ value: null, image: undefined })
    expect(row(section, 'AudioContextの処理結果').value).toEqual(['合計 124.04347527516074', 'ハッシュ bbbbbbbb'])
  })
})

describe('devicesSection', () => {
  it('counts each kind and how many could be named', () => {
    const section = devicesSection({ videoinput: 1, audioinput: 2, audiooutput: 3, labelled: 0 })

    expect(row(section, 'カメラ').value).toBe('1 台')
    expect(row(section, 'マイク').value).toBe('2 台')
    expect(row(section, 'スピーカー').value).toBe('3 台')
    expect(row(section, '名前が取れたもの').value).toBe('0 / 6')
  })

  it('tells "none found" apart from "cannot ask"', () => {
    expect(row(devicesSection({ videoinput: 0, audioinput: 0, audiooutput: 0, labelled: 0 }), 'カメラ').value).toBe('0 台')
    expect(row(devicesSection(null), 'カメラ').value).toBeNull()
  })
})

describe('batterySection', () => {
  it('shows a laptop running on battery', () => {
    const section = batterySection({ level: 0.734, charging: false, chargingTime: Infinity, dischargingTime: 7380 })

    expect(row(section, '残量').value).toBe('73%')
    expect(row(section, '充電中か').value).toBe('false')
    expect(row(section, '満充電までの時間').value).toBe('不明 (Infinity)')
    expect(row(section, '空になるまでの時間').value).toBe('2時間3分')
  })

  it('is unavailable outside Chromium', () => {
    expect(batterySection(null).rows.every((r) => r.value === null)).toBe(true)
  })
})

describe('networkSection', () => {
  it('shows the rounded estimates', () => {
    const section = networkSection({ effectiveType: '4g', downlink: 10, rtt: 50, saveData: false })

    expect(row(section, '回線の速さの区分').value).toBe('4g')
    expect(row(section, '下り速度の目安').value).toBe('10 Mbps')
    expect(row(section, '往復遅延の目安').value).toBe('50 ms')
    expect(row(section, 'データセーバー').value).toBe('false')
    // Desktop Chrome has no `type`.
    expect(row(section, '接続の種類').value).toBeNull()
  })

  it('is unavailable without navigator.connection', () => {
    expect(networkSection(undefined).rows.every((r) => r.value === null)).toBe(true)
  })
})

describe('collectHardware', () => {
  it('builds every section, even when no probe found anything', () => {
    const sections = collectHardware({
      nav: {},
      screen: SCREEN,
      devicePixelRatio: 1,
      matchMedia: matching(),
      probes: NO_PROBES
    })

    expect(sections.map((s) => s.id)).toEqual([
      'cpu-memory',
      'screen',
      'input',
      'gpu',
      'rendering',
      'devices',
      'battery',
      'network'
    ])
  })
})
