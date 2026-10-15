// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ModelViewer from './ModelViewer.vue'
import type { Shown } from '../lib/model-scene'

/**
 * Picking the model out of a drop and formatting what is known about it are
 * covered in docs/lib/model-viewer.test.ts, and the WebGL side in
 * docs/lib/model-scene.browser.test.ts, as happy-dom has no WebGL. What is left
 * to the component is the wiring, so the scene is replaced by a fake that
 * records what it was asked to do and answers when the test says so.
 */

const { scenes, fakeScene } = vi.hoisted(() => {
  const scenes: FakeScene[] = []
  /** Stands in for ModelScene; called with `new`, so it is a function rather than an arrow. */
  const fakeScene = vi.fn(function (this: FakeScene) {
    this.load = vi.fn(async () => SHOWN)
    this.setWireframe = vi.fn()
    this.setZUp = vi.fn()
    this.setBackground = vi.fn()
    this.resetView = vi.fn()
    this.snapshot = vi.fn(async () => new Blob([new Uint8Array(10)], { type: 'image/png' }))
    this.dispose = vi.fn()
    scenes.push(this)
  })
  return { scenes, fakeScene }
})

interface FakeScene {
  load: ReturnType<typeof vi.fn>
  setWireframe: ReturnType<typeof vi.fn>
  setZUp: ReturnType<typeof vi.fn>
  setBackground: ReturnType<typeof vi.fn>
  resetView: ReturnType<typeof vi.fn>
  snapshot: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

vi.mock('../lib/model-scene', () => ({ ModelScene: fakeScene }))

const SHOWN: Shown = {
  stats: { meshes: 3, triangles: 12345, vertices: 6789, materials: 2 },
  size: { x: 1.6, y: 1.385, z: 1234.4 },
  missing: [],
  ambiguous: []
}

let wrapper: VueWrapper | null
let downloads: { name: string; href: string }[]

function file(name: string): File {
  return new File([new Uint8Array(10)], name)
}

async function drop(...files: File[]) {
  await wrapper!.get('.mv-root').trigger('drop', { dataTransfer: { files } })
  await flushPromises()
}

async function opened(...files: File[]) {
  wrapper = mount(ModelViewer, { attachTo: document.body })
  await drop(...files)
  return wrapper
}

function status() {
  return wrapper!.get('[role="status"]').text()
}

function pressed(name: string) {
  return wrapper!.get(`[aria-label="${name}"], button[title^="${name}"]`).attributes('aria-pressed')
}

beforeEach(() => {
  wrapper = null
  scenes.length = 0
  downloads = []
  URL.createObjectURL = vi.fn(() => 'blob:stub/1')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href })
  })
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('ModelViewer', () => {
  it('asks for a model, then shows it with what it is made of', async () => {
    wrapper = mount(ModelViewer, { attachTo: document.body })
    expect(wrapper.find('.mv-drop').exists()).toBe(true)
    expect(wrapper.find('.mv-meta').exists()).toBe(false)

    await drop(file('robot.glb'))

    expect(wrapper.find('.mv-drop').exists()).toBe(false)
    const meta = wrapper.get('.mv-meta').text()
    expect(meta).toContain('robot.glb（glTF (GLB)）')
    expect(meta).toContain('12,345 三角形')
    expect(meta).toContain('6,789')
    expect(meta).toContain('1.6 × 1.39 × 1234')
  })

  it('hands the scene the model and every file that came with it', async () => {
    const gltf = file('robot.gltf')
    const bin = file('robot.bin')
    const texture = file('albedo.png')

    await opened(texture, gltf, bin)

    expect(scenes).toHaveLength(1)
    expect(scenes[0].load).toHaveBeenCalledWith(gltf, 'gltf', [texture, bin])
  })

  it('says what it takes when given no model, without starting WebGL', async () => {
    await opened(file('notes.txt'))

    expect(status()).toBe('対応している形式は GLB / glTF / STL / OBJ です。')
    expect(scenes).toHaveLength(0)
    expect(wrapper!.find('.mv-drop').exists()).toBe(true)
  })

  it('stands an STL on its Z axis, and other formats on Y', async () => {
    await opened(file('bracket.stl'))
    expect(scenes[0].setZUp).toHaveBeenLastCalledWith(true)
    expect(pressed('Z 軸を上に')).toBe('true')

    await drop(file('robot.glb'))
    expect(scenes[0].setZUp).toHaveBeenLastCalledWith(false)
    expect(pressed('Z 軸を上に')).toBe('false')
  })

  it('keeps one scene for every model it shows', async () => {
    await opened(file('a.stl'))
    await drop(file('b.glb'))

    expect(scenes).toHaveLength(1)
    expect(scenes[0].load).toHaveBeenCalledTimes(2)
  })

  it('shows that it is loading until the model is in', async () => {
    await opened(file('first.glb'))
    let finish: (shown: Shown) => void = () => {}
    scenes[0].load.mockReturnValueOnce(new Promise<Shown>((resolve) => (finish = resolve)))

    await drop(file('big.glb'))
    expect(wrapper!.find('.mv-loading').exists()).toBe(true)

    finish(SHOWN)
    await flushPromises()
    expect(wrapper!.find('.mv-loading').exists()).toBe(false)
  })

  it('keeps the model chosen last when an earlier one finishes after it', async () => {
    await opened(file('first.glb'))
    let finishSlow: (shown: Shown) => void = () => {}
    scenes[0].load
      .mockImplementationOnce(() => new Promise<Shown>((resolve) => (finishSlow = resolve)))
      .mockImplementationOnce(async () => ({ ...SHOWN, stats: { ...SHOWN.stats, triangles: 2 } }))

    await drop(file('slow.glb'))
    await drop(file('fast.stl'))
    finishSlow(SHOWN)
    await flushPromises()

    expect(wrapper!.get('.mv-meta').text()).toContain('fast.stl')
    expect(wrapper!.get('.mv-meta').text()).toContain('2 三角形')
  })

  it('passes on the reason a model did not load when it is written for the reader', async () => {
    await opened(file('first.glb'))
    const explained = Object.assign(new Error('scene.bin が見つかりません。モデルと一緒に選んでください。'), {
      name: 'ModelLoadError'
    })
    scenes[0].load.mockRejectedValueOnce(explained)

    await drop(file('scene.gltf'))

    expect(status()).toBe('scene.bin が見つかりません。モデルと一緒に選んでください。')
    // The model shown before is still there.
    expect(wrapper!.get('.mv-meta').text()).toContain('first.glb')
  })

  it('does not show a message meant for developers', async () => {
    await opened(file('first.glb'))
    scenes[0].load.mockRejectedValueOnce(new TypeError("Cannot read properties of undefined (reading 'x')"))

    await drop(file('broken.glb'))

    expect(status()).toBe('このファイルは読み込めませんでした。')
  })

  it('says so when WebGL is not available', async () => {
    const { ModelScene } = await import('../lib/model-scene')
    // A function, not an arrow: the component calls it with `new`.
    vi.mocked(ModelScene).mockImplementationOnce(function () {
      throw Object.assign(new Error('このブラウザでは 3D 表示 (WebGL) が使えません。'), { name: 'WebGLUnavailableError' })
    })

    await opened(file('robot.glb'))

    expect(status()).toBe('このブラウザでは 3D 表示 (WebGL) が使えません。')
    expect(wrapper!.find('.mv-drop').exists()).toBe(true)
  })

  it('mentions a texture the model is shown without', async () => {
    wrapper = mount(ModelViewer, { attachTo: document.body })
    await drop(file('a.stl'))
    scenes[0].load.mockResolvedValueOnce({ ...SHOWN, missing: ['albedo.png'] })

    await drop(file('robot.gltf'))

    expect(status()).toContain('albedo.png')
  })

  it('warns that files of the same name in different folders were all given one file', async () => {
    await opened(file('a.stl'))
    scenes[0].load.mockResolvedValueOnce({ ...SHOWN, ambiguous: ['diffuse.png'] })

    await drop(file('robot.gltf'))

    expect(status()).toContain('diffuse.png は別々のフォルダにある同じ名前のファイル')
  })

  it('passes the view settings on to the scene', async () => {
    await opened(file('robot.glb'))
    const [scene] = scenes

    await wrapper!.get('button[title^="ポリゴンの辺"]').trigger('click')
    expect(scene.setWireframe).toHaveBeenLastCalledWith(true)
    expect(wrapper!.get('button[title^="ポリゴンの辺"]').attributes('aria-pressed')).toBe('true')

    await wrapper!.get('[aria-label="透明な背景"]').trigger('click')
    expect(scene.setBackground).toHaveBeenLastCalledWith('transparent')
    expect(pressed('透明な背景')).toBe('true')

    await wrapper!.get('button[title^="全体が見える"]').trigger('click')
    expect(scene.resetView).toHaveBeenCalled()
  })

  it('saves the view as a PNG named after the model', async () => {
    await opened(file('robot.glb'))

    await wrapper!.get('.mv-main').trigger('click')
    await flushPromises()

    expect(downloads).toEqual([{ name: 'robot.png', href: 'blob:stub/1' }])
  })

  it('lets go of the scene when the page is left', async () => {
    await opened(file('robot.glb'))
    const [scene] = scenes

    wrapper!.unmount()
    wrapper = null

    expect(scene.dispose).toHaveBeenCalledOnce()
  })
})

