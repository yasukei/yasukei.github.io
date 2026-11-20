const score = (shapes: Record<string, number>, name: string) => Number.isFinite(shapes[name]) ? Math.max(0, Math.min(1, shapes[name])) : 0
export function faceExpressionWeights(shapes: Record<string, number>): Record<string, number> {
  return {
    blinkLeft: score(shapes, 'eyeBlinkLeft'), blinkRight: score(shapes, 'eyeBlinkRight'),
    aa: score(shapes, 'jawOpen'), oh: score(shapes, 'mouthFunnel'), ou: score(shapes, 'mouthPucker'),
    happy: (score(shapes, 'mouthSmileLeft') + score(shapes, 'mouthSmileRight')) / 2
  }
}
