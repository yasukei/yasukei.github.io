import { describe, expect, it } from 'vitest'
import { collageCell, collageSize, collageSources, planCollages, validateBatchCollage, type CollageJob } from './batch-collage'
import { randomFrom } from './collage-layout'

const options = { rows: 2, columns: 2, count: 2 }
function file(name: string, path = '') {
  const result = new File(['image'], name)
  Object.defineProperty(result, 'webkitRelativePath', { value: path })
  return result
}

describe('batch collage selection', () => {
  it('accepts JPEG aliases case-insensitively and excludes nested folder contents', () => {
    const files = [file('a.JPG', 'src/a.JPG'), file('b.jpeg'), file('c.png'), file('d.jpg', 'src/nested/d.jpg')]
    expect(collageSources(files).map(f => f.name)).toEqual(['a.JPG', 'b.jpeg'])
  })

  it('samples without replacement across the whole batch, sorts each group, and leaves input intact', () => {
    const files = Array.from({ length: 20 }, (_, i) => file(`${i}.jpg`))
    const original = [...files]
    const first = planCollages(files, options, randomFrom(12))
    const selected = first.flatMap(job => job.files)
    expect(selected).toHaveLength(8)
    expect(new Set(selected).size).toBe(8)
    expect(files).toHaveLength(original.length)
    files.forEach((file, i) => expect(file).toBe(original[i]))
    expect(first.map(job => job.output)).toEqual(['collage-001.jpg', 'collage-002.jpg'])
    for (const job of first) expect(job.files.map(f => f.name)).toEqual(job.files.map(f => f.name).sort())
    const names = (jobs: CollageJob[]) => jobs.map(job => job.files.map(file => file.name))
    expect(names(planCollages(files, options, randomFrom(12)))).toEqual(names(first))
    expect(names(planCollages(files, options, randomFrom(13)))).not.toEqual(names(first))
  })

  it('uses lexical filename order rather than natural numerical order', () => {
    const jobs = planCollages(['2.jpg', '10.jpg', '1.jpg', 'a.jpg'].map(name => file(name)), { ...options, count: 1 })
    expect(jobs[0].files.map(f => f.name)).toEqual(['1.jpg', '10.jpg', '2.jpg', 'a.jpg'])
  })

  it('reports the total shortage instead of reusing images or accepting non-JPEG inputs', () => {
    expect(() => planCollages([file('a.jpg'), file('b.png')], options)).toThrow('必要: 8 枚、選択済み: 1 枚')
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid required and optional settings: %s', value => {
    for (const key of ['rows', 'columns', 'count', 'width', 'height']) {
      expect(() => validateBatchCollage({ ...options, [key]: value })).toThrow('整数')
    }
  })

  it('rejects overflowing counts and ZIP file counts before selecting', () => {
    expect(() => validateBatchCollage({ ...options, rows: Number.MAX_SAFE_INTEGER })).toThrow('大きすぎ')
    expect(() => validateBatchCollage({ ...options, count: 65_536 })).toThrow('65,535')
  })
})

describe('batch collage geometry', () => {
  const sizes = [{ width: 101, height: 81 }, { width: 102, height: 82 }]
  const grid = { rows: 1, columns: 2, count: 1 }

  it('floors the average source dimensions before multiplying by rows and columns', () => {
    expect(collageSize(sizes, grid)).toEqual({ width: 202, height: 81 })
    expect(collageSize([{ width: 10, height: 20 }, { width: 10, height: 20 }], grid)).toEqual({ width: 20, height: 20 })
  })

  it('scales the missing dimension or uses both explicit dimensions independently', () => {
    expect(collageSize(sizes, { ...grid, width: 100 })).toEqual({ width: 100, height: 40 })
    expect(collageSize(sizes, { ...grid, height: 50 })).toEqual({ width: 124, height: 50 })
    expect(collageSize(sizes, { ...grid, width: 100, height: 100 })).toEqual({ width: 100, height: 100 })
  })

  it('accepts explicit dimensions without source measurements while retaining size limits', () => {
    expect(collageSize(null, { ...grid, width: 100, height: 80 })).toEqual({ width: 100, height: 80 })
    expect(() => collageSize(null, { ...grid, width: 8000, height: 8000 })).toThrow('大きすぎ')
    expect(() => collageSize(null, { ...grid, width: 1, height: 80 })).toThrow('小さすぎ')
    expect(() => collageSize(null, grid)).toThrow('画像数')
    expect(() => collageSize(null, { ...grid, width: 100 })).toThrow('画像数')
  })

  it('rejects zero-pixel cells and unsupported output sizes, including automatic dimensions', () => {
    expect(() => collageSize(sizes, { ...grid, width: 1 })).toThrow('小さすぎ')
    expect(() => collageSize(sizes, { ...grid, width: 8000, height: 8000 })).toThrow('大きすぎ')
    expect(() => collageSize([{ width: 20_000, height: 1 }, { width: 20_000, height: 1 }], grid)).toThrow('大きすぎ')
    expect(() => collageSize(sizes, { ...grid, width: 16_385 })).toThrow('16,384')
  })

  it('covers every pixel exactly once at dimensions that do not divide evenly', () => {
    const size = { width: 101, height: 67 }
    const visits = new Uint8Array(size.width * size.height)
    for (let i = 0; i < 6; i++) {
      const cell = collageCell(size, 2, 3, i)
      for (let y = cell.y; y < cell.y + cell.height; y++) {
        for (let x = cell.x; x < cell.x + cell.width; x++) visits[y * size.width + x]++
      }
    }
    expect([...new Set(visits)]).toEqual([1])
  })
})
