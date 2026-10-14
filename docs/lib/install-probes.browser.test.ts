import { describe, it, expect } from 'vitest'
import { probeFonts, probeStorage, probeVoices } from './install-probes'

describe('probeFonts', () => {
  it('finds the same fonts twice', () => {
    const first = probeFonts()

    expect(first).not.toBeNull()
    expect(probeFonts()).toEqual(first)
  })

  it('does not take a made-up font for an installed one', () => {
    // If every candidate came back, the fallback comparison would be broken.
    const ctx = document.createElement('canvas').getContext('2d')!
    ctx.font = '72px monospace'
    const fallback = ctx.measureText('mmmmmmmmmmlli1').width
    ctx.font = '72px "No Such Font 4f9c2", monospace'

    expect(ctx.measureText('mmmmmmmmmmlli1').width).toBe(fallback)
  })
})

describe('probeVoices', () => {
  it('answers with a list, or null where there is no speech synthesis', async () => {
    const voices = await probeVoices()

    if (voices !== null) expect(Array.isArray(voices)).toBe(true)
  })
})

describe('probeStorage', () => {
  it('gives a quota larger than what is used', async () => {
    const storage = await probeStorage(navigator)

    expect(storage).not.toBeNull()
    expect(storage!.quota).toBeGreaterThan(0)
    expect(storage!.quota!).toBeGreaterThanOrEqual(storage!.usage!)
  })
})
