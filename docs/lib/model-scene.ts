/**
 * The WebGL half of the 3D model viewer: the renderer, the camera and its
 * mouse controls, and the loaders. Everything here needs a browser, and
 * three.js is large, so the component imports this module dynamically: the
 * page chunk stays small, and the static HTML build never runs any of it.
 */

import {
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LoadingManager,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Sphere,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three'
import type { BufferGeometry, Material, Object3D } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { toBlob } from './canvas-resize'
import { fitDistance, loadErrorMessage, modelStats, mtlLibraries, resourceKey, type ModelStats } from './model-info'
import type { ModelFormat } from './model-viewer'

export type Background = 'dark' | 'light' | 'transparent'

const BACKGROUNDS: Readonly<Record<Exclude<Background, 'transparent'>, string>> = {
  dark: '#1e1f24',
  light: '#f2f3f5'
}

/** For an STL, or an OBJ without its .mtl: neither has a material worth showing. Reads well on both backgrounds. */
const PLAIN_COLOR = '#99a3b3'

/** Where the camera looks from after a reset: in front, a little above and to the right. */
const VIEW_DIRECTION = new Vector3(0.6, 0.45, 1).normalize()

const FOV = 40

export class WebGLUnavailableError extends Error {
  constructor() {
    super('このブラウザでは 3D 表示 (WebGL) が使えません。')
    this.name = 'WebGLUnavailableError'
  }
}

/** A model that did not load, with a message meant for the person who chose it. */
export class ModelLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelLoadError'
  }
}

export interface Shown {
  stats: ModelStats
  /** Width, height and depth along the file's own axes, in the file's own units. */
  size: { x: number; y: number; z: number }
  /** Files the model refers to that were not chosen with it, such as a texture it can do without. */
  missing: string[]
  /**
   * File names the model refers to in more than one folder. A drop has no
   * folders, so every one of them got the same file.
   */
  ambiguous: string[]
}

function plainMaterial(vertexColors: boolean): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: PLAIN_COLOR, roughness: 0.55, metalness: 0.05, vertexColors })
}

/** Frees what a model holds on the GPU. Shared materials and textures are freed once each. */
function disposeObject(root: Object3D) {
  root.traverse((object) => (object as { geometry?: BufferGeometry }).geometry?.dispose())
  for (const material of materialsOf(root)) {
    for (const value of Object.values(material)) {
      if (value instanceof Texture) value.dispose()
    }
    material.dispose()
  }
}

function materialsOf(root: Object3D): Material[] {
  const found = new Set<Material>()
  root.traverse((object) => {
    const material = (object as { material?: Material | Material[] }).material
    if (material) for (const each of [material].flat()) found.add(each)
  })
  return [...found]
}

/**
 * Hands the loaders a blob URL for every file they ask for by name, and
 * remembers the names it had nothing for. The URLs live until the next model
 * replaces this one: MTL textures finish loading after the model itself does.
 */
class FileResolver {
  readonly manager = new LoadingManager()
  readonly missing = new Set<string>()
  readonly ambiguous = new Set<string>()
  private readonly urls = new Map<string, string>()
  private readonly own = new Set<string>()
  /** The reference each name was first asked for by, to notice another folder asking for the same name. */
  private readonly askedAs = new Map<string, string>()

  constructor(files: File[]) {
    for (const file of files) {
      const url = URL.createObjectURL(file)
      this.urls.set(file.name, url)
      this.own.add(url)
    }
    this.manager.setURLModifier((url) => {
      if (url.startsWith('data:') || this.own.has(url)) return url
      const key = resourceKey(url)
      const asked = this.askedAs.get(key)
      if (asked === undefined) this.askedAs.set(key, url)
      else if (asked !== url) this.ambiguous.add(key)
      const found = this.urls.get(key)
      if (found) return found
      this.missing.add(key)
      return url
    })
  }

  /** Calls `then` whenever everything asked for so far has arrived, such as an .mtl's textures. */
  onSettled(then: () => void) {
    this.manager.onLoad = then
  }

  urlOf(file: File): string {
    return this.urls.get(file.name) as string
  }

  release() {
    for (const url of this.own) URL.revokeObjectURL(url)
    this.own.clear()
    this.urls.clear()
  }
}

