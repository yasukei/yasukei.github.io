import { Matrix4, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'
import type { FaceFrame, HandFrame } from './detail-tracking'
import { faceExpressionWeights } from './face-expressions'
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm'

export interface PosePoint { x: number; y: number; z: number; visibility?: number }
export interface PoseFrame { points: PosePoint[]; imagePoints?: PosePoint[]; timestamp: number }

// MediaPipe: x right, y down, z away from camera. three.js: y up, z toward camera.
export function poseVector(point: PosePoint): Vector3 {
  return new Vector3(point.x, -point.y, -point.z)
}
function point(points: PosePoint[], index: number): Vector3 | null {
  const p = points[index]
  return p && (p.visibility ?? 0) >= 0.5 && [p.x, p.y, p.z].every(Number.isFinite) ? poseVector(p) : null
}
export function bodyFrame(left: Vector3, right: Vector3, up: Vector3): Quaternion | null {
  const x = left.clone().sub(right)
  const z = x.clone().cross(up)
  if (x.lengthSq() < 1e-8 || z.lengthSq() < 1e-8) return null
  x.normalize(); z.normalize()
  const y = z.clone().cross(x).normalize()
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z))
}

const LIMBS: [VRMHumanBoneName, VRMHumanBoneName, number, number][] = [
  ['leftUpperArm', 'leftLowerArm', 11, 13], ['leftLowerArm', 'leftHand', 13, 15],
  ['rightUpperArm', 'rightLowerArm', 12, 14], ['rightLowerArm', 'rightHand', 14, 16],
  ['leftUpperLeg', 'leftLowerLeg', 23, 25], ['leftLowerLeg', 'leftFoot', 25, 27],
  ['rightUpperLeg', 'rightLowerLeg', 24, 26], ['rightLowerLeg', 'rightFoot', 26, 28],
  ['leftFoot', 'leftToes', 27, 31], ['rightFoot', 'rightToes', 28, 32]
]
const HAND_CHAINS = (['left', 'right'] as const).flatMap(side => [
  { finger: 'Thumb', names: ['Metacarpal', 'Proximal', 'Distal'], points: [1, 2, 3, 4] },
  { finger: 'Index', names: ['Proximal', 'Intermediate', 'Distal'], points: [5, 6, 7, 8] },
  { finger: 'Middle', names: ['Proximal', 'Intermediate', 'Distal'], points: [9, 10, 11, 12] },
  { finger: 'Ring', names: ['Proximal', 'Intermediate', 'Distal'], points: [13, 14, 15, 16] },
  { finger: 'Little', names: ['Proximal', 'Intermediate', 'Distal'], points: [17, 18, 19, 20] }
].flatMap(chain => chain.names.map((joint, index) => ({
  side, name: `${side}${chain.finger}${joint}` as VRMHumanBoneName,
  child: chain.names[index + 1] ? `${side}${chain.finger}${chain.names[index + 1]}` as VRMHumanBoneName : undefined,
  previous: index ? `${side}${chain.finger}${chain.names[index - 1]}` as VRMHumanBoneName : undefined,
  from: chain.points[index], to: chain.points[index + 1]
}))))
interface Rest { node: Object3D; rotation: Quaternion; world: Quaternion; direction?: Vector3 }

