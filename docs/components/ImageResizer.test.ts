// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ImageResizer from './ImageResizer.vue'

/**
 * The sizing arithmetic is covered in docs/lib/image-resize.test.ts and the
 * draw pipeline in docs/lib/canvas-resize.test.ts. What is left to the
 * component is everything between a dropped file and a download: decoding
 * once and reusing it, re-running when a setting changes, keeping the object
 * URLs from leaking, and reporting what it could not take.
 *
 * The canvas is stubbed as it is in the canvas-resize tests, and
 * `createImageBitmap` stands in for the decoder with a fixed source size.
 */

const SOURCE = { width: 4000, height: 3000 }

let createImageBitmap: ReturnType<typeof vi.fn>
let draws: { width: number; height: number }[]
/** Bytes the stubbed encoder claims for the result. */
let encodedBytes = 120_000
let encodeFails = false
let revoked: string[]
let downloads: { name: string; href: string }[]

function stubCanvas() {
  draws = []
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    drawImage: (_source: unknown, _x: number, _y: number, width: number, height: number) => {
      draws.push({ width, height })
    }
  })) as never

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string
  ) {
    callback(
      encodeFails ? null : new Blob([new Uint8Array(encodedBytes)], { type: type ?? 'image/png' })
    )
  }) as never
}

function image(name: string, type: string, bytes = 400_000): File {
  return new File([new Uint8Array(bytes)], name, { type })
}

function drop(wrapper: ReturnType<typeof mount>, files: File[]) {
  return wrapper.get('.ir-drop').trigger('drop', { dataTransfer: { files } })
}

async function withImages(files: File[]) {
  const wrapper = mount(ImageResizer)
  await drop(wrapper, files)
  await flushPromises()
  return wrapper
}

function rows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.ir-item')
}

