import { describe, it, expect, afterEach, vi } from 'vitest'
import { BoxGeometry, CanvasTexture, Mesh, MeshStandardMaterial, Scene } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { ModelScene, ModelLoadError, WebGLUnavailableError } from './model-scene'

/**
 * What the unit suite cannot reach: real loaders reading real files, and real
 * pixels out of WebGL. The models are made here rather than kept as fixtures:
 * STL and OBJ are written as text, glTF by three.js's own exporter.
 */

// Headless runs may have no GPU and no software fallback either.
const hasWebGL = Boolean(document.createElement('canvas').getContext('webgl2'))

const DARK = [0x1e, 0x1f, 0x24]

let scene: ModelScene | null = null

afterEach(() => {
  vi.restoreAllMocks()
  scene?.dispose()
  scene = null
  document.body.innerHTML = ''
})

function stage(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:300px;height:200px'
  document.body.append(canvas)
  return canvas
}

function text(name: string, lines: string[]): File {
  return new File([lines.join('\n')], name)
}

/** A box from the origin to (x, y, z), every facet normal left as 0 0 0 as many exporters write it. */
function boxStl(x: number, y: number, z: number): File {
  const corner = (i: number) => [i & 1 ? x : 0, i & 2 ? y : 0, i & 4 ? z : 0].join(' ')
  const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
  const facet = (corners: number[]) => [
    'facet normal 0 0 0',
    'outer loop',
    ...corners.map((i) => `vertex ${corner(i)}`),
    'endloop',
    'endfacet'
  ]
  const lines = faces.flatMap(([a, b, c, d]) => [...facet([a, b, c]), ...facet([a, c, d])])
  return text('box.stl', ['solid box', ...lines, 'endsolid box'])
}

function redBox(): Scene {
  const model = new Scene()
  model.add(new Mesh(new BoxGeometry(2, 1, 1), new MeshStandardMaterial({ color: '#ff0000' })))
  return model
}

/** A .gltf whose buffer is a separate .bin, as most exporters write it. */
async function gltfWithBin(): Promise<{ gltf: File; bin: File }> {
  const json = (await new GLTFExporter().parseAsync(redBox(), { binary: false })) as {
    buffers: { uri: string }[]
  }
  const bytes = await (await fetch(json.buffers[0].uri)).arrayBuffer()
  json.buffers[0].uri = 'red%20box.bin'
  return { gltf: new File([JSON.stringify(json)], 'red box.gltf'), bin: new File([bytes], 'red box.bin') }
}

/** A small PNG of one colour, for a model to use as a texture. */
async function png(name: string, color: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 8
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 8, 8)
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png'))
  return new File([blob], name, { type: 'image/png' })
}

const QUAD_OBJ = ['v -1 -1 0', 'v 1 -1 0', 'v 1 1 0', 'v -1 1 0', 'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1']
const QUAD_FACES = ['f 1/1 2/2 3/3', 'f 1/1 3/3 4/4']

/** The RGBA of a pixel of a saved view, from the top left as a fraction of its size. */
async function pixelOf(blob: Blob, fx: number, fy: number): Promise<number[]> {
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0)
  return [...ctx.getImageData(Math.floor(bitmap.width * fx), Math.floor(bitmap.height * fy), 1, 1).data]
}

describe('ModelScene without WebGL', () => {
  it('says WebGL is not available instead of failing somewhere later', () => {
    // A canvas already taken by a 2D context has no WebGL to give, in every engine.
    const canvas = stage()
    canvas.getContext('2d')

    expect(() => new ModelScene(canvas)).toThrow(WebGLUnavailableError)
  })
})

