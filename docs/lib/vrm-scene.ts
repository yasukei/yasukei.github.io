import { Box3, Color, DirectionalLight, HemisphereLight, LoadingManager, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import type { VRM } from '@pixiv/three-vrm'
import { VrmPoseRig } from './vrm-pose'
import type { FaceFrame, HandFrame } from './detail-tracking'
import type { PoseFrame } from './vrm-pose'

export class VrmScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(35, 1, 0.01, 100)
  private readonly controls: OrbitControls
  private readonly observer: ResizeObserver
  private vrm?: VRM
  private rig?: VrmPoseRig
  private pose: PoseFrame | null = null
  private face: FaceFrame | null = null
  private hands: HandFrame[] = []
  private generation = 0
  private disposed = false
  private animation = 0
  private previous = performance.now()

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.scene.background = new Color('#20242d')
    this.scene.add(new HemisphereLight(0xffffff, 0x667788, 2))
    const light = new DirectionalLight(0xffffff, 2.5)
    light.position.set(1, 2, 3)
    this.scene.add(light)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(canvas)
    this.resetView()
    this.resize()
    this.tick()
  }
  async load(file: File): Promise<boolean> {
    const generation = ++this.generation
    const manager = new LoadingManager()
    manager.setURLModifier(url => {
      if (url.startsWith('blob:') || url.startsWith('data:')) return url
      throw new Error('外部リソースを参照する VRM は読み込めません。テクスチャを埋め込んだ VRM を選んでください。')
    })
    const loader = new GLTFLoader(manager)
    loader.register(parser => new VRMLoaderPlugin(parser))
    const gltf = await loader.parseAsync(await file.arrayBuffer(), '')
    const vrm = gltf.userData.vrm as VRM | undefined
    if (!vrm) { VRMUtils.deepDispose(gltf.scene); throw new Error('VRM 0.x / 1.0 形式のモデルを選んでください。') }
    if (this.disposed || generation !== this.generation) { VRMUtils.deepDispose(vrm.scene); return false }
    try {
      VRMUtils.rotateVRM0(vrm)
      const rig = new VrmPoseRig(vrm)
      this.clear()
      this.vrm = vrm
      this.rig = rig
      this.scene.add(vrm.scene)
      vrm.update(0)
      this.resetView()
      return true
    } catch (error) { VRMUtils.deepDispose(vrm.scene); throw error }
  }
  setPose(pose: PoseFrame | null) { this.pose = pose }
  setFace(face: FaceFrame | null) {
    if (this.face && !face) this.rig?.resetExpressions()
    this.face = face
  }
  setHands(hands: HandFrame[]) { this.hands = hands }
  resetPose() { this.pose = null; this.face = null; this.hands = []; this.rig?.reset(); this.vrm?.update(0) }
  resetView() {
    const box = this.vrm ? new Box3().setFromObject(this.vrm.scene) : null
    const center = box && !box.isEmpty() ? box.getCenter(new Vector3()) : new Vector3(0, 0.9, 0)
    const size = box && !box.isEmpty() ? box.getSize(new Vector3()) : new Vector3(1, 1.8, 1)
    const distance = Math.max(size.y, size.x / Math.max(this.camera.aspect, 0.1)) / (2 * Math.tan(35 * Math.PI / 360)) * 1.3
    this.camera.position.copy(center).add(new Vector3(0, 0, distance))
    this.controls.target.copy(center)
    this.controls.update()
  }
  dispose() {
    this.disposed = true
    this.generation++
    cancelAnimationFrame(this.animation)
    this.observer.disconnect()
    this.controls.dispose()
    this.clear()
    this.renderer.dispose()
  }
  private clear() {
    if (this.vrm) { this.scene.remove(this.vrm.scene); VRMUtils.deepDispose(this.vrm.scene) }
    this.vrm = undefined
    this.rig = undefined
  }
  private resize() {
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight
    if (!width || !height || this.disposed) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
  private tick = () => {
    if (this.disposed) return
    const now = performance.now()
    const dt = Math.min((now - this.previous) / 1000, 0.1)
    this.previous = now
    // Keep converging to the last observation even for a paused video or slow first inference.
    // Explicit stop/no-detection signals clear the target through setPose(null).
    if (this.pose) this.rig?.apply(this.pose.points, dt, !this.face)
    if (this.face) this.rig?.applyFace(this.face, dt)
    if (this.hands.length) this.rig?.applyHands(this.hands, dt)
    this.vrm?.update(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.animation = requestAnimationFrame(this.tick)
  }
}