describe('ModelViewer while three.js is on its way', () => {
  /**
   * The component imported afresh, with the scene module coming from
   * `arrive`: the one mocked above is already there by the time a test runs.
   */
  async function viewerWith(arrive: () => Promise<unknown>) {
    vi.resetModules()
    vi.doMock('../lib/model-scene', arrive)
    return (await import('./ModelViewer.vue')).default
  }

  afterEach(() => {
    vi.doUnmock('../lib/model-scene')
    vi.resetModules()
  })

  it('makes no WebGL context for a page left before it arrived', async () => {
    let arrived: () => void = () => {}
    const Viewer = await viewerWith(async () => {
      await new Promise<void>((resolve) => (arrived = resolve))
      return { ModelScene: fakeScene }
    })
    wrapper = mount(Viewer, { attachTo: document.body })
    await drop(file('robot.glb'))

    wrapper.unmount()
    wrapper = null
    arrived()
    await flushPromises()

    expect(scenes).toHaveLength(0)
  })

  it('does not blame the file when three.js could not be fetched, and tries again', async () => {
    let attempts = 0
    const Viewer = await viewerWith(async () => {
      attempts++
      if (attempts <= 2) throw new TypeError('Failed to fetch dynamically imported module')
      return { ModelScene: fakeScene }
    })
    wrapper = mount(Viewer, { attachTo: document.body })
    // The attempt made on mount fails quietly; nothing has been asked of it yet.
    await flushPromises()
    expect(status()).toBe('')

    await drop(file('robot.glb'))
    expect(status()).toBe('ビューアを読み込めませんでした。ページを再読み込みしてください。')

    await drop(file('robot.glb'))
    expect(attempts).toBe(3)
    expect(wrapper.get('.mv-meta').text()).toContain('robot.glb')
  })
})
