// The dependency does not export its package metadata as a public subpath.
import { version } from '../../node_modules/@mediapipe/tasks-vision/package.json'

export const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`
