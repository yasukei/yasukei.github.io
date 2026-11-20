import { DrawingUtils, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { WASM_URL } from './mediapipe'
import { poseModelUrl, type PoseModel } from './pose-models'
import type { PoseFrame } from './vrm-pose'

export interface PoseEstimator {
  delegate: 'GPU' | 'CPU'
  /** Input contains only the cropped video; output receives the skeleton overlay. */
  draw(input: HTMLCanvasElement, timestamp: number, onPose?: (pose: PoseFrame | null) => void): number
  close(): void
}

export async function createPoseEstimator(model: PoseModel = 'lite'): Promise<PoseEstimator> {
  const files = await FilesetResolver.forVisionTasks(WASM_URL)
  const create = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: poseModelUrl(model), delegate },
    runningMode: 'VIDEO', numPoses: 1,
    minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5, outputSegmentationMasks: false
  })
  let delegate: 'GPU' | 'CPU' = 'GPU'
  let landmarker: PoseLandmarker
  try { landmarker = await create(delegate) }
  catch { delegate = 'CPU'; landmarker = await create(delegate) }

  // Bound inference cost without changing the source-pixel crop or preview resolution.
  const input = document.createElement('canvas')
  const context = input.getContext('2d')!
  return {
    delegate,
    draw(output, timestamp, onPose) {
      const scale = Math.min(1, 640 / Math.max(output.width, output.height))
      const width = Math.max(1, Math.round(output.width * scale))
      const height = Math.max(1, Math.round(output.height * scale))
      if (input.width !== width) input.width = width
      if (input.height !== height) input.height = height
      context.drawImage(output, 0, 0, width, height)
      const target = output.getContext('2d')!
      const drawing = new DrawingUtils(target)
      let count = 0
      target.save()
      try {
        // Callback form lets MediaPipe release result resources immediately.
        landmarker.detectForVideo(input, timestamp, result => {
          count = result.landmarks.length
          const world = result.worldLandmarks[0]
          onPose?.(world ? { imagePoints: result.landmarks[0].map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })), points: world.map(p => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })), timestamp } : null)
          for (const landmarks of result.landmarks) {
            const visible = (index: number) => (landmarks[index]?.visibility ?? 0) >= 0.5
            drawing.drawConnectors(landmarks,
              PoseLandmarker.POSE_CONNECTIONS.filter(edge => visible(edge.start) && visible(edge.end)),
              { color: '#38bdf8', lineWidth: Math.max(2, output.width / 250) })
            drawing.drawLandmarks(landmarks.filter((_, index) => visible(index)),
              { color: '#ffffff', fillColor: '#f97316', radius: Math.max(2, output.width / 200), lineWidth: 1 })
          }
        })
      } finally { target.restore(); drawing.close() }
      return count
    },
    close() { landmarker.close(); input.width = 1; input.height = 1 }
  }
}
