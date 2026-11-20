import { describe, expect, it, vi } from 'vitest'
import { Object3D, Quaternion, Vector3 } from 'three'
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'
import { bodyFrame, poseVector, VrmPoseRig } from './vrm-pose'
import type { PosePoint } from './vrm-pose'

function mannequin(rotation = 0) {
  const scene = new Object3D()
  scene.rotation.y = rotation
  const nodes = new Map<string, Object3D>()
  function add(name: string, parent: string | null, x: number, y: number) {
    const node = new Object3D(); node.position.set(x, y, 0)
    nodes.set(name, node); (parent ? nodes.get(parent)! : scene).add(node)
  }
  add('hips', null, 0, 1)
  add('spine', 'hips', 0, .2)
  add('head', 'spine', 0, .5)
  for (const [side, sign] of [['left', 1], ['right', -1]] as const) {
    add(`${side}UpperArm`, 'spine', .2 * sign, .3)
    add(`${side}LowerArm`, `${side}UpperArm`, .3 * sign, 0)
    add(`${side}Hand`, `${side}LowerArm`, .3 * sign, 0)
    add(`${side}UpperLeg`, 'hips', .1 * sign, 0)
    add(`${side}LowerLeg`, `${side}UpperLeg`, 0, -.4)
    add(`${side}Foot`, `${side}LowerLeg`, 0, -.4)
  }
  const humanoid = { getNormalizedBoneNode: (name: VRMHumanBoneName) => nodes.get(name) ?? null,
    resetNormalizedPose: () => nodes.forEach(node => node.quaternion.identity()) }
  return { vrm: { scene, humanoid } as unknown as VRM, nodes }
}
function landmarks(): PosePoint[] {
  const points = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
  const set = (i: number, x: number, y: number, z = 0) => { points[i] = { x, y, z, visibility: 1 } }
  set(11, .2, -.5); set(12, -.2, -.5)
  set(23, .1, 0); set(24, -.1, 0)
  set(13, .5, -.5); set(15, .5, -.8, -.2)
  set(14, -.5, -.5); set(16, -.8, -.5)
  set(25, .1, .4); set(27, .1, .8)
  set(26, -.1, .4); set(28, -.1, .8)
  return points
}
function direction(nodes: Map<string, Object3D>, from: string, to: string) {
  return nodes.get(to)!.getWorldPosition(new Vector3()).sub(nodes.get(from)!.getWorldPosition(new Vector3())).normalize()
}

describe('VRM retargeting', () => {
  it.each([0, Math.PI])('aims both arm segments in world space with root rotation %s', rotation => {
    const { vrm, nodes } = mannequin(rotation)
    const rig = new VrmPoseRig(vrm)
    const points = landmarks()
    rig.apply(points, 2)
    const upper = poseVector(points[13]).sub(poseVector(points[11])).normalize()
    const lower = poseVector(points[15]).sub(poseVector(points[13])).normalize()
    expect(direction(nodes, 'leftUpperArm', 'leftLowerArm').dot(upper)).toBeGreaterThan(.999)
    expect(direction(nodes, 'leftLowerArm', 'leftHand').dot(lower)).toBeGreaterThan(.999)
    expect(direction(nodes, 'leftUpperLeg', 'leftLowerLeg').y).toBeLessThan(-.999)
  })
  it('holds low-confidence joints, ignores invalid observations, and resets', () => {
    const { vrm, nodes } = mannequin()
    const rig = new VrmPoseRig(vrm)
    const points = landmarks(); rig.apply(points, 2)
    const before = nodes.get('leftLowerArm')!.quaternion.clone()
    points[15] = { x: NaN, y: 0, z: 0, visibility: 1 }
    rig.apply(points, .1)
    expect(nodes.get('leftLowerArm')!.quaternion.angleTo(before)).toBeLessThan(1e-6)
    points[15] = { x: 0, y: 1, z: 0, visibility: .1 }
    rig.apply(points, .1)
    expect(nodes.get('leftLowerArm')!.quaternion.angleTo(before)).toBeLessThan(1e-6)
    rig.reset()
    expect(nodes.get('leftLowerArm')!.quaternion.angleTo(new Quaternion())).toBe(0)
  })
  it('turns the head from ear/nose observations without changing root translation', () => {
    const { vrm, nodes } = mannequin()
    const rig = new VrmPoseRig(vrm)
    const points = landmarks()
    points[7] = { x: 0, y: -.8, z: -.1, visibility: 1 }
    points[8] = { x: 0, y: -.8, z: .1, visibility: 1 }
    points[0] = { x: -.15, y: -.8, z: 0, visibility: 1 }
    const position = nodes.get('hips')!.position.clone()
    rig.apply(points, 2)
    const forward = new Vector3(0, 0, 1).applyQuaternion(nodes.get('head')!.getWorldQuaternion(new Quaternion()))
    expect(forward.x).toBeLessThan(-.999)
    expect(nodes.get('hips')!.position.equals(position)).toBe(true)
  })
  it('rejects degenerate torso frames', () => {
    expect(bodyFrame(new Vector3(), new Vector3(), new Vector3(0, 1, 0))).toBeNull()
    expect(bodyFrame(new Vector3(1, 0, 0), new Vector3(), new Vector3(2, 0, 0))).toBeNull()
  })
  it('drives supported VRM expressions and clears them when face tracking stops', () => {
    const { vrm } = mannequin()
    const values: Record<string, number> = {}
    const setValue = vi.fn((name: string, value: number) => { values[name] = value })
    Object.assign(vrm, { expressionManager: { setValue, getValue: (name: string) => values[name] ?? 0 } })
    const rig = new VrmPoseRig(vrm)
    rig.applyFace({ points: [], blendshapes: { eyeBlinkLeft: .8, jawOpen: .7 }, timestamp: 0 }, 2)
    expect(values.blinkLeft).toBeCloseTo(.8)
    expect(values.aa).toBeCloseTo(.7)
    rig.resetExpressions()
    expect(values.aa).toBe(0)
    expect(values.blinkLeft).toBe(0)
  })

  it('bends normalized finger bones toward hand landmarks without pose tracking', () => {
    const { vrm, nodes } = mannequin()
    function add(name: string, parent: string, x: number, y: number) {
      const node = new Object3D(); node.position.set(x, y, 0)
      nodes.get(parent)!.add(node); nodes.set(name, node)
    }
    add('leftIndexProximal', 'leftHand', .02, .02)
    add('leftIndexIntermediate', 'leftIndexProximal', .02, 0)
    add('leftIndexDistal', 'leftIndexIntermediate', .02, 0)
    add('leftMiddleProximal', 'leftHand', .02, 0)
    add('leftLittleProximal', 'leftHand', .02, -.02)
    const points: PosePoint[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
    for (const [i, x, y] of [[0, 0, 0], [5, .02, -.02], [6, .02, -.04], [7, .02, -.06], [8, .02, -.08], [9, .02, 0], [17, .02, .02]]) {
      points[i] = { x, y, z: 0, visibility: 1 }
    }
    const rig = new VrmPoseRig(vrm)
    rig.applyHands([{ side: 'left', points, wrist: { x: 0, y: 0 }, score: 1 }], 2)
    expect(direction(nodes, 'leftIndexProximal', 'leftIndexIntermediate').y).toBeGreaterThan(.999)
    expect(direction(nodes, 'leftIndexIntermediate', 'leftIndexDistal').y).toBeGreaterThan(.999)
    expect(nodes.get('rightHand')!.quaternion.angleTo(new Quaternion())).toBe(0)
  })

})
