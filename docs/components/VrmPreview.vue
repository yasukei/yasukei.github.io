<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import type { FaceFrame, HandFrame } from '../lib/detail-tracking'
import type { PoseFrame } from '../lib/vrm-pose'
import type { VrmScene } from '../lib/vrm-scene'
const props = defineProps<{ pose: PoseFrame | null; face?: FaceFrame | null; hands?: HandFrame[] }>()
const canvas = ref<HTMLCanvasElement>()
const loading = ref(false)
const loaded = ref(false)
const status = ref('ローカルの .vrm ファイルを選んでください。')
let scene: VrmScene | undefined
let disposed = false
let run = 0
watch(() => props.pose, pose => scene?.setPose(pose))
watch(() => props.face, face => scene?.setFace(face ?? null))
watch(() => props.hands, hands => scene?.setHands(hands ?? []))
onBeforeUnmount(() => { disposed = true; run++; scene?.dispose() })
async function select(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!/\.vrm$/i.test(file.name)) { status.value = '.vrm ファイルを選んでください。'; return }
  const current = ++run
  loading.value = true
  status.value = `${file.name} を読み込み中…`
  try {
    const { VrmScene } = await import('../lib/vrm-scene')
    if (disposed || current !== run) return
    scene ??= new VrmScene(canvas.value!)
    if (!await scene.load(file) || disposed || current !== run) return
    loaded.value = true
    scene.setPose(props.pose)
    scene.setFace(props.face ?? null)
    scene.setHands(props.hands ?? [])
    status.value = `${file.name} を表示中`
  } catch (error) {
    if (disposed || current !== run) return
    status.value = `VRM を読み込めませんでした。${error instanceof Error ? error.message : 'WebGL 対応とファイル形式を確認してください。'}`
  } finally { if (current === run) loading.value = false }
}
</script>
<template>
  <div class="vrm-preview">
    <h2>VRM 同期表示</h2>
    <label>VRM ファイル <input type="file" accept=".vrm" :disabled="loading" @change="select" /></label>
    <p aria-live="polite">{{ status }}</p>
    <canvas ref="canvas" aria-label="VRM モデル" />
    <div class="actions">
      <button :disabled="!loaded" @click="scene?.resetView()">視点を戻す</button>
      <button :disabled="!loaded" @click="scene?.resetPose()">ポーズをリセット</button>
    </div>
    <p v-if="loaded">{{ pose || face || hands?.length ? '推定したポーズに同期中' : 'ポーズ推定待ち（最後の姿勢を保持）' }}</p>
    <p class="hint">ドラッグで回転、ホイールで拡大縮小。Pose で全身、Face で顔の向き・まばたき・口・笑顔、Hand で手首・指が同期します。表情や手首・指の再現はモデルの対応状況に依存します。移動には対応していません。見えない関節は最後の姿勢を保持し、顔が見つからなくなると表情は解除します。</p>
    <p class="hint">VRM は端末内だけで読み込みます。モデルは同梱していません。各モデルの利用条件に従ってください。<a :href="withBase('/licenses/three-vrm-LICENSE.txt')" target="_blank" rel="noopener">three-vrm（MIT）</a> と
      <a :href="withBase('/licenses/three-LICENSE.txt')" target="_blank" rel="noopener">three.js（MIT）</a> を使用しています。</p>
  </div>
</template>
<style scoped>
h2 { font-size: 18px; margin-top: 20px; }
canvas { display: block; width: 100%; height: 400px; background: #20242d; border-radius: 6px; }
input { max-width: 100%; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
button { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 6px 12px; background: var(--vp-c-bg-soft); cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
.hint { font-size: 13px; color: var(--vp-c-text-2); }
</style>
