<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import InfoPanel from './InfoPanel.vue'
import {
  collectPermission,
  initialPermissionData,
  type Ask,
  type CameraInfo,
  type MicrophoneInfo,
  type PermissionData,
  type PositionInfo
} from '../lib/permission-info'
import {
  AskFailed,
  cameraInfo,
  getPosition,
  listDevices,
  microphoneInfo,
  openMedia,
  queryPermission,
  stopStream,
  watchLevel,
  watchPermission
} from '../lib/permission-probes'

/**
 * The tab for what needs a yes from the visitor. Nothing is requested on
 * load: each button asks once, the answer fills the table, and the camera and
 * microphone keep running until their button is pressed again (or the page is
 * left). The picture and the sound stay on this page; only their properties
 * are listed.
 */

const permissions = ref<PermissionData['permissions']>(initialPermissionData().permissions)
const geolocation = ref<Ask<PositionInfo>>({ status: 'idle' })
const camera = ref<Ask<CameraInfo>>({ status: 'idle' })
const microphone = ref<Ask<MicrophoneInfo>>({ status: 'idle' })
const devices = ref<PermissionData['devices']>(null)
const level = ref(0)

const sections = computed(() =>
  collectPermission({
    permissions: permissions.value,
    geolocation: geolocation.value,
    camera: camera.value,
    microphone: microphone.value,
    devices: devices.value
  })
)

const video = ref<HTMLVideoElement | null>(null)
let cameraStream: MediaStream | null = null
let micStream: MediaStream | null = null
let stopMeter: (() => void) | null = null
let gone = false

async function refresh() {
  const [geo, cam, mic, list] = await Promise.all([
    queryPermission(navigator, 'geolocation'),
    queryPermission(navigator, 'camera'),
    queryPermission(navigator, 'microphone'),
    listDevices(navigator)
  ])
  permissions.value = { geolocation: geo, camera: cam, microphone: mic }
  devices.value = list
}

function failure(error: unknown): Ask<never> {
  return { status: 'failed', message: error instanceof AskFailed ? error.message : '取得できなかった' }
}

async function askPosition() {
  geolocation.value = { status: 'asking' }
  try {
    geolocation.value = { status: 'done', value: await getPosition(navigator) }
  } catch (error) {
    geolocation.value = failure(error)
  }
  refresh()
}

function stopCamera() {
  stopStream(cameraStream)
  cameraStream = null
  if (video.value) video.value.srcObject = null
  camera.value = { status: 'idle' }
}

async function startCamera() {
  camera.value = { status: 'asking' }
  try {
    const stream = await openMedia(navigator, { video: true })
    if (gone) return stopStream(stream)
    cameraStream = stream
    stream.getVideoTracks()[0]?.addEventListener('ended', stopCamera)
    if (video.value) video.value.srcObject = stream
    camera.value = { status: 'done', value: cameraInfo(stream) }
  } catch (error) {
    camera.value = failure(error)
  }
  refresh()
}

function stopMicrophone() {
  stopMeter?.()
  stopMeter = null
  stopStream(micStream)
  micStream = null
  microphone.value = { status: 'idle' }
}

async function startMicrophone() {
  microphone.value = { status: 'asking' }
  try {
    const stream = await openMedia(navigator, { audio: true })
    if (gone) return stopStream(stream)
    micStream = stream
    stream.getAudioTracks()[0]?.addEventListener('ended', stopMicrophone)
    try {
      stopMeter = watchLevel(stream, (value) => (level.value = value))
    } catch {
      // No meter is no reason to give up the microphone itself.
    }
    microphone.value = { status: 'done', value: microphoneInfo(stream) }
  } catch (error) {
    microphone.value = failure(error)
  }
  refresh()
}

const stops: (() => void)[] = []

onMounted(async () => {
  refresh()
  // A change in the browser's own settings, or a plugged-in camera, shows up at once.
  navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
  stops.push(() => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh))
  for (const name of ['geolocation', 'camera', 'microphone'] as const) {
    const stop = await watchPermission(navigator, name, (state) => {
      permissions.value = { ...permissions.value, [name]: state }
    })
    if (!stop) continue
    // Left while waiting for the answer: nobody will unmount again to stop it.
    if (gone) stop()
    else stops.push(stop)
  }
})

onBeforeUnmount(() => {
  gone = true
  stopCamera()
  stopMicrophone()
  for (const stop of stops) stop()
})
</script>

<template>
  <InfoPanel :sections="sections" refreshable @refresh="refresh">
    <template #before-geolocation>
      <div class="pp-ask">
        <button class="pp-btn" :disabled="geolocation.status === 'asking'" @click="askPosition">
          {{ geolocation.status === 'done' ? '現在地をもう一度取得' : '現在地の許可をリクエスト' }}
        </button>
      </div>
    </template>

    <template #before-camera>
      <div>
        <div class="pp-ask">
          <button
            class="pp-btn"
            :disabled="camera.status === 'asking'"
            @click="camera.status === 'done' ? stopCamera() : startCamera()"
          >
            {{ camera.status === 'done' ? 'カメラを止める' : 'カメラの許可をリクエスト' }}
          </button>
        </div>
        <!-- Always mounted so the stream has somewhere to go; only shown while it runs. -->
        <video
          v-show="camera.status === 'done'"
          ref="video"
          class="pp-video"
          autoplay
          muted
          playsinline
          aria-label="カメラの映像 (この画面にだけ映している)"
        ></video>
      </div>
    </template>

    <template #before-microphone>
      <div>
        <div class="pp-ask">
          <button
            class="pp-btn"
            :disabled="microphone.status === 'asking'"
            @click="microphone.status === 'done' ? stopMicrophone() : startMicrophone()"
          >
            {{ microphone.status === 'done' ? 'マイクを止める' : 'マイクの許可をリクエスト' }}
          </button>
        </div>
        <div v-if="microphone.status === 'done'" class="pp-meter" role="img" aria-label="マイクに入っている音の大きさ">
          <div class="pp-meter-bar" :style="{ width: `${level}%` }"></div>
        </div>
      </div>
    </template>
  </InfoPanel>
</template>

<style scoped>
.pp-ask {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}

.pp-btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.pp-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
}

.pp-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.pp-video {
  display: block;
  width: 100%;
  max-width: 480px;
  margin-top: 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}

.pp-meter {
  height: 8px;
  max-width: 480px;
  margin-top: 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.pp-meter-bar {
  height: 100%;
  background: var(--vp-c-brand-1);
  transition: width 0.1s linear;
}
</style>
