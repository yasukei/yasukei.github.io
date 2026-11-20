import { describe, expect, it } from 'vitest'
import { associateHands } from './detail-tracking'
import type { HandFrame } from './detail-tracking'
import { faceExpressionWeights } from './face-expressions'

describe('detail tracking', () => {
  it('uses visible pose wrists for one-to-one assignment when classifier labels disagree', () => {
    const hands: HandFrame[] = [
      { side: 'right', score: .9, points: [], wrist: { x: .8, y: .4 } },
      { side: 'left', score: .9, points: [], wrist: { x: .2, y: .4 } }
    ]
    const pose = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }))
    pose[15] = { x: .8, y: .4, z: 0, visibility: 1 }
    pose[16] = { x: .2, y: .4, z: 0, visibility: 1 }
    expect(associateHands(hands, pose).map(h => h.side)).toEqual(['left', 'right'])
    expect(associateHands([hands[0]], pose)[0].side).toBe('left')
    pose[15].visibility = 0
    expect(associateHands(hands, pose)).toBe(hands)
  })
  it('preserves MediaPipe handedness when hand tracking runs without pose', () => {
    const hands: HandFrame[] = [
      { side: 'left', score: .95, points: [], wrist: { x: .2, y: .4 } },
      { side: 'right', score: .96, points: [], wrist: { x: .8, y: .4 } }
    ]
    expect(associateHands(hands).map(hand => hand.side)).toEqual(['left', 'right'])
  })
  it('maps supported facial shapes and bounds missing or invalid scores', () => {
    expect(faceExpressionWeights({ eyeBlinkLeft: .8, jawOpen: 2, mouthSmileLeft: .6, mouthSmileRight: .4, mouthFunnel: NaN, mouthPucker: -1 }))
      .toEqual({ blinkLeft: .8, blinkRight: 0, aa: 1, oh: 0, ou: 0, happy: .5 })
  })
})