// Chromium on a CI runner draws in software, where compiling the shaders for a
// first frame has taken over 5 s on its own.
describe.skipIf(!hasWebGL)('ModelScene', { timeout: 30_000 }, () => {
  it('measures an STL along its own axes', async () => {
    scene = new ModelScene(stage())

    const shown = await scene.load(boxStl(40, 20, 10), 'stl')

    expect(shown?.stats).toEqual({ meshes: 1, triangles: 12, vertices: 36, materials: 1 })
    expect(shown?.size).toEqual({ x: 40, y: 20, z: 10 })
  })

  it('lights an STL whose facet normals are all zero', async () => {
    scene = new ModelScene(stage())
    await scene.load(boxStl(40, 20, 10), 'stl')

    // Unlit, the box would be black in the middle of the view.
    const [r, g, b] = await pixelOf(await scene.snapshot(), 0.5, 0.5)
    expect(r + g + b).toBeGreaterThan(150)
  })

  it('reads a GLB', async () => {
    scene = new ModelScene(stage())
    const glb = (await new GLTFExporter().parseAsync(redBox(), { binary: true })) as ArrayBuffer

    const shown = await scene.load(new File([glb], 'red.glb'), 'glb')

    expect(shown?.stats.triangles).toBe(12)
    expect(shown?.size.x).toBeCloseTo(2)
  })

  it('reads a .gltf with the .bin chosen alongside it, matched by name', async () => {
    scene = new ModelScene(stage())
    const { gltf, bin } = await gltfWithBin()

    const shown = await scene.load(gltf, 'gltf', [bin])

    expect(shown?.stats.triangles).toBe(12)
    expect(shown?.missing).toEqual([])
  })

  it('names the .bin a .gltf needed but was not given', async () => {
    scene = new ModelScene(stage())
    const { gltf } = await gltfWithBin()

    const loading = scene.load(gltf, 'gltf')

    await expect(loading).rejects.toThrow(ModelLoadError)
    await expect(loading).rejects.toThrow('red box.bin が見つかりません')
  })

  it('gives an OBJ the materials of the .mtl chosen with it', async () => {
    scene = new ModelScene(stage())
    const obj = text('quad.obj', [
      'mtllib quad.mtl',
      'v -1 -1 0', 'v 1 -1 0', 'v 1 1 0', 'v -1 1 0',
      'usemtl red',
      'f 1 2 3', 'f 1 3 4'
    ])
    const mtl = text('quad.mtl', ['newmtl red', 'Kd 1 0 0'])

    const shown = await scene.load(obj, 'obj', [mtl])
    scene.setZUp(false)

    expect(shown?.stats).toMatchObject({ triangles: 2, materials: 1 })
    const [r, g, b] = await pixelOf(await scene.snapshot(), 0.5, 0.5)
    expect(r).toBeGreaterThan(g + 60)
    expect(r).toBeGreaterThan(b + 60)
  })

  it('names the .mtl an .obj asked for but was not given, and shows it plain', async () => {
    scene = new ModelScene(stage())
    const obj = text('quad.obj', ['mtllib quad.mtl', ...QUAD_OBJ, 'usemtl red', ...QUAD_FACES])

    const shown = await scene.load(obj, 'obj')
    scene.setZUp(false)

    expect(shown?.missing).toEqual(['quad.mtl'])
    // The same blue-grey as an STL, not the loader's own white.
    const [r, , b] = await pixelOf(await scene.snapshot(), 0.5, 0.5)
    expect(b).toBeGreaterThan(r + 5)
  })

  it('draws again once the textures an .mtl names have arrived', async () => {
    scene = new ModelScene(stage())
    const obj = text('quad.obj', ['mtllib quad.mtl', ...QUAD_OBJ, 'usemtl painted', ...QUAD_FACES])
    const mtl = text('quad.mtl', ['newmtl painted', 'Kd 1 1 1', 'map_Kd green.png'])
    // WebGLRenderer's methods are its own, not its prototype's, so a frame is
    // seen by the draw calls that make it.
    const draws = [
      vi.spyOn(WebGL2RenderingContext.prototype, 'drawArrays'),
      vi.spyOn(WebGL2RenderingContext.prototype, 'drawElements')
    ]

    // MTLLoader starts the texture and hands the material over before it has arrived.
    await scene.load(obj, 'obj', [mtl, await png('green.png', '#00ff00')])
    for (const draw of draws) draw.mockClear()

    await vi.waitFor(() => expect(draws.some((draw) => draw.mock.calls.length > 0)).toBe(true))
  })

  it('says when two folders have a file of the same name, which a drop cannot tell apart', async () => {
    scene = new ModelScene(stage())
    const model = new Scene()
    for (const [x, color] of [[-1, '#ff0000'], [1, '#0000ff']] as const) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 4
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 4, 4)
      const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new CanvasTexture(canvas) }))
      mesh.position.x = x
      model.add(mesh)
    }
    const json = (await new GLTFExporter().parseAsync(model, { binary: false })) as { images: { uri: string }[] }
    json.images[0].uri = 'body/diffuse.png'
    json.images[1].uri = 'head/diffuse.png'
    const gltf = new File([JSON.stringify(json)], 'robot.gltf')

    const shown = await scene.load(gltf, 'gltf', [await png('diffuse.png', '#ff0000')])

    expect(shown?.missing).toEqual([])
    expect(shown?.ambiguous).toEqual(['diffuse.png'])
  })

  it('measures a model along its own axes, however the one before was turned', async () => {
    scene = new ModelScene(stage())
    await scene.load(boxStl(1, 1, 1), 'stl')
    scene.setZUp(true)
    // Three different sides, so that any two swapped would show.
    const glb = (await new GLTFExporter().parseAsync(new Mesh(new BoxGeometry(2, 3, 1)), { binary: true })) as ArrayBuffer

    const shown = await scene.load(new File([glb], 'tall.glb'), 'glb')

    expect(shown?.size.x).toBeCloseTo(2)
    expect(shown?.size.y).toBeCloseTo(3)
    expect(shown?.size.z).toBeCloseTo(1)
  })

  it('throws away a load that a newer one overtook', async () => {
    scene = new ModelScene(stage())

    const first = scene.load(boxStl(1, 1, 1), 'stl')
    const second = scene.load(boxStl(5, 5, 5), 'stl')

    expect(await first).toBeNull()
    expect((await second)?.size.x).toBe(5)
  })

  it('saves the background it shows, or none at all', async () => {
    scene = new ModelScene(stage())
    await scene.load(boxStl(40, 20, 10), 'stl')

    const dark = await pixelOf(await scene.snapshot(), 0.02, 0.02)
    expect(dark.slice(0, 3)).toEqual(DARK)
    expect(dark[3]).toBe(255)

    scene.setBackground('transparent')
    const clear = await pixelOf(await scene.snapshot(), 0.02, 0.02)
    expect(clear[3]).toBe(0)
  })

  it('saves at the size the canvas is drawn at', async () => {
    scene = new ModelScene(stage())
    await scene.load(boxStl(1, 1, 1), 'stl')

    const bitmap = await createImageBitmap(await scene.snapshot())
    const ratio = Math.min(window.devicePixelRatio || 1, 2)

    expect([bitmap.width, bitmap.height]).toEqual([300 * ratio, 200 * ratio])
  })
})
