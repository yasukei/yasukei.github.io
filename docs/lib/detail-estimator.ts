import { DrawingUtils, FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { DetailEstimator, DetailKind, DetailResult } from './detail-tracking'
import { WASM_URL } from './mediapipe'

const MODELS = {
  face: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  hands: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
}
export async function createDetailEstimator(kind: DetailKind): Promise<DetailEstimator> {
  const files = await FilesetResolver.forVisionTasks(WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') => {
    const baseOptions = { modelAssetPath: MODELS[kind], delegate }
    return kind === 'face'
      ? FaceLandmarker.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true })
      : HandLandmarker.createFromOptions(files, { baseOptions, runningMode: 'VIDEO', numHands: 2 })
  }
  let delegate: 'GPU' | 'CPU' = 'GPU'
  let task: FaceLandmarker | HandLandmarker
  try { task = await create(delegate) }
  catch { delegate = 'CPU'; task = await create(delegate) }
  return {
    delegate,
    draw(input, output, timestamp) {
      const context = output.getContext('2d')!
      const drawing = new DrawingUtils(context)
      const result: DetailResult = { face: null, hands: [], count: 0 }
      context.save()
      try {
        if (kind === 'face') {
          const face = (task as FaceLandmarker).detectForVideo(input, timestamp)
          const points = face.faceLandmarks[0]
          if (points) {
            result.count = 1
            result.face = {
              // z is expressed in units of image width; put y in those units too.
              points: points.map(p => ({ x: p.x, y: p.y * input.height / input.width, z: p.z, visibility: 1 })),
              blendshapes: Object.fromEntries((face.faceBlendshapes[0]?.categories ?? []).map(c => [c.categoryName, c.score])), timestamp
            }
            drawing.drawConnectors(points, FaceLandmarker.FACE_LANDMARKS_CONTOURS, { color: '#4ade80', lineWidth: Math.max(1, output.width / 600) })
            drawing.drawConnectors(points, [...FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, ...FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS], { color: '#facc15', lineWidth: 1 })
          }
        } else {
          const hands = (task as HandLandmarker).detectForVideo(input, timestamp)
          result.count = hands.landmarks.length
          for (let i = 0; i < hands.landmarks.length; i++) {
            const points = hands.landmarks[i]
            const label = hands.handedness[i]?.[0]
            if (hands.worldLandmarks[i] && label) result.hands.push({
              side: label.categoryName === 'Left' ? 'left' : 'right', score: label.score,
              wrist: { x: points[0].x, y: points[0].y },
              points: hands.worldLandmarks[i].map(p => ({ x: p.x, y: p.y, z: p.z, visibility: 1 }))
            })
            const color = label?.categoryName === 'Left' ? '#f472b6' : '#c084fc'
            drawing.drawConnectors(points, HandLandmarker.HAND_CONNECTIONS, { color, lineWidth: Math.max(1, output.width / 400) })
            drawing.drawLandmarks(points, { color: '#ffffff', fillColor: color, radius: Math.max(1, output.width / 350), lineWidth: 1 })
          }
        }
      } finally { context.restore(); drawing.close() }
      return result
    },
    close() { task.close() }
  }
}