async function read(model: File, format: ModelFormat, resolver: FileResolver, resources: File[]): Promise<Object3D> {
  const url = resolver.urlOf(model)
  switch (format) {
    case 'glb':
    case 'gltf': {
      const loader = new GLTFLoader(resolver.manager).setMeshoptDecoder(MeshoptDecoder)
      return (await loader.loadAsync(url)).scene
    }
    case 'stl': {
      const geometry = await new STLLoader(resolver.manager).loadAsync(url)
      // Plenty of exporters write every facet normal as 0 0 0, which lights
      // nothing. The winding says the same as a correct normal would, so the
      // normals are always taken from it; each facet stays flat either way.
      geometry.computeVertexNormals()
      // Some exporters store per-face colours, which STLLoader exposes this way.
      return new Mesh(geometry, plainMaterial(Boolean((geometry as { hasColors?: boolean }).hasColors)))
    }
    case 'obj':
      return readObj(model, resolver, resources)
  }
}

/**
 * OBJLoader leaves the `mtllib` lines alone, so they are read here: the .mtl
 * they name is found among the chosen files, and one that is not there is
 * missing, as any other file a model refers to would be. A single .mtl chosen
 * under another name is still used. Only the first library is applied, which
 * is all OBJLoader takes.
 */
async function readObj(model: File, resolver: FileResolver, resources: File[]): Promise<Object3D> {
  const text = await model.text()
  const wanted = mtlLibraries(text)
  const chosen = resources.filter((file) => /\.mtl$/i.test(file.name))
  const named = wanted.flatMap((name) => chosen.filter((file) => file.name === name))
  const mtl = named[0] ?? chosen[0]
  if (!mtl || named.length > 0) {
    for (const name of wanted) if (!chosen.some((file) => file.name === name)) resolver.missing.add(name)
  }

  const loader = new OBJLoader(resolver.manager)
  if (mtl) {
    const materials = await new MTLLoader(resolver.manager).loadAsync(resolver.urlOf(mtl))
    materials.preload()
    loader.setMaterials(materials)
  }
  const object = loader.parse(text)
  if (mtl) return object

  // Without one, OBJLoader gives every part a white Phong material.
  const plain = new Map<boolean, MeshStandardMaterial>()
  object.traverse((child) => {
    const mesh = child as Mesh
    if (!mesh.isMesh) return
    for (const material of [mesh.material].flat()) material.dispose()
    const colored = mesh.geometry.getAttribute('color') !== undefined
    if (!plain.has(colored)) plain.set(colored, plainMaterial(colored))
    mesh.material = plain.get(colored) as MeshStandardMaterial
  })
  return object
}

