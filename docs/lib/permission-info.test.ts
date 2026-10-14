import { describe, it, expect } from 'vitest'
import {
  cameraSection,
  collectPermission,
  describeMediaError,
  describePositionError,
  devicesSection,
  geolocationSection,
  initialPermissionData,
  levelOf,
  microphoneSection,
  type Ask,
  type DeviceName,
  type PositionInfo
} from './permission-info'
import type { Section } from './browser-info'

function row(section: Section, label: string) {
  const found = section.rows.find((r) => r.label === label)
  if (!found) throw new Error(`no row "${label}" in ${section.id}`)
  return found
}

const POSITION: PositionInfo = {
  latitude: 35.681236,
  longitude: 139.767125,
  accuracy: 23,
  altitude: null,
  altitudeAccuracy: null,
  heading: null,
  speed: null,
  timestamp: Date.UTC(2026, 9, 14, 3, 0, 0)
}

describe('geolocationSection', () => {
  it('says nothing has been asked yet, rather than showing empty values', () => {
    const section = geolocationSection(null, { status: 'idle' })

    expect(row(section, '緯度').value).toBeNull()
    expect(row(section, '緯度').missing).toContain('未取得')
  })

  it('shows the position once it was given', () => {
    const section = geolocationSection('granted', { status: 'done', value: POSITION })

    expect(row(section, '緯度').value).toBe('35.681236')
    expect(row(section, '経度').value).toBe('139.767125')
    expect(row(section, '誤差の範囲').value).toBe('23 m')
  })

  it('marks what the device did not measure as such, not as unsupported', () => {
    const section = geolocationSection(null, { status: 'done', value: POSITION })

    expect(row(section, '高度').value).toBeNull()
    expect(row(section, '高度').missing).toContain('測っていない')
  })

  it('formats altitude, heading and speed where the device has them', () => {
    const section = geolocationSection(null, {
      status: 'done',
      value: { ...POSITION, altitude: 12.34, heading: 90, speed: 1.5 }
    })

    expect(row(section, '高度').value).toBe('12.3 m')
    expect(row(section, '進んでいる向き').value).toBe('90.0°')
    expect(row(section, '速さ').value).toBe('1.5 m/s')
  })

  it('carries the reason when the request failed, on every row', () => {
    const ask: Ask<PositionInfo> = { status: 'failed', message: describePositionError(1) }
    const section = geolocationSection('denied', ask)

    for (const label of ['緯度', '経度', '誤差の範囲']) {
      expect(row(section, label).value).toBeNull()
      expect(row(section, label).missing).toContain('許可されなかった')
    }
    expect(row(section, '許可の状態').value).toContain('denied')
  })

  it('shows the permission state even before asking', () => {
    const section = geolocationSection('granted', { status: 'idle' })

    expect(row(section, '許可の状態').value).toContain('granted')
  })

  it('leaves the permission state out where the browser will not say', () => {
    const state = row(geolocationSection(null, { status: 'idle' }), '許可の状態')

    expect(state.value).toBeNull()
    expect(state.missing).toContain('調べさせない')
  })
})

describe('cameraSection', () => {
  it('describes the picture the camera gives', () => {
    const section = cameraSection('granted', {
      status: 'done',
      value: {
        label: 'Integrated Camera',
        width: 1280,
        height: 720,
        frameRate: 29.97,
        facingMode: 'user',
        maxWidth: 1920,
        maxHeight: 1080
      }
    })

    expect(row(section, '使っているカメラ').value).toBe('Integrated Camera')
    expect(row(section, '映像の大きさ').value).toBe('1280 × 720')
    expect(row(section, 'フレームレート').value).toBe('30 fps')
    expect(row(section, '出せる最大の大きさ').value).toBe('1920 × 1080')
    expect(row(section, '向き').value).toContain('user')
    expect(row(section, '映像の取得').value).toContain('取得中')
  })

  it('does not claim a stream before there is one', () => {
    const section = cameraSection(null, { status: 'asking' })

    expect(row(section, '映像の取得').value).toBeNull()
    expect(row(section, '映像の取得').missing).toContain('待っています')
  })

  it('leaves out what the browser did not report', () => {
    const section = cameraSection(null, { status: 'done', value: { label: 'cam' } })

    expect(row(section, '映像の大きさ').value).toBeNull()
    expect(row(section, '出せる最大の大きさ').value).toBeNull()
  })
})

