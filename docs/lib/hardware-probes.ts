/**
 * The hardware values that have to be produced in a real browser: drawn on a
 * canvas, rendered with WebGL or an OfflineAudioContext, or awaited from an
 * API. hardware-info.ts turns the results into rows.
 *
 * Every probe is allowed to fail. A missing API, a refused call, or one that
 * never answers all end up as null rather than as an error, so one browser's
 * gap never hides the rest of the page.
 */

import {
  fnv1a,
  type AudioProbe,
  type BatteryInfo,
  type DeviceCounts,
  type HardwareProbes,
  type ImageProbe,
  type WebGLInfo,
  type WebGPUInfo
} from './hardware-info'

/** The navigator APIs used here that TypeScript's DOM types do not include. */
interface ProbeNavigator {
  mediaDevices?: { enumerateDevices(): Promise<{ kind: string; label: string }[]> }
  getBattery?: () => Promise<BatteryInfo>
  gpu?: {
    requestAdapter(): Promise<{
      info?: Partial<WebGPUInfo>
      requestAdapterInfo?: () => Promise<Partial<WebGPUInfo>>
    } | null>
  }
}

const TIMEOUT_MS = 3000

/** Runs a probe, turning a throw, a rejection or a timeout into null. */
export async function attempt<T>(probe: () => T | Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), TIMEOUT_MS)
  })
  try {
    return await Promise.race([Promise.resolve().then(probe), timeout])
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** The classic canvas fingerprint: text with an emoji, overlapping fills, a gradient. */
export function probeCanvas(): ImageProbe | null {
  const canvas = document.createElement('canvas')
  canvas.width = 280
  canvas.height = 60
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const text = 'Cwm fjordbank glyphs vext quiz, 😃 あ'
  ctx.textBaseline = 'top'
  ctx.font = '16px Arial'
  ctx.fillStyle = '#f60'
  ctx.fillRect(130, 4, 70, 22)
  ctx.fillStyle = '#069'
  ctx.fillText(text, 4, 8)
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
  ctx.fillText(text, 6, 10)

  const gradient = ctx.createLinearGradient(0, 0, 280, 0)
  gradient.addColorStop(0, '#c0f')
  gradient.addColorStop(1, '#0cf')
  ctx.fillStyle = gradient
  ctx.globalCompositeOperation = 'multiply'
  ctx.beginPath()
  ctx.arc(240, 38, 18, 0, Math.PI * 2)
  ctx.fill()

  const image = canvas.toDataURL()
  return { hash: fnv1a(image), image }
}

const VERTEX_SHADER = `
attribute vec2 position;
attribute vec3 color;
varying vec3 vColor;
void main() {
  vColor = color;
  gl_Position = vec4(position, 0.0, 1.0);
}`

// The sin() makes the GPU's float precision show up in the colours.
const FRAGMENT_SHADER = `
precision mediump float;
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(sin(vColor * 37.0) * 0.5 + 0.5, 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('no shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? '')
  return shader
}

/** Draws two overlapping triangles and hashes the pixels read back. */
function renderWebGL(gl: WebGLRenderingContext, canvas: HTMLCanvasElement): ImageProbe {
  const program = gl.createProgram()
  if (!program) throw new Error('no program')
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? '')
  gl.useProgram(program)

  // x, y, r, g, b per vertex.
  // prettier-ignore
  const vertices = new Float32Array([
    -0.9, -0.8, 1, 0, 0,   0.1, 0.9, 0, 1, 0,   0.6, -0.7, 0, 0, 1,
    -0.3, 0.7, 0.2, 0.9, 0.4,   0.9, 0.6, 0.8, 0.1, 0.7,   0.2, -0.9, 0.5, 0.5, 0.0
  ])
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  const stride = 5 * 4
  const position = gl.getAttribLocation(program, 'position')
  const color = gl.getAttribLocation(program, 'color')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, stride, 0)
  gl.enableVertexAttribArray(color)
  gl.vertexAttribPointer(color, 3, gl.FLOAT, false, stride, 2 * 4)

  gl.viewport(0, 0, canvas.width, canvas.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  const pixels = new Uint8Array(canvas.width * canvas.height * 4)
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  return { hash: fnv1a(pixels), image: canvas.toDataURL() }
}

export function probeWebGL(): { info: WebGLInfo; image: ImageProbe | null } | null {
  const canvas = document.createElement('canvas')
  canvas.width = 120
  canvas.height = 60
  const options = { preserveDrawingBuffer: true }
  const gl = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as WebGLRenderingContext | null
  if (!gl) return null

  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  const info: WebGLInfo = {
    version: String(gl.getParameter(gl.VERSION)),
    vendor: String(gl.getParameter(gl.VENDOR)),
    renderer: String(gl.getParameter(gl.RENDERER)),
    unmaskedVendor: debug ? String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL)) : null,
    unmaskedRenderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null,
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    extensions: gl.getSupportedExtensions() ?? []
  }

  let image: ImageProbe | null = null
  try {
    image = renderWebGL(gl, canvas)
  } catch {
    // The parameters above are still worth showing without the picture.
  }
  // Each refresh makes a new context, and browsers drop the oldest past about 16.
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return { info, image }
}

export async function probeWebGPU(nav: ProbeNavigator): Promise<WebGPUInfo | null> {
  const adapter = await nav.gpu?.requestAdapter()
  if (!adapter) return null
  // `info` replaced requestAdapterInfo() in 2024; older Chrome only has the method.
  const info = adapter.info ?? (await adapter.requestAdapterInfo?.())
  if (!info) return null
  return { vendor: info.vendor ?? '', architecture: info.architecture ?? '', description: info.description ?? '' }
}

/**
 * The widely used audio fingerprint: a triangle wave through a compressor,
 * rendered offline (nothing is played), summed over the tail of the buffer.
 */
export async function probeAudio(): Promise<AudioProbe | null> {
  if (typeof OfflineAudioContext === 'undefined') return null
  const ctx = new OfflineAudioContext(1, 5000, 44100)

  const oscillator = ctx.createOscillator()
  oscillator.type = 'triangle'
  oscillator.frequency.value = 10000

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -50
  compressor.knee.value = 40
  compressor.ratio.value = 12
  compressor.attack.value = 0
  compressor.release.value = 0.25

  oscillator.connect(compressor)
  compressor.connect(ctx.destination)
  oscillator.start(0)

  const buffer = await ctx.startRendering()
  const samples = buffer.getChannelData(0)
  let sum = 0
  for (let i = 4500; i < samples.length; i++) sum += Math.abs(samples[i])
  return { sum, hash: fnv1a(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength)) }
}

export async function probeDevices(nav: ProbeNavigator): Promise<DeviceCounts | null> {
  if (!nav.mediaDevices) return null
  const devices = await nav.mediaDevices.enumerateDevices()
  const of = (kind: string) => devices.filter((d) => d.kind === kind).length
  return {
    videoinput: of('videoinput'),
    audioinput: of('audioinput'),
    audiooutput: of('audiooutput'),
    labelled: devices.filter((d) => d.label !== '').length
  }
}

export async function probeBattery(nav: ProbeNavigator): Promise<BatteryInfo | null> {
  if (!nav.getBattery) return null
  const b = await nav.getBattery()
  return { level: b.level, charging: b.charging, chargingTime: b.chargingTime, dischargingTime: b.dischargingTime }
}

/** All probes at once; each one that fails is null. */
export async function runProbes(nav: object): Promise<HardwareProbes> {
  const n = nav as ProbeNavigator
  const [webgl, webgpu, canvas, audio, devices, battery] = await Promise.all([
    attempt(probeWebGL),
    attempt(() => probeWebGPU(n)),
    attempt(probeCanvas),
    attempt(probeAudio),
    attempt(() => probeDevices(n)),
    attempt(() => probeBattery(n))
  ])
  return {
    webgl: webgl?.info ?? null,
    webglImage: webgl?.image ?? null,
    webgpu,
    canvas,
    audio,
    devices,
    battery
  }
}
