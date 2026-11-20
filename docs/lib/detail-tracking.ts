import type { PosePoint } from './vrm-pose'
export type DetailKind = 'face' | 'hands'
export interface FaceFrame { points: PosePoint[]; blendshapes: Record<string, number>; timestamp: number }
export interface HandFrame { side: 'left' | 'right'; points: PosePoint[]; wrist: { x: number; y: number }; score: number }
export interface DetailResult { face: FaceFrame | null; hands: HandFrame[]; count: number }
export interface DetailEstimator {
  delegate: 'GPU' | 'CPU'
  draw(input: HTMLCanvasElement, output: HTMLCanvasElement, timestamp: number): DetailResult
  close(): void
}

/** Use pose wrists when available: handedness classifiers may assume a selfie image. */
export function associateHands(hands: HandFrame[], pose?: PosePoint[]): HandFrame[] {
  const left = pose?.[15], right = pose?.[16]
  if (!left || !right || (left.visibility ?? 0) < .5 || (right.visibility ?? 0) < .5) return hands
  const distance = (hand: HandFrame, wrist: PosePoint) => (hand.wrist.x - wrist.x) ** 2 + (hand.wrist.y - wrist.y) ** 2
  if (hands.length === 2) {
    const normal = distance(hands[0], left) + distance(hands[1], right)
    const swapped = distance(hands[1], left) + distance(hands[0], right)
    return hands.map((hand, index) => ({ ...hand, side: (normal <= swapped ? index === 0 : index === 1) ? 'left' : 'right' }))
  }
  return hands.map(hand => ({ ...hand, side: distance(hand, left) <= distance(hand, right) ? 'left' : 'right' }))
}