export class ModelScene {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.01, 1000)
  private readonly controls: OrbitControls
  private readonly resizer: ResizeObserver
  /** Turns the model so its up axis points up; the model itself is never changed. */
  private readonly holder = new Group()
  private model: Object3D | null = null
  private resolver: FileResolver | null = null
  private wireframe = false
  /** Bumped by every load, so one that finishes after a newer one is thrown away. */
  private loads = 0
  private disposed = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    try {
      // Alpha, so the transparent background really is transparent in the saved PNG.
      this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      throw new WebGLUnavailableError()
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.toneMapping = NeutralToneMapping

    // Image-based light for PBR materials, which glTF uses; the lights are for
    // the Phong materials an OBJ gets, which ignore the environment.
    const pmrem = new PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.scene.environment = pmrem.fromScene(room, 0.04).texture
    room.dispose()
    pmrem.dispose()
    this.scene.add(new HemisphereLight('#ffffff', '#666666', 1.2))
    const key = new DirectionalLight('#ffffff', 1.5)
    key.position.set(0.5, 1, 0.8)
    // Attached to the camera so the side being looked at is always the lit one.
    this.camera.add(key)
    this.scene.add(this.camera, this.holder)

    this.controls = new OrbitControls(this.camera, canvas)
    // Without damping a frame is only needed when the view changes, so nothing
    // runs while the model sits still.
    this.controls.addEventListener('change', () => this.render())

    this.setBackground('dark')
    this.resizer = new ResizeObserver(() => this.resize())
    this.resizer.observe(canvas)
    this.resize()
  }

  /**
   * Replaces the model with the one in `file`. Resolves to null when a newer
   * load was started while this one was still reading.
   */
  async load(file: File, format: ModelFormat, resources: File[] = []): Promise<Shown | null> {
    const current = ++this.loads
    const resolver = new FileResolver([file, ...resources])
    let object: Object3D
    try {
      object = await read(file, format, resolver, resources)
    } catch (error) {
      resolver.release()
      throw new ModelLoadError(loadErrorMessage(error, format, [...resolver.missing]))
    }
    if (current !== this.loads || this.disposed) {
      disposeObject(object)
      resolver.release()
      return null
    }

    // Measured before it goes into the holder, which may still be turned for
    // the model before, and would swap Y and Z for one that is not Z-up.
    const box = new Box3().setFromObject(object)
    const size = box.isEmpty() ? new Vector3() : box.getSize(new Vector3())

    this.clear()
    this.model = object
    this.resolver = resolver
    this.holder.add(object)
    this.applyWireframe()
    // The view only redraws when it moves, so textures that arrive later need a frame of their own.
    resolver.onSettled(() => {
      if (this.resolver === resolver) this.render()
    })

    this.resetView()
    return {
      stats: modelStats(object),
      size: { x: size.x, y: size.y, z: size.z },
      missing: [...resolver.missing],
      ambiguous: [...resolver.ambiguous]
    }
  }

  setWireframe(on: boolean) {
    this.wireframe = on
    this.applyWireframe()
    this.render()
  }

  /** CAD and 3D printing tools mostly treat Z as up; glTF and most game formats use Y. */
  setZUp(on: boolean) {
    this.holder.rotation.x = on ? -Math.PI / 2 : 0
    this.resetView()
  }

  setBackground(background: Background) {
    if (background === 'transparent') this.renderer.setClearColor(0x000000, 0)
    else this.renderer.setClearColor(new Color(BACKGROUNDS[background]), 1)
    this.render()
  }

  /** Looks at the whole model from the default direction, close enough to fill the view. */
  resetView() {
    // The canvas may have just been shown, before the observer has said so.
    this.syncSize()
    this.holder.updateMatrixWorld(true)
    const box = new Box3().setFromObject(this.holder)
    const sphere = box.isEmpty() ? new Sphere(new Vector3(), 1) : box.getBoundingSphere(new Sphere())
    const radius = sphere.radius || 1
    const distance = fitDistance(radius, FOV, this.camera.aspect)

    this.camera.near = distance / 100
    this.camera.far = distance * 100
    this.camera.position.copy(sphere.center).addScaledVector(VIEW_DIRECTION, distance)
    this.camera.updateProjectionMatrix()
    this.controls.target.copy(sphere.center)
    this.controls.minDistance = radius / 50
    this.controls.maxDistance = distance * 20
    this.controls.update()
    this.render()
  }

  /** The view as it is now, as a PNG at the canvas's own resolution. */
  snapshot(): Promise<Blob> {
    // The drawing buffer is cleared after it is shown, so draw it again right
    // before reading it rather than keeping every frame around for this.
    this.render()
    return toBlob(this.canvas, 'image/png')
  }

  dispose() {
    this.disposed = true
    this.resizer.disconnect()
    this.controls.dispose()
    this.clear()
    this.scene.environment?.dispose()
    this.renderer.dispose()
  }

  private clear() {
    if (this.model) {
      this.holder.remove(this.model)
      disposeObject(this.model)
      this.model = null
    }
    this.resolver?.release()
    this.resolver = null
  }

  private applyWireframe() {
    if (!this.model) return
    for (const material of materialsOf(this.model)) {
      if ('wireframe' in material) (material as MeshStandardMaterial).wireframe = this.wireframe
    }
  }

  private resize() {
    this.syncSize()
    this.render()
  }

  private syncSize() {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    // Hidden until there is a model to show; a zero-sized drawing buffer is an error.
    if (!width || !height || this.disposed) return
    const buffer = this.renderer.getSize(new Vector2())
    if (buffer.x === width && buffer.y === height) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  private render() {
    if (this.disposed) return
    this.renderer.render(this.scene, this.camera)
  }
}
