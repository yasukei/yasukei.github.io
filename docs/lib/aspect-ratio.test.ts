import { describe, it, expect } from 'vitest'
import {
  PRESETS,
  formatDimension,
  formatRatio,
  heightFor,
  parseDimension,
  parseRatio,
  simplifyRatio,
  widthFor
} from './aspect-ratio'

const R16_9 = { width: 16, height: 9 }

describe('parseRatio', () => {
  it('reads the separators people actually type', () => {
    for (const input of ['16:9', '16/9', '16x9', '16×9', '16 9']) {
      expect(parseRatio(input), input).toEqual(R16_9)
    }
  })

  it('ignores surrounding and inner spacing', () => {
    expect(parseRatio('  16 : 9  ')).toEqual(R16_9)
  })

  it('takes a bare number as <value>:1', () => {
    expect(parseRatio('1.7778')).toEqual({ width: 1.7778, height: 1 })
  })

  it('keeps fractional sides, which the cinema and paper ratios need', () => {
    expect(parseRatio('2.39:1')).toEqual({ width: 2.39, height: 1 })
    expect(parseRatio('1.414:1')).toEqual({ width: 1.414, height: 1 })
  })

  it('accepts a leading decimal point', () => {
    expect(parseRatio('.5:1')).toEqual({ width: 0.5, height: 1 })
  })

  it('rejects a zero side, which has no reciprocal', () => {
    expect(parseRatio('16:0')).toBeNull()
    expect(parseRatio('0:9')).toBeNull()
  })

  it('rejects negatives', () => {
    expect(parseRatio('-16:9')).toBeNull()
    expect(parseRatio('16:-9')).toBeNull()
  })

  it('rejects trailing junk rather than reading the number out of it', () => {
    // parseFloat would take "16abc" as 16 and quietly calculate with a typo.
    expect(parseRatio('16abc:9')).toBeNull()
    expect(parseRatio('16:9px')).toBeNull()
  })

  it('rejects the incomplete and the empty', () => {
    expect(parseRatio('')).toBeNull()
    expect(parseRatio('   ')).toBeNull()
    expect(parseRatio(':')).toBeNull()
    expect(parseRatio('16:')).toBeNull()
    expect(parseRatio(':9')).toBeNull()
    expect(parseRatio('16:9:3')).toBeNull()
  })
})

describe('parseDimension', () => {
  it('reads whole numbers and decimals', () => {
    expect(parseDimension('1920')).toBe(1920)
    expect(parseDimension(' 12.5 ')).toBe(12.5)
  })

  it('allows zero, which is what an empty box grows out of', () => {
    expect(parseDimension('0')).toBe(0)
  })

  it('rejects what is not a plain number', () => {
    expect(parseDimension('')).toBeNull()
    expect(parseDimension('-5')).toBeNull()
    expect(parseDimension('1920px')).toBeNull()
    expect(parseDimension('1,920')).toBeNull()
    expect(parseDimension('1e3')).toBeNull()
  })
})

describe('widthFor / heightFor', () => {
  it('completes the familiar 16:9 sizes', () => {
    expect(widthFor(1080, R16_9)).toBe(1920)
    expect(heightFor(1920, R16_9)).toBe(1080)
    expect(heightFor(3840, R16_9)).toBe(2160)
  })

  it('works from either side of a fractional ratio', () => {
    const cinema = { width: 2.39, height: 1 }

    expect(heightFor(2390, cinema)).toBe(1000)
    expect(widthFor(1000, cinema)).toBe(2390)
  })

  it('round trips: the computed side gives back the one it came from', () => {
    const height = heightFor(1280, R16_9) as number

    expect(widthFor(height, R16_9)).toBe(1280)
  })

  it('maps zero to zero', () => {
    expect(heightFor(0, R16_9)).toBe(0)
    expect(widthFor(0, R16_9)).toBe(0)
  })

  it('refuses a negative or non-finite side', () => {
    expect(heightFor(-100, R16_9)).toBeNull()
    expect(widthFor(Number.NaN, R16_9)).toBeNull()
    expect(heightFor(Number.POSITIVE_INFINITY, R16_9)).toBeNull()
  })

  it('refuses a ratio that cannot be divided by', () => {
    expect(heightFor(1920, { width: 0, height: 9 })).toBeNull()
    expect(widthFor(1080, { width: 16, height: 0 })).toBeNull()
    expect(heightFor(1920, { width: Number.NaN, height: 9 })).toBeNull()
  })
})

describe('simplifyRatio', () => {
  it('reduces whole numbers', () => {
    expect(simplifyRatio({ width: 1920, height: 1080 })).toEqual(R16_9)
    expect(simplifyRatio({ width: 100, height: 100 })).toEqual({ width: 1, height: 1 })
  })

  it('leaves an already reduced ratio alone', () => {
    expect(simplifyRatio(R16_9)).toEqual(R16_9)
  })

  it('leaves fractional ratios in the form they are known by', () => {
    // 2.39:1 reduced from 239:100 would no longer be recognisable.
    expect(simplifyRatio({ width: 2.39, height: 1 })).toEqual({ width: 2.39, height: 1 })
  })
})

describe('formatDimension', () => {
  it('clears binary floating point fuzz', () => {
    expect(formatDimension(1707.7000000000003, 1)).toBe('1707.7')
  })

  it('drops the decimal part when there is none left', () => {
    expect(formatDimension(1080)).toBe('1080')
    expect(formatDimension(1079.999, 0)).toBe('1080')
  })

  it('returns nothing for a non-number', () => {
    expect(formatDimension(Number.NaN)).toBe('')
  })
})

describe('formatRatio', () => {
  it('writes a ratio the way it is read back in', () => {
    expect(formatRatio(R16_9)).toBe('16:9')
    expect(formatRatio({ width: 1.414, height: 1 })).toBe('1.414:1')
    expect(parseRatio(formatRatio({ width: 2.39, height: 1 }))).toEqual({ width: 2.39, height: 1 })
  })
})

describe('PRESETS', () => {
  it('labels each preset with a string that parses back to its ratio', () => {
    for (const preset of PRESETS) {
      expect(parseRatio(preset.label), preset.label).toEqual(preset.ratio)
    }
  })

  it('has no duplicate labels, since the label identifies the preset', () => {
    const labels = PRESETS.map((preset) => preset.label)

    expect(new Set(labels).size).toBe(labels.length)
  })
})