describe('microphoneSection', () => {
  it('lists the audio settings the browser applies', () => {
    const section = microphoneSection('prompt', {
      status: 'done',
      value: {
        label: 'Built-in Microphone',
        sampleRate: 48000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false
      }
    })

    expect(row(section, 'サンプリングレート').value).toBe('48000 Hz')
    expect(row(section, 'チャンネル数').value).toBe('1')
    expect(row(section, 'エコー除去・ノイズ抑制・自動音量調整').value).toEqual([
      'echoCancellation: on',
      'noiseSuppression: off',
      'autoGainControl: -'
    ])
  })

  it('shows why the request failed', () => {
    const section = microphoneSection(null, { status: 'failed', message: describeMediaError('NotFoundError') })

    expect(row(section, '音声の取得').missing).toContain('見つからなかった')
  })
})

describe('devicesSection', () => {
  const devices: DeviceName[] = [
    { kind: 'videoinput', label: 'Logitech C920', deviceId: 'a1' },
    { kind: 'audioinput', label: 'Blue Yeti', deviceId: 'b2' },
    { kind: 'audioinput', label: 'Webcam Mic', deviceId: 'c3' },
    { kind: 'audiooutput', label: 'AirPods Pro', deviceId: 'd4' }
  ]

  it('names each kind of device', () => {
    const section = devicesSection(devices)

    expect(row(section, 'カメラの名前').value).toEqual(['Logitech C920'])
    expect(row(section, 'マイクの名前').value).toEqual(['Blue Yeti', 'Webcam Mic'])
    expect(row(section, 'スピーカー・ヘッドホンの名前').value).toEqual(['AirPods Pro'])
  })

  it('hashes the ids the same way for the same devices', () => {
    const hash = row(devicesSection(devices), '機器IDのハッシュ').value

    expect(hash).toMatch(/^[0-9a-f]{8}$/)
    expect(row(devicesSection([...devices]), '機器IDのハッシュ').value).toBe(hash)
    expect(row(devicesSection(devices.slice(1)), '機器IDのハッシュ').value).not.toBe(hash)
  })

  it('says the names are empty before permission, not that there are none', () => {
    const unnamed = devices.map((d) => ({ ...d, label: '', deviceId: '' }))
    const section = devicesSection(unnamed)

    expect(row(section, 'カメラの名前').value).toBeNull()
    expect(row(section, 'カメラの名前').missing).toContain('名前は空')
    expect(row(section, '機器IDのハッシュ').value).toBeNull()
  })

  it('tells a missing API from a machine without devices', () => {
    expect(row(devicesSection(null), 'カメラの名前').missing).toContain('未対応')
    expect(row(devicesSection([]), 'カメラの名前').missing).toBe('見つからなかった')
  })
})

describe('collectPermission', () => {
  it('lists the sections in order, all of them while nothing was asked', () => {
    const sections = collectPermission(initialPermissionData())

    expect(sections.map((s) => s.id)).toEqual(['geolocation', 'camera', 'microphone', 'device-names'])
  })

  it('has a unique label in each section, as the table keys rows by it', () => {
    for (const section of collectPermission(initialPermissionData())) {
      const labels = section.rows.map((r) => r.label)
      expect(new Set(labels).size).toBe(labels.length)
    }
  })
})

describe('describeMediaError', () => {
  it('words the common failures', () => {
    expect(describeMediaError('NotAllowedError')).toContain('許可されなかった')
    expect(describeMediaError('NotFoundError')).toContain('見つからなかった')
    expect(describeMediaError('NotReadableError')).toContain('他のアプリ')
  })

  it('keeps the name of one it does not know', () => {
    expect(describeMediaError('WeirdError')).toContain('WeirdError')
  })
})

describe('describePositionError', () => {
  it('words the three codes of GeolocationPositionError', () => {
    expect(describePositionError(1)).toContain('許可されなかった')
    expect(describePositionError(2)).toContain('決められなかった')
    expect(describePositionError(3)).toContain('時間内')
  })
})

describe('levelOf', () => {
  it('is 0 for silence and for no samples', () => {
    expect(levelOf(new Uint8Array(256).fill(128))).toBe(0)
    expect(levelOf(new Uint8Array(0))).toBe(0)
  })

  it('grows with the loudness and stops at 100', () => {
    const wave = (amplitude: number) => Uint8Array.from({ length: 256 }, (_, i) => 128 + (i % 2 ? amplitude : -amplitude))

    expect(levelOf(wave(10))).toBeGreaterThan(0)
    expect(levelOf(wave(40))).toBeGreaterThan(levelOf(wave(10)))
    expect(levelOf(wave(127))).toBe(100)
  })
})
