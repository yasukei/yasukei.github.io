import { describe, it, expect } from 'vitest'
import { attempt, probeAudio, probeCanvas, probeDevices, probeWebGL, runProbes } from './hardware-probes'

/**
 * A fingerprint is only worth anything if it comes out the same every time on
 * the same machine, so that is what these check in each engine. That the
 * values differ between machines cannot be tested from one machine.
 */

describe('probeCanvas', () => {
  it('draws something, and the same thing twice', () => {
    const first = probeCanvas()
    const second = probeCanvas()

    expect(first?.image).toMatch(/^data:image\/png;base64,/)
    expect(first?.hash).toMatch(/^[0-9a-f]{8}$/)
    expect(second?.hash).toBe(first?.hash)
  })
})

describe('probeAudio', () => {
  it('renders the same samples twice', async () => {
    const first = await probeAudio()
    const second = await probeAudio()

    expect(first).not.toBeNull()
    expect(first!.sum).toBeGreaterThan(0)
    expect(second).toEqual(first)
  })
})

describe('probeWebGL', () => {
  it('renders the same pixels twice, where there is WebGL at all', () => {
    // Headless runs may have no GPU; null is the documented answer then.
    const first = probeWebGL()
    if (first === null) return

    expect(first.info.maxTextureSize).toBeGreaterThan(0)
    expect(first.image?.hash).toBe(probeWebGL()?.image?.hash)
  })
})

describe('probeDevices', () => {
  it('counts without names, since nothing was allowed', async () => {
    // enumerateDevices() may wait until the page is visible, and in Firefox on
    // the CI runner it never settles. The page goes through attempt() too.
    const counts = await attempt(() => probeDevices(navigator))

    // No permission was asked for, so no device may be named.
    if (counts) expect(counts.labelled).toBe(0)
  })
})

describe('runProbes', () => {
  it('answers for every probe without throwing', async () => {
    const probes = await runProbes(navigator)

    expect(Object.keys(probes).sort()).toEqual(
      ['audio', 'battery', 'canvas', 'devices', 'webgl', 'webglImage', 'webgpu'].sort()
    )
    expect(probes.canvas).not.toBeNull()
  })
})
