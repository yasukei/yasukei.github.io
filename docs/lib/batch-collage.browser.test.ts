import { describe, expect, it } from 'vitest'
import { createCanvas, decode, release, toBlob } from './canvas-resize'
import { renderBatchCollage } from './batch-collage-canvas'
import { imagesToZip } from './batch-image-zip'
import { planCollages } from './batch-collage'
import { unzipSync } from 'fflate'

async function image(name: string, color: string, width = 120, height = 80) {
  const canvas = createCanvas({ width, height })
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  return new File([await toBlob(canvas, 'image/jpeg')], name, { type: 'image/jpeg' })
}

async function pixels(blob: Blob) {
  const bitmap = await decode(blob)
  try {
    const canvas = createCanvas(bitmap)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } finally { release(bitmap) }
}

describe('batch collage drawing in a real browser', () => {
  it('encodes an odd-sized grid in filename order with full-cell stretching', async () => {
    const files = await Promise.all([
      image('d.jpg', '#ffff00'), image('b.jpg', '#00ff00'),
      image('a.jpg', '#ff0000', 30, 200), image('c.jpg', '#0000ff')
    ])
    const options = { rows: 2, columns: 2, count: 1, width: 101, height: 67 }
    const [job] = planCollages(files, options)
    const result = await renderBatchCollage(job.files, options)
    expect(result.blob.type).toBe('image/jpeg')
    const data = await pixels(result.blob)
    expect([data.width, data.height]).toEqual([101, 67])
    const samples = [[2, 2], [98, 2], [2, 64], [98, 64]]
    const expected = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]]
    samples.forEach(([x, y], i) => {
      const offset = (y * data.width + x) * 4
      expected[i].forEach((value, channel) => expect(Math.abs(data.data[offset + channel] - value)).toBeLessThan(15))
    })
  })

  it('repeats faint white watermark text across the image and leaves empty text unchanged', async () => {
    const files = [await image('a.jpg', '#000000', 800, 600)]
    const options = { rows: 1, columns: 1, count: 1 }
    const plain = await renderBatchCollage(files, options)
    const empty = await renderBatchCollage(files, { ...options, watermark: '' })
    expect(new Uint8Array(await empty.blob.arrayBuffer())).toEqual(new Uint8Array(await plain.blob.arrayBuffer()))
    const marked = await pixels((await renderBatchCollage(files, { ...options, watermark: 'Sample' })).blob)
    // Letters should be present in every quadrant, while most pixels stay black.
    for (let q = 0; q < 4; q++) {
      let changed = 0
      for (let y = Math.floor(q / 2) * 300; y < (Math.floor(q / 2) + 1) * 300; y++) {
        for (let x = q % 2 * 400; x < (q % 2 + 1) * 400; x++) {
          if (marked.data[(y * 800 + x) * 4] > 15) changed++
        }
      }
      expect(changed).toBeGreaterThan(100)
      expect(changed).toBeLessThan(12_000)
    }
  })

  it('creates an extractable numbered JPEG ZIP and computes each automatic size independently', async () => {
    const files = [await image('a.jpg', '#ff0000', 40, 30), await image('b.jpg', '#00ff00', 70, 90)]
    const options = { rows: 1, columns: 1, count: 2 }
    const jobs = planCollages(files, options, () => 0.99)
    const zip = await imagesToZip(jobs, { cancelled: () => false, converted: () => {} }, async job =>
      (await renderBatchCollage(job.files, options)).blob)
    const entries = unzipSync(new Uint8Array(await zip!.arrayBuffer()))
    expect(Object.keys(entries)).toEqual(['collage-001.jpg', 'collage-002.jpg'])
    const dimensions = await Promise.all(Object.values(entries).map(async bytes => {
      const result = await pixels(new Blob([bytes], { type: 'image/jpeg' }))
      return [result.width, result.height]
    }))
    expect(dimensions).toEqual([[40, 30], [70, 90]])
  })

  it('reports unreadable images and honors cancellation', async () => {
    const options = { rows: 1, columns: 1, count: 1 }
    await expect(renderBatchCollage([new File(['bad jpeg'], 'broken.jpg')], options)).rejects.toThrow('broken.jpg')
    await expect(renderBatchCollage([await image('a.jpg', '#000000')], options, () => true)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
