/**
 * The calls behind the permission tab that need a real browser: asking for the
 * position, opening the camera and microphone, listing devices. They are only
 * ever run from a button press, because each one can show a permission dialog.
 * permission-info.ts turns the results into rows.
 */

import { attempt } from './hardware-probes'
import {
  describeMediaError,
  describePositionError,
  levelOf,
  type CameraInfo,
  type DeviceName,
  type MicrophoneInfo,
  type PositionInfo
} from './permission-info'

/** Thrown with wording that is ready to show. */
export class AskFailed extends Error {}

type PermissionName = 'geolocation' | 'camera' | 'microphone'

/** TypeScript's PermissionName does not list 'camera' and 'microphone', which Chromium and Safari accept. */
const descriptor = (name: PermissionName) => ({ name }) as unknown as PermissionDescriptor

/**
 * The PermissionStatus to read `state` from and to listen to `change` on, which
 * stays up to date by itself. Firefox rejects 'camera' and 'microphone'; that,
 * or any failure, is null.
 */
export function openPermission(nav: Navigator, name: PermissionName): Promise<PermissionStatus | null> {
  return attempt(() => nav.permissions.query(descriptor(name)))
}

/** The current position, or an AskFailed saying why not. */
export function getPosition(nav: Navigator): Promise<PositionInfo> {
  return new Promise((resolve, reject) => {
    if (!nav.geolocation) {
      reject(new AskFailed('取得できない (このブラウザは未対応)'))
      return
    }
    nav.geolocation.getCurrentPosition(
      ({ coords, timestamp }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          altitude: coords.altitude,
          altitudeAccuracy: coords.altitudeAccuracy,
          heading: coords.heading,
          speed: coords.speed,
          timestamp
        }),
      (error) => reject(new AskFailed(describePositionError(error.code))),
      // The timeout only starts once the dialog is answered, so a slow reader is not cut off.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

/** getUserMedia() with its rejection turned into an AskFailed. */
export async function openMedia(nav: Navigator, constraints: MediaStreamConstraints): Promise<MediaStream> {
  try {
    if (!nav.mediaDevices?.getUserMedia) throw new TypeError('no mediaDevices')
    return await nav.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    throw new AskFailed(describeMediaError(error instanceof Error ? error.name : String(error)))
  }
}

export function cameraInfo(stream: MediaStream): CameraInfo {
  const track = stream.getVideoTracks()[0]
  if (!track) return { label: '' }
  const s = track.getSettings()
  // Missing in older Firefox, and its ranges are not always there.
  const caps = track.getCapabilities?.()
  return {
    label: track.label,
    width: s.width,
    height: s.height,
    frameRate: s.frameRate,
    facingMode: s.facingMode,
    maxWidth: caps?.width?.max,
    maxHeight: caps?.height?.max
  }
}

export function microphoneInfo(stream: MediaStream): MicrophoneInfo {
  const track = stream.getAudioTracks()[0]
  if (!track) return { label: '' }
  const s = track.getSettings()
  return {
    label: track.label,
    sampleRate: s.sampleRate,
    channelCount: s.channelCount,
    echoCancellation: s.echoCancellation,
    noiseSuppression: s.noiseSuppression,
    autoGainControl: s.autoGainControl
  }
}

/** The devices the browser will name; labels are empty until a stream was allowed. */
export function listDevices(nav: Navigator): Promise<DeviceName[] | null> {
  return attempt(async () => {
    if (!nav.mediaDevices?.enumerateDevices) return null
    const devices = await nav.mediaDevices.enumerateDevices()
    return devices.map((d) => ({ kind: d.kind, label: d.label, deviceId: d.deviceId }))
  })
}

export function stopStream(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop()
}

/** Reads the loudness of a stream about ten times a second. Returns what stops it. */
export function watchLevel(stream: MediaStream, onLevel: (level: number) => void): () => void {
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return () => {}
  const ctx = new AudioContextClass()
  let analyser: AnalyserNode
  try {
    analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
  } catch (error) {
    // Nobody holds on to this context yet, so nobody else would close it.
    void ctx.close()
    throw error
  }
  // Safari starts a context suspended unless the click is still fresh.
  void ctx.resume()

  const samples = new Uint8Array(analyser.fftSize)
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples)
    onLevel(levelOf(samples))
  }, 100)
  return () => {
    clearInterval(timer)
    void ctx.close()
    onLevel(0)
  }
}
