/**
 * The plain half of ./model-scene: what a loaded model is made of, how far
 * back the camera has to stand to see all of it, which file a model's
 * reference points at, and what to say when loading fails.
 *
 * three.js is only imported for its types, so all of this can be tested in
 * Node. The component must not import it except for types; why is in
 * ./model-viewer.
 */

import type { BufferGeometry, InstancedMesh, Material, Mesh, Object3D } from 'three'
import type { ModelFormat } from './model-viewer'

/**
 * The file name a reference in a model resolves to. glTF and MTL refer to
 * their resources by relative path, possibly percent-encoded, but a drop
 * flattens folders, so only the last segment can be matched.
 */
export function resourceKey(url: string): string {
  const path = url.split(/[?#]/)[0]
  const last = path.slice(path.lastIndexOf('/') + 1)
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/**
 * The material libraries an OBJ names in its `mtllib` lines, by file name.
 * A line may list several, but a name may also contain spaces, so the line is
 * only split when every part of it is an .mtl.
 */
export function mtlLibraries(objText: string): string[] {
  const names: string[] = []
  for (const match of objText.matchAll(/^[ \t]*mtllib[ \t]+(.+?)[ \t\r]*$/gm)) {
    const parts = match[1].split(/[ \t]+/)
    const listed = parts.length > 1 && parts.every((part) => /\.mtl$/i.test(part)) ? parts : [match[1]]
    for (const name of listed.map(resourceKey)) if (!names.includes(name)) names.push(name)
  }
  return names
}

export interface ModelStats {
  meshes: number
  triangles: number
  vertices: number
  materials: number
}

function trianglesOf(geometry: BufferGeometry): number {
  const indices = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0
  return Math.floor(Math.min(indices, geometry.drawRange.count) / 3)
}

/**
 * What a model is made of, counted the way a renderer would draw it: an
 * instanced mesh counts once per instance. Lines and points are not meshes and
 * have no triangles, so they are left out.
 */
export function modelStats(root: Object3D): ModelStats {
  const stats: ModelStats = { meshes: 0, triangles: 0, vertices: 0, materials: 0 }
  const materials = new Set<Material>()

  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const copies = (object as InstancedMesh).isInstancedMesh ? (object as InstancedMesh).count : 1
    stats.meshes += copies
    stats.triangles += trianglesOf(mesh.geometry) * copies
    stats.vertices += (mesh.geometry.getAttribute('position')?.count ?? 0) * copies
    for (const material of [mesh.material].flat()) materials.add(material)
  })

  stats.materials = materials.size
  return stats
}

/**
 * How far from its centre a camera has to be to see the whole of a sphere,
 * with `margin` to spare. Whichever of the vertical and horizontal field of
 * view is narrower decides: a tall, narrow canvas has to back off further.
 */
export function fitDistance(radius: number, verticalFov: number, aspect: number, margin = 1.15): number {
  const halfVertical = (verticalFov * Math.PI) / 360
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect)
  return (radius * margin) / Math.sin(Math.min(halfVertical, halfHorizontal))
}

export function missingMessage(names: string[]): string {
  return `${names.join('、')} が見つかりません。モデルと一緒に選んでください。`
}

/**
 * Why a model did not load, in words the person who chose it can act on. The
 * loaders throw English messages meant for developers; the few that have a
 * clear cause get their own explanation.
 *
 * `missing` is what the model referred to by name but was not chosen with it,
 * which is nearly always why a .gltf or an .obj with its .mtl fails.
 */
export function loadErrorMessage(error: unknown, format: ModelFormat, missing: string[] = []): string {
  if (missing.length > 0) return missingMessage(missing)
  const text = error instanceof Error ? error.message : String(error)
  if (/draco/i.test(text)) return 'Draco 圧縮された glTF には対応していません。'
  if (/ktx2|basisu/i.test(text)) return 'KTX2 (Basis) 形式のテクスチャには対応していません。'
  if (format === 'gltf') {
    return 'このファイルは読み込めませんでした。.gltf は、参照している .bin やテクスチャも一緒に選んでください。'
  }
  return 'このファイルは読み込めませんでした。'
}