/** Direction-based retargeting with smoothed local rotations; no inferred root translation. */
export class VrmPoseRig {
  private readonly rest = new Map<VRMHumanBoneName, Rest>()
  private readonly reference: Quaternion | null
  private readonly palms = new Map<'left' | 'right', Quaternion>()
  constructor(private readonly vrm: VRM) {
    vrm.humanoid.resetNormalizedPose()
    vrm.scene.updateMatrixWorld(true)
    const names = new Set<VRMHumanBoneName>(['hips', 'spine', 'chest', 'upperChest', 'head', ...HAND_CHAINS.map(joint => joint.name), ...LIMBS.flatMap(([a, b]) => [a, b])])
    for (const name of names) {
      const node = vrm.humanoid.getNormalizedBoneNode(name)
      if (node) this.rest.set(name, { node, rotation: node.quaternion.clone(), world: node.getWorldQuaternion(new Quaternion()) })
    }
    for (const [name, child] of LIMBS) {
      const rest = this.rest.get(name)
      const end = this.rest.get(child)?.node
      if (!rest || !end) continue
      rest.direction = end.getWorldPosition(new Vector3()).sub(rest.node.getWorldPosition(new Vector3()))
        .applyQuaternion(rest.node.parent!.getWorldQuaternion(new Quaternion()).invert()).normalize()
    }
    for (const joint of HAND_CHAINS) {
      const rest = this.rest.get(joint.name)
      if (!rest) continue
      const end = joint.child ? this.rest.get(joint.child)?.node : undefined
      const previous = joint.previous ? this.rest.get(joint.previous)?.node : undefined
      const direction = end ? end.getWorldPosition(new Vector3()).sub(rest.node.getWorldPosition(new Vector3()))
        : previous ? rest.node.getWorldPosition(new Vector3()).sub(previous.getWorldPosition(new Vector3())) : null
      if (direction && direction.lengthSq() > 1e-8) rest.direction = direction.applyQuaternion(rest.node.parent!.getWorldQuaternion(new Quaternion()).invert()).normalize()
    }
    for (const side of ['left', 'right'] as const) {
      const position = (suffix: string) => this.rest.get(`${side}${suffix}` as VRMHumanBoneName)?.node.getWorldPosition(new Vector3())
      const wrist = position('Hand'), index = position('IndexProximal'), middle = position('MiddleProximal'), little = position('LittleProximal')
      if (wrist && index && middle && little) {
        const frame = bodyFrame(index, little, middle.sub(wrist))
        if (frame) this.palms.set(side, frame)
      }
    }
    const left = vrm.humanoid.getNormalizedBoneNode('leftUpperArm')?.getWorldPosition(new Vector3())
    const right = vrm.humanoid.getNormalizedBoneNode('rightUpperArm')?.getWorldPosition(new Vector3())
    const hips = this.rest.get('hips')?.node.getWorldPosition(new Vector3())
    this.reference = left && right && hips ? bodyFrame(left, right, left.clone().add(right).multiplyScalar(0.5).sub(hips)) : null
  }
  reset() { this.vrm.humanoid.resetNormalizedPose(); this.resetExpressions() }
  resetExpressions() {
    for (const name of Object.keys(faceExpressionWeights({}))) this.vrm.expressionManager?.setValue(name, 0)
  }
  applyFace(face: FaceFrame, dt: number) {
    const alpha = 1 - Math.exp(-Math.max(0, dt) / .09)
    const left = point(face.points, 454), right = point(face.points, 234), nose = point(face.points, 1)
    if (left && right && nose) {
      const up = nose.sub(left.clone().add(right).multiplyScalar(.5)).cross(left.clone().sub(right))
      const frame = bodyFrame(left, right, up)
      if (frame) this.orient('head', frame, alpha)
    }
    const manager = this.vrm.expressionManager
    if (manager) for (const [name, target] of Object.entries(faceExpressionWeights(face.blendshapes))) {
      const current = manager.getValue(name) ?? 0
      manager.setValue(name, current + (target - current) * alpha)
    }
  }
  applyHands(hands: HandFrame[], dt: number) {
    const alpha = 1 - Math.exp(-Math.max(0, dt) / .09)
    for (const hand of hands) {
      if (hand.score < .5) continue
      const wrist = point(hand.points, 0), index = point(hand.points, 5), middle = point(hand.points, 9), little = point(hand.points, 17)
      const reference = this.palms.get(hand.side)
      if (wrist && index && middle && little && reference) {
        const frame = bodyFrame(index, little, middle.sub(wrist))
        if (frame) this.orient(`${hand.side}Hand`, frame, alpha, reference)
      }
      for (const joint of HAND_CHAINS) {
        if (joint.side !== hand.side) continue
        const a = point(hand.points, joint.from), b = point(hand.points, joint.to)
        const rest = this.rest.get(joint.name)
        if (!rest?.direction || !a || !b) continue
        const direction = b.sub(a)
        if (direction.lengthSq() < 1e-8) continue
        rest.node.parent!.updateWorldMatrix(true, false)
        direction.applyQuaternion(rest.node.parent!.getWorldQuaternion(new Quaternion()).invert()).normalize()
        const target = new Quaternion().setFromUnitVectors(rest.direction, direction).multiply(rest.rotation)
        rest.node.quaternion.slerp(target, alpha)
        rest.node.updateWorldMatrix(false, true)
      }
    }
  }
  apply(points: PosePoint[], dt: number, trackHead = true) {
    // Time-based quaternion smoothing gives comparable response across frame rates.
    const alpha = 1 - Math.exp(-Math.max(0, dt) / 0.09)
    const ls = point(points, 11), rs = point(points, 12), lh = point(points, 23), rh = point(points, 24)
    if (ls && rs && lh && rh && this.reference) {
      const up = ls.clone().add(rs).sub(lh).sub(rh)
      const pelvis = bodyFrame(lh, rh, up)
      const shoulders = bodyFrame(ls, rs, up)
      if (pelvis) this.orient('hips', pelvis, alpha)
      // Drive the highest available chest bone; leave intermediate spine bones at rest.
      const chest = this.rest.has('upperChest') ? 'upperChest' : this.rest.has('chest') ? 'chest' : 'spine'
      if (shoulders) this.orient(chest, shoulders, alpha)
    }
    // Pose's ears and nose provide a coarse head direction, without facial tracking.
    const le = point(points, 7), re = point(points, 8), nose = point(points, 0)
    if (trackHead && le && re && nose) {
      const forward = nose.sub(le.clone().add(re).multiplyScalar(0.5))
      const up = forward.cross(le.clone().sub(re))
      const head = bodyFrame(le, re, up)
      if (head) this.orient('head', head, alpha)
    }
    for (const [name, , from, to] of LIMBS) {
      const rest = this.rest.get(name)
      const a = point(points, from), b = point(points, to)
      if (!rest?.direction || !a || !b) continue
      const direction = b.sub(a)
      if (direction.lengthSq() < 1e-8) continue
      rest.node.parent!.updateWorldMatrix(true, false)
      direction.applyQuaternion(rest.node.parent!.getWorldQuaternion(new Quaternion()).invert()).normalize()
      const target = new Quaternion().setFromUnitVectors(rest.direction, direction).multiply(rest.rotation)
      rest.node.quaternion.slerp(target, alpha)
      rest.node.updateWorldMatrix(false, true)
    }
  }
  private orient(name: VRMHumanBoneName, frame: Quaternion, alpha: number, reference = this.reference) {
    const rest = this.rest.get(name)
    if (!rest || !reference) return
    rest.node.parent!.updateWorldMatrix(true, false)
    const target = rest.node.parent!.getWorldQuaternion(new Quaternion()).invert()
      .multiply(frame).multiply(reference.clone().invert()).multiply(rest.world)
    rest.node.quaternion.slerp(target, alpha)
    rest.node.updateWorldMatrix(false, true)
  }
}
