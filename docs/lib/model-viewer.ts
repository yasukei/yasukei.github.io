/**
 * The component's half of the 3D model viewer: which of the chosen files is
 * the model, and how what is known about it reads on the page.
 *
 * Nothing here may be imported by ./model-scene, nor anything there by the
 * component except types. VitePress runs a page's "lean" chunk on first load,
 * while a chunk imported on demand imports the full one, so a module both of
 * them use would be loaded and run twice, as two copies that do not know each
 * other. What the scene needs lives in ./model-info instead.
 */

export type ModelFormat = 'glb' | 'gltf' | 'stl' | 'obj'

const FORMATS: Readonly<Record<string, ModelFormat>> = {
  glb: 'glb',
  gltf: 'gltf',
  stl: 'stl',
  obj: 'obj'
}

export const FORMAT_LABELS: Readonly<Record<ModelFormat, string>> = {
  glb: 'glTF (GLB)',
  gltf: 'glTF',
  stl: 'STL',
  obj: 'OBJ'
}

/**
 * What the file picker offers. The model formats, plus what a .gltf or .obj
 * refers to by name, so they can be chosen together.
 */
export const ACCEPT = '.glb,.gltf,.stl,.obj,.bin,.mtl,image/*'

export function formatOf(name: string): ModelFormat | null {
  const extension = /\.([^./\\]+)$/.exec(name)?.[1].toLowerCase() ?? ''
  return FORMATS[extension] ?? null
}

export interface Picked<T> {
  model: T
  format: ModelFormat
  /** Everything else in the drop: the .bin, textures and .mtl the model may refer to. */
  resources: T[]
}

/**
 * Finds the model in a set of dropped files. A .gltf usually comes with its
 * .bin and textures, which only make sense together, so the rest are kept
 * rather than thrown away. With more than one model, the first one wins.
 */
export function pickModel<T extends { name: string }>(files: Iterable<T>): Picked<T> | null {
  const all = [...files]
  const model = all.find((file) => formatOf(file.name) !== null)
  if (!model) return null
  return {
    model,
    format: formatOf(model.name) as ModelFormat,
    resources: all.filter((file) => file !== model)
  }
}

/**
 * A length for display: three significant digits for small values, but never
 * rounding off whole units, so a 1234 mm part does not read as 1230.
 */
export function formatLength(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  const decimals = Math.min(6, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(value)))))
  return String(Number(value.toFixed(decimals)))
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function snapshotName(modelName: string | null): string {
  const base = modelName?.replace(/\.[^./\\]+$/, '') || 'model'
  return `${base}.png`
}
