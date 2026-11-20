import { BoxGeometry } from 'three'

/** Original, generated test mannequin; no third-party avatar or textures. */
export function vrmFixture(version: '0' | '1' = '1'): Buffer {
  const geometry = new BoxGeometry(1, 1, 1).toNonIndexed()
  const positions = geometry.getAttribute('position').array as Float32Array
  const normals = geometry.getAttribute('normal').array as Float32Array
  const binary = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(normals.buffer)])
  const nodes: { name?: string; translation?: number[]; children?: number[]; mesh?: number; scale?: number[] }[] = []
  const bones: Record<string, { node: number }> = {}
  function bone(name: string, parent: string | null, translation: number[], shape?: number[], offset = [0, 0, 0]) {
    const index = nodes.length
    nodes.push({ name, translation, children: [] })
    bones[name] = { node: index }
    if (parent) nodes[bones[parent].node].children!.push(index)
    if (shape) {
      nodes[index].children!.push(nodes.length)
      nodes.push({ mesh: 0, scale: shape, translation: offset })
    }
  }
  bone('hips', null, [0, 1, 0], [.25, .15, .15])
  bone('spine', 'hips', [0, .15, 0], [.28, .2, .15], [0, .1, 0])
  bone('chest', 'spine', [0, .2, 0], [.35, .15, .15], [0, .075, 0])
  bone('neck', 'chest', [0, .2, 0])
  bone('head', 'neck', [0, .1, 0], [.22, .25, .2], [0, .125, 0])
  for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
    bone(`${side}UpperArm`, 'chest', [.22 * sign, .12, 0], [.3, .09, .09], [.15 * sign, 0, 0])
    bone(`${side}LowerArm`, `${side}UpperArm`, [.3 * sign, 0, 0], [.25, .08, .08], [.125 * sign, 0, 0])
    bone(`${side}Hand`, `${side}LowerArm`, [.25 * sign, 0, 0], [.1, .07, .1], [.05 * sign, 0, 0])
    for (const [finger, z] of [['Thumb', .05], ['Index', .03], ['Middle', .01], ['Ring', -.01], ['Little', -.03]] as const) {
      const names = finger === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal']
      names.forEach((joint, index) => {
        bone(`${side}${finger}${joint}`, index ? `${side}${finger}${names[index - 1]}` : `${side}Hand`,
          [sign * (index ? .03 : .07), 0, index ? 0 : z], [.03, .015, .015], [sign * .015, 0, 0])
      })
    }
    bone(`${side}UpperLeg`, 'hips', [.1 * sign, -.05, 0], [.12, .4, .12], [0, -.2, 0])
    bone(`${side}LowerLeg`, `${side}UpperLeg`, [0, -.4, 0], [.1, .4, .1], [0, -.2, 0])
    bone(`${side}Foot`, `${side}LowerLeg`, [0, -.4, 0], [.12, .1, .22], [0, -.05, .05])
  }
  const extensions = version === '1'
    ? { VRMC_vrm: { specVersion: '1.0', meta: { name: 'Generated test mannequin', authors: ['Test suite'], licenseUrl: 'https://vrm.dev/licenses/1.0/' }, humanoid: { humanBones: bones } } }
    : { VRM: { exporterVersion: 'test', specVersion: '0.0', meta: { title: 'Generated test mannequin', author: 'Test suite', version: '1', allowedUserName: 'Everyone', violentUssageName: 'Disallow', sexualUssageName: 'Disallow', commercialUssageName: 'Allow', licenseName: 'CC0' }, humanoid: { humanBones: Object.entries(bones).map(([bone, value]) => ({ bone, node: value.node, useDefaultValues: true })) }, firstPerson: {}, blendShapeMaster: { blendShapeGroups: [] }, secondaryAnimation: { boneGroups: [], colliderGroups: [] }, materialProperties: [{ name: 'test', shader: 'VRM_USE_GLTFSHADER', renderQueue: 2000, floatProperties: {}, vectorProperties: {}, textureProperties: {}, keywordMap: {}, tagMap: {} }] } }
  const gltf = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes,
    extensionsUsed: [version === '1' ? 'VRMC_vrm' : 'VRM'], extensions,
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }, { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-.5, -.5, -.5], max: [.5, .5, .5] }, { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, material: 0 }] }],
    materials: [{ name: 'test', pbrMetallicRoughness: { baseColorFactor: [.2, .65, .9, 1], metallicFactor: 0, roughnessFactor: .8 } }]
  }
  const json = Buffer.from(JSON.stringify(gltf))
  const jsonPadded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20)
  json.copy(jsonPadded)
  const header = Buffer.alloc(20)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(28 + jsonPadded.length + binary.length, 8)
  header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  geometry.dispose()
  return Buffer.concat([header, jsonPadded, binHeader, binary])
}
