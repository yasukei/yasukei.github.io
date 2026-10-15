import { describe, it, expect } from 'vitest'
import { formatCount, formatLength, formatOf, pickModel, snapshotName } from './model-viewer'

const file = (name: string) => ({ name })

describe('formatOf', () => {
  it('knows the model formats by extension, in any case', () => {
    expect(formatOf('robot.glb')).toBe('glb')
    expect(formatOf('robot.GLTF')).toBe('gltf')
    expect(formatOf('bracket.Stl')).toBe('stl')
    expect(formatOf('chair.obj')).toBe('obj')
  })

  it('does not take what a model refers to for a model', () => {
    expect(formatOf('robot.bin')).toBeNull()
    expect(formatOf('chair.mtl')).toBeNull()
    expect(formatOf('albedo.png')).toBeNull()
  })

  it('goes by the last extension only', () => {
    expect(formatOf('stl.backup.txt')).toBeNull()
    expect(formatOf('part.v2.stl')).toBe('stl')
    expect(formatOf('stl')).toBeNull()
  })
})

describe('pickModel', () => {
  it('finds the model among the files that came with it', () => {
    const gltf = file('robot.gltf')
    const bin = file('robot.bin')
    const texture = file('albedo.png')

    expect(pickModel([texture, gltf, bin])).toEqual({ model: gltf, format: 'gltf', resources: [texture, bin] })
  })

  it('takes the first of several models and keeps the rest as files', () => {
    const first = file('a.stl')
    const second = file('b.glb')

    expect(pickModel([first, second])).toEqual({ model: first, format: 'stl', resources: [second] })
  })

  it('has nothing to show without a model', () => {
    expect(pickModel([file('notes.txt'), file('robot.bin')])).toBeNull()
    expect(pickModel([])).toBeNull()
  })
})

describe('formatLength', () => {
  it('keeps three significant digits for small values', () => {
    expect(formatLength(1.23456)).toBe('1.23')
    expect(formatLength(12.345)).toBe('12.3')
    expect(formatLength(0.0123456)).toBe('0.0123')
  })

  it('does not round off whole units of a large value', () => {
    expect(formatLength(1234.4)).toBe('1234')
    expect(formatLength(40)).toBe('40')
  })

  it('drops trailing zeros', () => {
    expect(formatLength(1.5)).toBe('1.5')
    expect(formatLength(2)).toBe('2')
  })

  it('reads 0 for nothing at all, and for a size that could not be measured', () => {
    expect(formatLength(0)).toBe('0')
    expect(formatLength(Number.NaN)).toBe('0')
    expect(formatLength(Number.POSITIVE_INFINITY)).toBe('0')
  })
})

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(12)).toBe('12')
  })
})

describe('snapshotName', () => {
  it('names the PNG after the model', () => {
    expect(snapshotName('robot.glb')).toBe('robot.png')
    expect(snapshotName('part.v2.stl')).toBe('part.v2.png')
  })

  it('falls back to a generic name', () => {
    expect(snapshotName(null)).toBe('model.png')
    expect(snapshotName('.stl')).toBe('model.png')
  })
})