beforeEach(() => {
  encodedBytes = 120_000
  encodeFails = false
  revoked = []
  downloads = []

  stubCanvas()

  createImageBitmap = vi.fn(async () => ({ ...SOURCE, close: vi.fn() }))
  vi.stubGlobal('createImageBitmap', createImageBitmap)

  let urls = 0
  URL.createObjectURL = vi.fn(() => `blob:stub/${++urls}`)
  URL.revokeObjectURL = vi.fn((url: string) => revoked.push(url))

  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, href: this.href })
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('ImageResizer', () => {
  it('resizes a dropped image at the default longest edge', async () => {
    const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

    // 4000x3000 down to a 1600px longest edge.
    expect(rows(wrapper)).toHaveLength(1)
    expect(wrapper.get('.ir-numbers').text()).toContain('4000 × 3000 → 1600 × 1200')
  })

  it('reports the bytes saved, per image and in total', async () => {
    const wrapper = await withImages([image('photo.jpg', 'image/jpeg', 400_000)])

    const line = wrapper.get('.ir-numbers').text()
    expect(line).toContain('390.6 KB')
    expect(line).toContain('117.2 KB')
    expect(line).toContain('-70%')
    expect(wrapper.get('.ir-totals').text()).toContain('-70%')
  })

  it('gets there in halving steps rather than one pass', async () => {
    // The reason the tool exists: 4000 -> 1600 is more than 2:1, so it is done
    // as 2000 then 1600.
    await withImages([image('photo.jpg', 'image/jpeg')])

    expect(draws).toEqual([
      { width: 2000, height: 1500 },
      { width: 1600, height: 1200 }
    ])
  })

  it('takes several images at once', async () => {
    const wrapper = await withImages([
      image('a.jpg', 'image/jpeg'),
      image('b.png', 'image/png'),
      image('c.webp', 'image/webp')
    ])

    expect(rows(wrapper)).toHaveLength(3)
    expect(wrapper.findAll('.ir-thumb img')).toHaveLength(3)
    expect(wrapper.get('.ir-btn-main').text()).toBe('Download all 3')
  })

  it('stops at ten and says which files it left out', async () => {
    const eleven = Array.from({ length: 11 }, (_, i) => image(`shot-${i}.jpg`, 'image/jpeg'))

    const wrapper = await withImages(eleven)

    expect(rows(wrapper)).toHaveLength(10)
    expect(wrapper.get('.ir-rejected').text()).toContain('shot-10.jpg')
    expect(wrapper.get('.ir-rejected').text()).toContain('Over the limit of 10')
  })

  it('explains a file it cannot take instead of dropping it silently', async () => {
    const wrapper = await withImages([image('notes.pdf', 'application/pdf')])

    expect(rows(wrapper)).toHaveLength(0)
    expect(wrapper.get('.ir-rejected').text()).toContain('Not an image')
  })

  it('accepts files chosen through the picker as well as dropped ones', async () => {
    const wrapper = mount(ImageResizer)
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [image('picked.jpg', 'image/jpeg')],
      configurable: true
    })

    await input.trigger('change')
    await flushPromises()

    expect(rows(wrapper)).toHaveLength(1)
  })

  describe('settings', () => {
    it('re-runs when the mode changes', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      await wrapper.get('select[aria-label="Resize by"]').setValue('percent')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      // 50% of 4000x3000.
      expect(wrapper.get('.ir-numbers').text()).toContain('→ 2000 × 1500')
    })

    it('decodes afresh each run and frees the pixels afterwards', async () => {
      // The trade is explained in the component; this pins the behaviour.
      vi.useFakeTimers()
      const close = vi.fn()
      createImageBitmap.mockResolvedValue({ ...SOURCE, close })
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])
      expect(createImageBitmap).toHaveBeenCalledOnce()
      expect(close).toHaveBeenCalledOnce()

      await wrapper.get('select[aria-label="Resize by"]').setValue('percent')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect(createImageBitmap).toHaveBeenCalledTimes(2)
      expect(close).toHaveBeenCalledTimes(2)
    })

    it('re-runs when the amount changes', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      await wrapper.get('input[aria-label="Amount"]').setValue('800')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect(wrapper.get('.ir-numbers').text()).toContain('→ 800 × 600')
    })

    it('keeps a separate amount per mode', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])
      const amount = wrapper.get('input[aria-label="Amount"]')
      expect((amount.element as HTMLInputElement).value).toBe('1600')

      await wrapper.get('select[aria-label="Resize by"]').setValue('percent')
      await vi.advanceTimersByTimeAsync(300)

      // 1600 would mean 1600% in this mode.
      expect((amount.element as HTMLInputElement).value).toBe('50')
    })

    it('leaves a small image alone unless enlarging is allowed', async () => {
      vi.useFakeTimers()
      createImageBitmap.mockResolvedValue({ width: 1000, height: 750, close: vi.fn() })
      const wrapper = await withImages([image('small.jpg', 'image/jpeg')])

      expect(wrapper.get('.ir-numbers').text()).toContain('1000 × 750 → 1000 × 750')

      await wrapper.get('input[type="checkbox"]').setValue(true)
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect(wrapper.get('.ir-numbers').text()).toContain('→ 1600 × 1200')
      expect(wrapper.get('.ir-warn').text()).toBe('enlarged')
    })

    it('offers quality only for a format that has any', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])
      expect(wrapper.find('input[aria-label="Quality"]').exists()).toBe(true)

      await wrapper.get('select[aria-label="Format"]').setValue('image/png')
      await vi.advanceTimersByTimeAsync(300)

      expect(wrapper.find('input[aria-label="Quality"]').exists()).toBe(false)
    })
  })

  describe('downloading', () => {
    it('names the file after its new size and format', async () => {
      const wrapper = await withImages([image('photo.JPG', 'image/jpeg')])

      await wrapper.get('.ir-actions .ir-btn').trigger('click')

      expect(downloads).toEqual([{ name: 'photo-1600x1200.jpg', href: 'blob:stub/1' }])
    })

    it('follows the chosen format in the name', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      await wrapper.get('select[aria-label="Format"]').setValue('image/webp')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()
      await wrapper.get('.ir-actions .ir-btn').trigger('click')

      expect(downloads[0].name).toBe('photo-1600x1200.webp')
    })

    it('saves a format the canvas cannot encode as PNG', async () => {
      const wrapper = await withImages([image('loop.gif', 'image/gif')])

      await wrapper.get('.ir-actions .ir-btn').trigger('click')

      expect(downloads[0].name).toBe('loop-1600x1200.png')
    })

    it('saves the whole batch, one after another', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([
        image('a.jpg', 'image/jpeg'),
        image('b.jpg', 'image/jpeg')
      ])

      await wrapper.get('.ir-btn-main').trigger('click')
      await vi.advanceTimersByTimeAsync(1000)

      expect(downloads.map((d) => d.name)).toEqual(['a-1600x1200.jpg', 'b-1600x1200.jpg'])
    })
  })

  describe('housekeeping', () => {
    it('revokes the old preview when a setting produces a new one', async () => {
      vi.useFakeTimers()
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      await wrapper.get('input[aria-label="Amount"]').setValue('800')
      await vi.advanceTimersByTimeAsync(300)
      await flushPromises()

      expect(revoked).toContain('blob:stub/1')
    })

    it('revokes the preview of a removed image', async () => {
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      await wrapper.get('.ir-remove').trigger('click')

      expect(rows(wrapper)).toHaveLength(0)
      expect(revoked).toEqual(['blob:stub/1'])
    })

    it('clears everything on Clear', async () => {
      const wrapper = await withImages([image('a.jpg', 'image/jpeg'), image('b.jpg', 'image/jpeg')])

      await wrapper.findAll('.ir-toolbar .ir-btn')[1].trigger('click')

      expect(rows(wrapper)).toHaveLength(0)
      expect(revoked).toHaveLength(2)
    })

    it('lets go of its previews when the page moves on', async () => {
      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      wrapper.unmount()

      expect(revoked).toEqual(['blob:stub/1'])
    })
  })

  describe('when something goes wrong', () => {
    it('reports an image the browser will not encode', async () => {
      encodeFails = true

      const wrapper = await withImages([image('photo.jpg', 'image/jpeg')])

      expect(wrapper.get('.ir-error').text()).toContain('could not encode')
    })

    it('reports an image the browser will not decode', async () => {
      createImageBitmap.mockRejectedValue(new Error('broken file'))

      const wrapper = await withImages([image('truncated.jpg', 'image/jpeg')])

      expect(wrapper.get('.ir-error').text()).toBe('broken file')
    })

    it('keeps the other images when one fails', async () => {
      // Twice, because decode() retries once without the orientation option
      // for browsers that reject it; a file that is really broken fails both.
      createImageBitmap
        .mockRejectedValueOnce(new Error('broken file'))
        .mockRejectedValueOnce(new Error('broken file'))
        .mockResolvedValue({ ...SOURCE, close: vi.fn() })

      const wrapper = await withImages([
        image('broken.jpg', 'image/jpeg'),
        image('fine.jpg', 'image/jpeg')
      ])

      expect(wrapper.findAll('.ir-error')).toHaveLength(1)
      expect(wrapper.findAll('.ir-thumb img')).toHaveLength(1)
      expect(wrapper.get('.ir-btn-main').text()).toBe('Download it')
    })

    it('refuses a source too large for a canvas to redraw', async () => {
      createImageBitmap.mockResolvedValue({ width: 30000, height: 20000, close: vi.fn() })

      const wrapper = await withImages([image('huge.png', 'image/png')])

      expect(wrapper.get('.ir-error').text()).toContain('too large')
    })
  })
})
