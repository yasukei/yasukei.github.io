import { describe, it, expect } from 'vitest'
import { listDevices, openPermission, stopStream } from './permission-probes'

/**
 * Only what can be checked without a dialog: nothing here asks for the
 * position, the camera or the microphone, so these answer the same on a
 * machine nobody is sitting at.
 */

describe('openPermission', () => {
  it('gives a status to read, or null where the browser will not say', async () => {
    // Firefox and Safari reject some of the names; null is the documented answer then.
    for (const name of ['geolocation', 'camera', 'microphone'] as const) {
      const status = await openPermission(navigator, name)

      if (status) expect(['granted', 'denied', 'prompt']).toContain(status.state)
    }
  })
})

describe('listDevices', () => {
  it('names no device, since nothing was allowed', async () => {
    // Like probeDevices, it gives up after a while where enumerateDevices() never settles.
    const devices = await listDevices(navigator)

    if (devices) expect(devices.every((d) => d.label === '' && d.deviceId === '')).toBe(true)
  })
})

describe('stopStream', () => {
  it('accepts nothing', () => {
    expect(() => stopStream(null)).not.toThrow()
  })
})
