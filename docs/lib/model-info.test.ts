import { describe, it, expect } from 'vitest'
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  Mesh,
  MeshBasicMaterial
} from 'three'
import { fitDistance, loadErrorMessage, modelStats, resourceKey } from './model-info'

describe('resourceKey', () => {
  it('matches a reference by its file name, wherever it says the file is', () => {
    expect(resourceKey('blob:http://localhost/robot.bin')).toBe('robot.bin')
    expect(resourceKey('textures/albedo.png')).toBe('albedo.png')
    expect(resourceKey('albedo.png')).toBe('albedo.png')
  })

  it('decodes a percent-encoded name and ignores a query', () => {
    expect(resourceKey('textures/wood%20grain.png?v=2')).toBe('wood grain.png')
    expect(resourceKey('%E6%9C%A8%E7%9B%AE.png')).toBe('木目.png')
  })

  it('keeps a name that only looks encoded', () => {
    expect(resourceKey('100%.png')).toBe('100%.png')
  })
})

describe('modelStats', () => {
  it('counts an indexed mesh by its indices', () => {
    // Four corners per face, so the six faces share nothing: 24 vertices.
    const stats = modelStats(new Mesh(new BoxGeometry(), new MeshBasicMaterial()))

    expect(stats).toEqual({ meshes: 1, triangles: 12, vertices: 24, materials: 1 })
  })

  it('counts a mesh without indices by its vertices', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(new Array(9 * 5).fill(0), 3))

    expect(modelStats(new Mesh(geometry)).triangles).toBe(5)
  })

  it('counts only the part a draw range limits it to', () => {
    const geometry = new BoxGeometry()
    geometry.setDrawRange(0, 6)

    expect(modelStats(new Mesh(geometry)).triangles).toBe(2)
  })

  it('adds up the meshes under a group, and counts a shared material once', () => {
    const shared = new MeshBasicMaterial()
    const root = new Group()
    root.add(new Mesh(new BoxGeometry(), shared))
    const inner = new Group()
    inner.add(new Mesh(new BoxGeometry(), shared), new Mesh(new BoxGeometry(), [shared, new MeshBasicMaterial()]))
    root.add(inner)

    expect(modelStats(root)).toEqual({ meshes: 3, triangles: 36, vertices: 72, materials: 2 })
  })

  it('counts an instanced mesh once per instance', () => {
    const stats = modelStats(new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4))

    expect(stats).toMatchObject({ meshes: 4, triangles: 48, vertices: 96, materials: 1 })
  })

  it('leaves out lines, which have no triangles', () => {
    const root = new Group()
    root.add(new Line(new BoxGeometry()))

    expect(modelStats(root)).toEqual({ meshes: 0, triangles: 0, vertices: 0, materials: 0 })
  })
})

describe('fitDistance', () => {
  it('backs off until the sphere fits a square view, with nothing to spare', () => {
    // A 90° view: the edge of the view touches the sphere at radius / sin 45°.
    expect(fitDistance(1, 90, 1, 1)).toBeCloseTo(Math.SQRT2)
  })

  it('scales with the size of the model', () => {
    expect(fitDistance(250, 40, 1.5)).toBeCloseTo(fitDistance(1, 40, 1.5) * 250)
  })

  it('is decided by the vertical view on a wide canvas', () => {
    expect(fitDistance(1, 40, 2)).toBeCloseTo(fitDistance(1, 40, 1))
  })

  it('backs off further on a narrow canvas, where the sides are the limit', () => {
    expect(fitDistance(1, 40, 0.5)).toBeGreaterThan(fitDistance(1, 40, 1) * 1.5)
  })

  it('leaves some room around the model by default', () => {
    expect(fitDistance(1, 40, 1)).toBeCloseTo(fitDistance(1, 40, 1, 1) * 1.15)
  })
})

describe('loadErrorMessage', () => {
  it('names the files that were not chosen with the model', () => {
    expect(loadErrorMessage(new TypeError('Failed to fetch'), 'gltf', ['robot.bin', 'albedo.png'])).toBe(
      'robot.bin、albedo.png が見つかりません。モデルと一緒に選んでください。'
    )
  })

  it('explains the compressed glTF it cannot decode', () => {
    const draco = new Error('THREE.GLTFLoader: No DRACOLoader instance provided.')
    const ktx2 = new Error('THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures')

    expect(loadErrorMessage(draco, 'glb')).toContain('Draco')
    expect(loadErrorMessage(ktx2, 'glb')).toContain('KTX2')
  })

  it('reminds that a .gltf usually needs other files', () => {
    expect(loadErrorMessage(new SyntaxError('Unexpected token'), 'gltf')).toContain('.bin')
    expect(loadErrorMessage(new SyntaxError('Unexpected token'), 'stl')).toBe('このファイルは読み込めませんでした。')
  })
})
