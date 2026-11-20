export const POSE_MODELS = [
  { value: 'lite', label: 'Lite', description: '軽量・速度優先' },
  { value: 'full', label: 'Full', description: '速度と精度のバランス' },
  { value: 'heavy', label: 'Heavy', description: '精度優先・高負荷' }
] as const
export type PoseModel = typeof POSE_MODELS[number]['value']

export function poseModelUrl(model: PoseModel): string {
  return `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${model}/float16/1/pose_landmarker_${model}.task`
}
