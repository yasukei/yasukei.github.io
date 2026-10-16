import { describe, expect, it, vi } from 'vitest'
import { convertBatch, numberedName, planConversion, validStart, type ImageDirectory, type ImageFileHandle } from './batch-image-convert'

function file(name: string): ImageFileHandle & { name: string } {
  return { kind: 'file', name, getFile: vi.fn(async () => new File(['image'], name)), isSameEntry: vi.fn(async () => true), createWritable: vi.fn() }
}
function dir(name: string, entries: (ImageDirectory | (ImageFileHandle & {name: string}))[] = []): ImageDirectory {
  const result: ImageDirectory = {
    kind: 'directory', name,
    async *values() { yield* entries },
    resolve: vi.fn(async other => other === result ? [] : null),
    removeEntry: vi.fn(async () => {}),
    getFileHandle: vi.fn(async () => { throw new DOMException('missing', 'NotFoundError') })
  }
  return result
}

describe('batch planning', () => {
  it('pads to at least three digits and accepts only safe nonnegative integers', () => {
    expect(numberedName(1, 'jpg')).toBe('001.jpg')
    expect(numberedName(999, 'webp')).toBe('999.webp')
    expect(numberedName(1000, 'png')).toBe('1000.png')
    expect(validStart('0')).toBe(true)
    for (const value of ['', '-1', '1.2', '1e2', 'Infinity', '9007199254740992']) expect(validStart(value)).toBe(false)
    expect(() => numberedName(Number.MAX_SAFE_INTEGER + 1, 'jpg')).toThrow()
  })
  it('recurses, filters case-insensitively, orders paths naturally, and uses a custom start', async () => {
    const src = dir('src', [file('10.PNG'), dir('nested', [file('a.png')]), file('2.png'), file('ignore.jpg')])
    const result = await planConversion(src, dir('dst'), 'png', 'jpg', 998)
    expect(result.map(x => [x.path, x.output])).toEqual([
      ['2.png', '998.jpg'], ['10.PNG', '999.jpg'], ['nested/a.png', '1000.jpg']
    ])
  })
  it('treats jpg and jpeg as the same input format', async () => {
    expect(await planConversion(dir('src', [file('a.JPEG'), file('b.jpg'), file('c.png')]), dir('dst'), 'jpg', 'webp', 0)).toHaveLength(2)
  })
  it('rejects overlapping destinations and unsafe ranges', async () => {
    const src = dir('src', [file('a.png'), file('b.png')])
    await expect(planConversion(src, src, 'png', 'jpg', 1)).rejects.toThrow('別のフォルダ')
    vi.mocked(src.resolve).mockResolvedValue(['nested'])
    await expect(planConversion(src, dir('dst'), 'png', 'jpg', 1)).rejects.toThrow('サブフォルダ')
    vi.mocked(src.resolve).mockResolvedValue(null)
    await expect(planConversion(src, dir('dst'), 'png', 'jpg', Number.MAX_SAFE_INTEGER)).rejects.toThrow('安全な整数')
  })
  it('stops at existing names and propagates permission errors', async () => {
    const src = dir('src', [file('a.png')]), dst = dir('dst')
    vi.mocked(dst.getFileHandle).mockResolvedValue(file('001.jpg'))
    await expect(planConversion(src, dst, 'png', 'jpg', 1)).rejects.toThrow('既にあります')
    vi.mocked(dst.getFileHandle).mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await expect(planConversion(src, dst, 'png', 'jpg', 1)).rejects.toThrow('denied')
  })
})

describe('batch writing', () => {
  function setup() {
    const writable = { write: vi.fn(async (_: Blob) => {}), close: vi.fn(async () => {}), abort: vi.fn(async () => {}) }
    const dst = dir('dst')
    const created = new Map<string, ImageFileHandle>()
    vi.mocked(dst.getFileHandle).mockImplementation(async (name, options) => {
      if (created.has(name)) return created.get(name)!
      if (!options?.create) throw new DOMException('missing', 'NotFoundError')
      const handle = {...file(name), getFile: async () => new File([], name), createWritable: vi.fn(async () => writable)}
      created.set(name, handle)
      return handle
    })
    vi.mocked(dst.removeEntry).mockImplementation(async name => { created.delete(name) })
    const items = ['a.png', 'b.png'].map((path, i) => ({ path, handle: file(path), output: numberedName(i + 1, 'jpg') }))
    const encode = vi.fn(async () => new Blob(['jpeg'], {type: 'image/jpeg'}))
    const saved = vi.fn()
    return {writable, dst, items, encode, saved}
  }
  it('writes sequentially and reports only closed files', async () => {
    const {writable, dst, items, encode, saved} = setup()
    await convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)
    expect(writable.close).toHaveBeenCalledTimes(2)
    expect(saved.mock.calls.map(([item]) => item.output)).toEqual(['001.jpg', '002.jpg'])
  })
  it('does not create a file when encoding fails', async () => {
    const {dst, items, encode, saved} = setup()
    encode.mockRejectedValue(new Error('bad image'))
    await expect(convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)).rejects.toThrow('a.png: bad image')
    expect(dst.getFileHandle).not.toHaveBeenCalled()
    expect(saved).not.toHaveBeenCalled()
  })
  it('stops after cancellation, keeping completed files', async () => {
    const {dst, items, encode, saved} = setup()
    await convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => saved.mock.calls.length > 0, saved}, encode)
    expect(encode).toHaveBeenCalledTimes(1)
  })
  it('aborts failed writes and does not report them as saved', async () => {
    const {writable, dst, items, encode, saved} = setup()
    writable.write.mockRejectedValue(new Error('disk full'))
    await expect(convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)).rejects.toThrow('a.png: disk full')
    expect(writable.abort).toHaveBeenCalledOnce()
    expect(saved).not.toHaveBeenCalled()
    expect(dst.removeEntry).toHaveBeenCalledWith('001.jpg')
    writable.write.mockResolvedValue()
    await convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)
    expect(saved).toHaveBeenCalledTimes(2)
  })
  it('cleans up when opening a writable fails', async () => {
    const {dst, items, encode, saved} = setup()
    const handle = await dst.getFileHandle('001.jpg', {create: true})
    vi.mocked(handle.createWritable).mockRejectedValue(new Error('denied'))
    vi.mocked(dst.getFileHandle).mockReset().mockRejectedValueOnce(new DOMException('missing', 'NotFoundError')).mockResolvedValue(handle)
    await expect(convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)).rejects.toThrow('denied')
    expect(dst.removeEntry).toHaveBeenCalledWith('001.jpg')
  })
  it('preserves an external replacement after a failed write', async () => {
    const {writable, dst, items, encode, saved} = setup()
    writable.write.mockImplementation(async () => {
      vi.mocked(dst.getFileHandle).mockResolvedValue({...file('001.jpg'), getFile: async () => new File(['external'], '001.jpg')})
      throw new Error('write failed')
    })
    await expect(convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)).rejects.toThrow('write failed')
    expect(dst.removeEntry).not.toHaveBeenCalled()
  })
  it('rechecks collisions after encoding before opening a writable', async () => {
    const {dst, items, encode, saved} = setup()
    vi.mocked(dst.getFileHandle).mockResolvedValue(file('001.jpg'))
    await expect(convertBatch(items, dst, 'jpg', 0.9, {cancelled: () => false, saved}, encode)).rejects.toThrow('既にあります')
    expect(dst.getFileHandle).toHaveBeenCalledExactlyOnceWith('001.jpg')
  })
})
