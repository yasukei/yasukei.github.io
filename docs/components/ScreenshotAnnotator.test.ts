// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ScreenshotAnnotator from './ScreenshotAnnotator.vue'

/**
 * The geometry, the undo history and the key map are covered in
 * docs/lib/annotate.test.ts. What is left to the component is the wiring:
 * getting an image in, turning pointer drags into shapes in image pixels,
 * keeping its page-wide listeners away from typing elsewhere on the page, and
 * letting go of them when the page is left.
 *
 * The canvas is stubbed with a context that records what is drawn, and shown
 * at half its size, as a large screenshot would be.
 */

const SOURCE = { width: 2000, height: 1000 }
const SHOWN = 0.5

let calls: { name: string; args: unknown[] }[]
let downloads: { name: string; href: string }[]
let wrapper: VueWrapper | null

function stubCanvas() {
  calls = []
  const record = (name: string) => (...args: unknown[]) => calls.push({ name, args })
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, name: string) => (name in target ? target[name] : record(name)),
    set: (target, name: string, value) => {
      target[name] = value
      return true
    }
  })
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
  HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLCanvasElement) {
    return { left: 0, top: 0, width: this.width * SHOWN, height: this.height * SHOWN } as DOMRect
  })
  HTMLCanvasElement.prototype.toBlob = vi.fn((callback: BlobCallback, type?: string) => {
    callback(new Blob([new Uint8Array(10)], { type: type ?? 'image/png' }))
  }) as never
}

function drawn(name: string) {
  return calls.filter((call) => call.name === name).map((call) => call.args)
}

function image(name = 'shot.png'): File {
  return new File([new Uint8Array(100)], name, { type: 'image/png' })
}

async function withImage(name = 'shot.png') {
  wrapper = mount(ScreenshotAnnotator, { attachTo: document.body })
  await wrapper.get('.sa-root').trigger('drop', { dataTransfer: { files: [image(name)] } })
  await flushPromises()
  return wrapper
}

/** A drag across the canvas, in screen pixels. */
async function drag(from: [number, number], to: [number, number]) {
  const canvas = wrapper!.get('canvas')
  await canvas.trigger('pointerdown', { button: 0, pointerId: 1, clientX: from[0], clientY: from[1] })
  await canvas.trigger('pointermove', { pointerId: 1, clientX: to[0], clientY: to[1] })
  await canvas.trigger('pointerup', { pointerId: 1, clientX: to[0], clientY: to[1] })
}

function key(target: EventTarget, key: string, modifiers: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers })
  target.dispatchEvent(event)
  return event
}

function paste(target: EventTarget, files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: { items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })) }
  })
  target.dispatchEvent(event)
  return event
}

function pressed(label: string) {
  return wrapper!.get(`[title^="${label}"]`).attributes('aria-pressed')
}

beforeEach(() => {
  wrapper = null
  downloads = []
  stubCanvas()
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ ...SOURCE, close: vi.fn() }))
  )
  URL.createObjectURL = vi.fn(() => 'blob:stub/1')
  URL.revokeObjectURL = vi.fn()
  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href })
  })
})

afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ScreenshotAnnotator', () => {
  it('asks for an image, then shows it at full size', async () => {
    wrapper = mount(ScreenshotAnnotator, { attachTo: document.body })
    expect(wrapper.find('.sa-drop').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(false)

    await wrapper.get('.sa-root').trigger('drop', { dataTransfer: { files: [image('login.png')] } })
    await flushPromises()

    const canvas = wrapper.get('canvas').element as HTMLCanvasElement
    expect([canvas.width, canvas.height]).toEqual([SOURCE.width, SOURCE.height])
    expect(drawn('drawImage')).toHaveLength(1)
    expect(wrapper.get('.sa-meta').text()).toContain('login.png')
    expect(wrapper.get('.sa-meta').text()).toContain('2000 × 1000 px')
  })

  it('takes a screenshot pasted anywhere on the page', async () => {
    wrapper = mount(ScreenshotAnnotator, { attachTo: document.body })

    const event = paste(document.body, [image()])
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
    expect(wrapper.get('.sa-meta').text()).toContain('貼り付けた画像')
  })

  it('leaves a paste into a text field elsewhere on the page alone', async () => {
    wrapper = mount(ScreenshotAnnotator, { attachTo: document.body })
    const search = document.body.appendChild(document.createElement('input'))

    const event = paste(search, [image()])
    await flushPromises()

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.find('canvas').exists()).toBe(false)
  })

  it('draws a dragged shape in image pixels, not screen pixels', async () => {
    await withImage()
    await wrapper!.get('[title^="四角"]').trigger('click')

    await drag([100, 50], [300, 150])

    // Shown at half size, so every screen pixel is two image pixels.
    expect(drawn('strokeRect').at(-1)).toEqual([200, 100, 400, 200])
    expect(wrapper!.get('[aria-label="元に戻す"]').attributes('disabled')).toBeUndefined()
  })

  it('ignores a click that does not drag', async () => {
    await withImage()

    await drag([100, 50], [100, 50])

    expect(wrapper!.get('[aria-label="元に戻す"]').attributes('disabled')).toBeDefined()
  })

  it('switches tool by key, but not while typing elsewhere on the page', async () => {
    await withImage()
    const search = document.body.appendChild(document.createElement('input'))

    key(search, 'r')
    await flushPromises()
    expect(pressed('丸')).toBe('true')

    key(document.body, 'r')
    await flushPromises()
    expect(pressed('四角')).toBe('true')
  })

  it('brings back a cleared drawing with Ctrl+Z', async () => {
    await withImage()
    await wrapper!.get('[title^="四角"]').trigger('click')
    await drag([10, 10], [60, 60])
    await drag([100, 100], [160, 160])

    await wrapper!.get('[title="書き込みを全部消す"]').trigger('click')
    calls = []
    const event = key(document.body, 'z', { ctrlKey: true })
    await flushPromises()

    expect(event.defaultPrevented).toBe(true)
    expect(drawn('strokeRect')).toHaveLength(2)
  })

  it('writes text where the canvas was clicked, finished with Enter', async () => {
    await withImage()
    key(document.body, 't')
    await flushPromises()

    await wrapper!.get('canvas').trigger('pointerdown', { button: 0, clientX: 40, clientY: 30 })
    const editor = wrapper!.get('textarea')
    await editor.setValue('ここを開く')
    await editor.trigger('keydown', { key: 'Enter' })

    expect(wrapper!.find('textarea').exists()).toBe(false)
    expect(drawn('fillText').at(-1)).toEqual(['ここを開く', 80, 60])
  })

  it('throws the text away on Escape', async () => {
    await withImage()
    key(document.body, 't')
    await flushPromises()

    await wrapper!.get('canvas').trigger('pointerdown', { button: 0, clientX: 40, clientY: 30 })
    const editor = wrapper!.get('textarea')
    await editor.setValue('やっぱりやめる')
    await editor.trigger('keydown', { key: 'Escape' })

    expect(wrapper!.find('textarea').exists()).toBe(false)
    expect(drawn('fillText')).toEqual([])
  })

  it('saves a PNG named after the source', async () => {
    await withImage('settings.jpg')

    await wrapper!.get('.sa-main').trigger('click')
    await flushPromises()

    expect(downloads).toEqual([{ name: 'settings-annotated.png', href: 'blob:stub/1' }])
  })

  it('lets go of its page-wide listeners when the page is left', async () => {
    await withImage()
    wrapper!.unmount()
    wrapper = null

    const keydown = key(document.body, 'z', { ctrlKey: true })
    const pasted = paste(document.body, [image()])

    expect(keydown.defaultPrevented).toBe(false)
    expect(pasted.defaultPrevented).toBe(false)
  })
})
