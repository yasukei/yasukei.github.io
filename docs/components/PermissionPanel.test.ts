// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import PermissionPanel from './PermissionPanel.vue'

/**
 * What each row says is covered in docs/lib/permission-info.test.ts. Here it
 * is the wiring: nothing is requested before a button is pressed, the answer
 * (or the refusal) lands in the table, and the camera and microphone are
 * released when stopped or when the page is left.
 */

function valueOf(wrapper: ReturnType<typeof mount>, label: string, section?: string): string {
  const scope = section ? wrapper.get(`[data-section="${section}"]`) : wrapper
  const row = scope.findAll('.bi-row').find((r) => r.get('.bi-label-text').text() === label)
  if (!row) throw new Error(`no row "${label}"`)
  // Without the note under it, which has its own wording.
  return row.get('.bi-text, .bi-list, .bi-na').text()
}

function button(wrapper: ReturnType<typeof mount>, text: string) {
  const found = wrapper.findAll('button').find((b) => b.text() === text)
  if (!found) throw new Error(`no button "${text}"`)
  return found
}

function fakeTrack(label: string, settings: Record<string, unknown>) {
  return {
    label,
    stop: vi.fn(),
    getSettings: () => settings,
    getCapabilities: () => ({ width: { max: 1920 }, height: { max: 1080 } }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}

/** Has to be a MediaStream, or a <video> refuses it as its srcObject. */
function fakeStream(video?: ReturnType<typeof fakeTrack>, audio?: ReturnType<typeof fakeTrack>) {
  const videos = video ? [video] : []
  const audios = audio ? [audio] : []
  return Object.assign(new MediaStream(), {
    getVideoTracks: () => videos,
    getAudioTracks: () => audios,
    getTracks: () => [...videos, ...audios]
  })
}

/** Rejects like a browser does: with a DOMException-like error carrying a name. */
function rejection(name: string) {
  return Object.assign(new Error(name), { name })
}

describe('PermissionPanel', () => {
  const getCurrentPosition = vi.fn()
  const getUserMedia = vi.fn()
  const enumerateDevices = vi.fn()
  const query = vi.fn()

  beforeEach(() => {
    getCurrentPosition.mockReset()
    getUserMedia.mockReset()
    enumerateDevices.mockReset().mockResolvedValue([])
    query.mockReset().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition },
      mediaDevices: { getUserMedia, enumerateDevices, addEventListener: vi.fn(), removeEventListener: vi.fn() },
      permissions: { query }
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('asks for nothing until a button is pressed', async () => {
    const wrapper = mount(PermissionPanel)
    await flushPromises()

    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(wrapper.findAll('.bi-section').map((s) => s.attributes('data-section'))).toEqual([
      'geolocation',
      'camera',
      'microphone',
      'device-names'
    ])
    expect(valueOf(wrapper, '緯度')).toContain('未取得')
    wrapper.unmount()
  })

  it('reads the permission state and the device list without asking', async () => {
    enumerateDevices.mockResolvedValue([{ kind: 'videoinput', label: '', deviceId: '' }])
    const wrapper = mount(PermissionPanel)
    await flushPromises()

    expect(valueOf(wrapper, '許可の状態', 'geolocation')).toContain('prompt')
    expect(valueOf(wrapper, 'カメラの名前')).toContain('名前は空')
    wrapper.unmount()
  })

  describe('position', () => {
    it('shows the position that was given', async () => {
      getCurrentPosition.mockImplementation((ok) =>
        ok({
          coords: { latitude: 35.1, longitude: 139.2, accuracy: 15, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
          timestamp: 0
        })
      )
      const wrapper = mount(PermissionPanel)
      await button(wrapper, '現在地の許可をリクエスト').trigger('click')
      await flushPromises()

      expect(valueOf(wrapper, '緯度')).toBe('35.100000')
      expect(valueOf(wrapper, '経度')).toBe('139.200000')
      expect(valueOf(wrapper, '誤差の範囲')).toBe('15 m')
      expect(button(wrapper, '現在地をもう一度取得').exists()).toBe(true)
      wrapper.unmount()
    })

    it('shows that it was refused', async () => {
      getCurrentPosition.mockImplementation((_, fail) => fail({ code: 1 }))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, '現在地の許可をリクエスト').trigger('click')
      await flushPromises()

      expect(valueOf(wrapper, '緯度')).toContain('許可されなかった')
      // Can be tried again after a refusal.
      expect(button(wrapper, '現在地の許可をリクエスト').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })

    it('does not offer a second request while the dialog is open', async () => {
      getCurrentPosition.mockImplementation(() => {})
      const wrapper = mount(PermissionPanel)
      await button(wrapper, '現在地の許可をリクエスト').trigger('click')
      await flushPromises()

      expect(button(wrapper, '現在地の許可をリクエスト').attributes('disabled')).toBeDefined()
      expect(valueOf(wrapper, '緯度')).toContain('待っています')
      wrapper.unmount()
    })
  })

  describe('camera', () => {
    it('shows the camera it got, and lets go of it when stopped', async () => {
      const track = fakeTrack('Integrated Camera', { width: 640, height: 480, frameRate: 30 })
      getUserMedia.mockResolvedValue(fakeStream(track))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'カメラの許可をリクエスト').trigger('click')
      await flushPromises()

      expect(getUserMedia).toHaveBeenCalledWith({ video: true })
      expect(valueOf(wrapper, '使っているカメラ')).toBe('Integrated Camera')
      expect(valueOf(wrapper, '映像の大きさ')).toBe('640 × 480')
      expect(valueOf(wrapper, '出せる最大の大きさ')).toBe('1920 × 1080')

      await button(wrapper, 'カメラを止める').trigger('click')

      expect(track.stop).toHaveBeenCalled()
      expect(valueOf(wrapper, '使っているカメラ')).toContain('未取得')
      wrapper.unmount()
    })

    it('says when there is no camera', async () => {
      getUserMedia.mockRejectedValue(rejection('NotFoundError'))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'カメラの許可をリクエスト').trigger('click')
      await flushPromises()

      expect(valueOf(wrapper, '映像の取得')).toContain('見つからなかった')
      wrapper.unmount()
    })

    it('names the devices once the stream was allowed', async () => {
      const track = fakeTrack('Logitech C920', {})
      getUserMedia.mockResolvedValue(fakeStream(track))
      enumerateDevices.mockResolvedValue([{ kind: 'videoinput', label: 'Logitech C920', deviceId: 'abc' }])
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'カメラの許可をリクエスト').trigger('click')
      await flushPromises()

      expect(valueOf(wrapper, 'カメラの名前')).toBe('Logitech C920')
      wrapper.unmount()
    })

    it('releases the camera when the page is left', async () => {
      const track = fakeTrack('cam', {})
      getUserMedia.mockResolvedValue(fakeStream(track))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'カメラの許可をリクエスト').trigger('click')
      await flushPromises()

      wrapper.unmount()

      expect(track.stop).toHaveBeenCalled()
    })

    it('lets go of a camera that arrives after the page was left', async () => {
      const track = fakeTrack('cam', {})
      let allow: (stream: unknown) => void = () => {}
      getUserMedia.mockReturnValue(new Promise((resolve) => (allow = resolve)))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'カメラの許可をリクエスト').trigger('click')

      wrapper.unmount()
      allow(fakeStream(track))
      await flushPromises()

      expect(track.stop).toHaveBeenCalled()
    })
  })

  describe('microphone', () => {
    it('shows the microphone it got, and stops it', async () => {
      const track = fakeTrack('Built-in Microphone', { sampleRate: 48000, channelCount: 1 })
      getUserMedia.mockResolvedValue(fakeStream(undefined, track))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'マイクの許可をリクエスト').trigger('click')
      await flushPromises()

      expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
      expect(valueOf(wrapper, '使っているマイク')).toBe('Built-in Microphone')
      expect(valueOf(wrapper, 'サンプリングレート')).toBe('48000 Hz')

      await button(wrapper, 'マイクを止める').trigger('click')

      expect(track.stop).toHaveBeenCalled()
      wrapper.unmount()
    })

    it('shows that it was refused', async () => {
      getUserMedia.mockRejectedValue(rejection('NotAllowedError'))
      const wrapper = mount(PermissionPanel)
      await button(wrapper, 'マイクの許可をリクエスト').trigger('click')
      await flushPromises()

      expect(valueOf(wrapper, '音声の取得')).toContain('許可されなかった')
      wrapper.unmount()
    })
  })

  it('follows a change of permission made in the browser settings', async () => {
    // One status object serves all three names, so each of them listens to it.
    const listeners: (() => void)[] = []
    const status = {
      state: 'prompt',
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: vi.fn()
    }
    query.mockResolvedValue(status)
    const wrapper = mount(PermissionPanel)
    await flushPromises()
    expect(valueOf(wrapper, '許可の状態', 'geolocation')).toContain('prompt')

    status.state = 'granted'
    for (const fn of listeners) fn()
    await flushPromises()

    expect(valueOf(wrapper, '許可の状態', 'geolocation')).toContain('granted')
    wrapper.unmount()
  })

  it('copes with a browser that lacks all of it', async () => {
    vi.stubGlobal('navigator', {})
    const wrapper = mount(PermissionPanel)
    await flushPromises()

    expect(valueOf(wrapper, 'カメラの名前')).toContain('未対応')
    await button(wrapper, 'カメラの許可をリクエスト').trigger('click')
    await flushPromises()
    expect(valueOf(wrapper, '映像の取得')).toContain('使えない')
    await button(wrapper, '現在地の許可をリクエスト').trigger('click')
    await flushPromises()
    expect(valueOf(wrapper, '緯度')).toContain('未対応')
    wrapper.unmount()
  })
})
