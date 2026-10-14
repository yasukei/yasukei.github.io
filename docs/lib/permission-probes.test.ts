// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { watchLevel } from './permission-probes'

/** A stand-in for the AudioContext of a browser, with the calls watchLevel makes. */
function fakeAudioContext(options: { failOn?: 'createAnalyser' | 'createMediaStreamSource' } = {}) {
  const close = vi.fn().mockResolvedValue(undefined)
  class FakeAudioContext {
    close = close
    resume = vi.fn().mockResolvedValue(undefined)
    createAnalyser() {
      if (options.failOn === 'createAnalyser') throw new Error('no analyser')
      return { fftSize: 0, getByteTimeDomainData: (samples: Uint8Array) => samples.fill(128) }
    }
    createMediaStreamSource() {
      if (options.failOn === 'createMediaStreamSource') throw new Error('no source')
      return { connect: vi.fn() }
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext)
  return { close }
}

describe('watchLevel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('closes the context when it cannot be set up, so that failed attempts do not pile up', () => {
    for (const failOn of ['createAnalyser', 'createMediaStreamSource'] as const) {
      const { close } = fakeAudioContext({ failOn })

      expect(() => watchLevel({} as MediaStream, () => {})).toThrow()
      expect(close).toHaveBeenCalledTimes(1)
    }
  })

  it('reports silence as 0 about ten times a second, and closes the context when stopped', () => {
    vi.useFakeTimers()
    const { close } = fakeAudioContext()
    const levels: number[] = []

    const stop = watchLevel({} as MediaStream, (level) => levels.push(level))
    vi.advanceTimersByTime(350)
    expect(levels).toEqual([0, 0, 0])

    stop()
    expect(close).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    // Only the reset to 0 that stopping sends.
    expect(levels).toHaveLength(4)
  })

  it('does nothing where there is no AudioContext', () => {
    vi.stubGlobal('AudioContext', undefined)

    expect(() => watchLevel({} as MediaStream, () => {})()).not.toThrow()
  })
})
