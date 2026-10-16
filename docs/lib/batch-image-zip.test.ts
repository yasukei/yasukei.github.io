import { describe, expect, it, vi } from 'vitest'
import { unzipSync } from 'fflate'
import { planFileConversion } from './batch-image-convert'
import { convertToZip, MAX_ZIP_BYTES } from './batch-image-zip'

function source(name: string, path = '') {
  const file = new File([name], name)
  Object.defineProperty(file, 'webkitRelativePath', {value: path})
  return file
}

const files = [source('10.PNG', 'src/10.PNG'), source('2.png', 'src/2.png'), source('1.png', 'src/nested/1.png'), source('ignored.jpg', 'src/ignored.jpg')]

describe('folder file planning', () => {
  it('uses the same natural order, recursion paths, filters, and numbering as direct saving', async () => {
    const plan = planFileConversion(files, 'png', 'jpg', 999)
    expect(plan.map(item => [item.path, item.output])).toEqual([
      ['2.png', '999.jpg'], ['10.PNG', '1000.jpg'], ['nested/1.png', '1001.jpg']
    ])
    expect(await plan[0].handle.getFile()).toBe(files[1])
  })
  it('accepts loose image files and JPEG extension aliases', () => {
    expect(planFileConversion([source('a.JPEG'), source('b.jpg'), source('c.png')], 'jpg', 'webp', 0).map(item => item.output)).toEqual(['000.webp', '001.webp'])
  })
  it('handles no matches and rejects unsafe indices', () => {
    expect(planFileConversion(files, 'webp', 'jpg', 1)).toEqual([])
    expect(() => planFileConversion(files, 'png', 'jpg', Number.MAX_SAFE_INTEGER)).toThrow('安全な整数')
    expect(() => planFileConversion([], 'png', 'jpg', -1)).toThrow('安全な整数')
  })
})

describe('ZIP conversion', () => {
  const items = planFileConversion(files, 'png', 'jpg', 1)
  function setup() {
    const encode = vi.fn(async (file: File) => new Blob([await file.text()], {type: 'image/jpeg'}))
    const converted = vi.fn()
    return {encode, converted, options: {cancelled: () => false, converted}}
  }
  it('produces an extractable ZIP containing only the numbered converted bytes', async () => {
    const {encode, converted, options} = setup()
    const blob = await convertToZip(items, 'jpg', 0.9, options, encode)
    expect(blob?.type).toBe('application/zip')
    const entries = unzipSync(new Uint8Array(await blob!.arrayBuffer()))
    expect(Object.keys(entries)).toEqual(['001.jpg', '002.jpg', '003.jpg'])
    expect(Object.values(entries).map(data => new TextDecoder().decode(data))).toEqual(['2.png', '10.PNG', '1.png'])
    expect(converted).toHaveBeenCalledTimes(3)
    expect(encode.mock.calls.map(([file]) => file.name)).toEqual(['2.png', '10.PNG', '1.png'])
  })
  it('returns no partial ZIP on cancellation before or after encoding', async () => {
    const {encode, converted, options} = setup()
    expect(await convertToZip(items, 'jpg', 0.9, {...options, cancelled: () => true}, encode)).toBeNull()
    expect(encode).not.toHaveBeenCalled()
    let cancelled = false
    encode.mockImplementation(async () => {cancelled = true; return new Blob(['image'])})
    expect(await convertToZip(items, 'jpg', 0.9, {...options, cancelled: () => cancelled}, encode)).toBeNull()
    expect(converted).not.toHaveBeenCalled()
  })
  it('reports the source path and discards partial results when an image fails', async () => {
    const {encode, converted, options} = setup()
    encode.mockResolvedValueOnce(new Blob(['image'])).mockRejectedValueOnce(new Error('bad image'))
    await expect(convertToZip(items, 'jpg', 0.9, options, encode)).rejects.toThrow('10.PNG: bad image')
    expect(converted).toHaveBeenCalledOnce()
  })
  it('checks the byte limit before reading a large encoded blob into memory', async () => {
    const {encode, options} = setup()
    const blob = new Blob(['large'])
    Object.defineProperty(blob, 'size', {value: MAX_ZIP_BYTES + 1})
    const arrayBuffer = vi.spyOn(blob, 'arrayBuffer')
    encode.mockResolvedValue(blob)
    await expect(convertToZip(items, 'jpg', 0.9, options, encode)).rejects.toThrow('256 MiB')
    expect(arrayBuffer).not.toHaveBeenCalled()
  })
  it('checks ZIP metadata overhead too, and refuses too many entries', async () => {
    const {encode, options} = setup()
    const blob = new Blob(['image'])
    Object.defineProperty(blob, 'size', {value: MAX_ZIP_BYTES})
    encode.mockResolvedValueOnce(new Blob(['first'])).mockResolvedValue(blob)
    await expect(convertToZip(items, 'jpg', 0.9, options, encode)).rejects.toThrow('256 MiB')
    await expect(convertToZip(Array(65_536).fill(items[0]), 'jpg', 0.9, options, encode)).rejects.toThrow('65,535')
  })
})
