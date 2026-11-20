// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PoseCapture from './PoseCapture.vue'
import VrmPreview from './VrmPreview.vue'
import type { DetailEstimator } from '../lib/detail-tracking'
import type { PoseEstimator } from '../lib/pose-estimator'

const { create, createDetail } = vi.hoisted(() => ({ create: vi.fn(), createDetail: vi.fn() }))
vi.mock('../lib/pose-estimator', () => ({ createPoseEstimator: create }))
vi.mock('../lib/detail-estimator', () => ({ createDetailEstimator: createDetail }))
vi.mock('vitepress', () => ({ withBase: (path: string) => path }))
let wrapper: VueWrapper
let nextFrame: FrameRequestCallback
let engine: PoseEstimator
let ended: () => void
const context = { clearRect: vi.fn(), drawImage: vi.fn() }

async function click(label: string) {
  const button = wrapper.findAll('button').find(button => button.text() === label)!
  await button.trigger('click')
  await vi.dynamicImportSettled()
  await flushPromises()
}
async function share() {
  wrapper = mount(PoseCapture)
  await flushPromises()
  Object.defineProperties(wrapper.get('video').element, {
    srcObject: { value: null, writable: true }, videoWidth: { value: 640 }, videoHeight: { value: 360 }, readyState: { value: 4 }
  })
  await click('画面共有を開始')
}

beforeEach(() => {
  create.mockReset()
  createDetail.mockReset()
  engine = { delegate: 'GPU', draw: vi.fn(() => 1), close: vi.fn() }
  create.mockResolvedValue(engine)
  vi.stubGlobal('isSecureContext', true)
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { nextFrame = callback; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getDisplayMedia: vi.fn(async () => ({
      getTracks: () => [{ stop: vi.fn() }],
      getVideoTracks: () => [{ addEventListener: (_: string, callback: () => void) => { ended = callback } }]
    }))
  } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D)
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('pose capture lifecycle', () => {
  it('infers from a clean crop, redraws after loading, and closes on external sharing stop', async () => {
    await share()
    expect(create).not.toHaveBeenCalled()
    await click('追跡を開始')
    nextFrame(100)
    await flushPromises()
    expect(engine.draw).toHaveBeenCalledWith(wrapper.get('canvas').element, expect.any(Number), expect.any(Function))
    expect(wrapper.text()).toContain('1 人検出')
    ended()
    await flushPromises()
    expect(engine.close).toHaveBeenCalledOnce()
    expect(wrapper.find('video').exists()).toBe(true)
    expect(wrapper.text()).toContain('画面共有が終了しました')
  })

  it('releases a model that finishes loading after sharing has stopped', async () => {
    let resolve!: (engine: PoseEstimator) => void
    create.mockImplementation(() => new Promise<PoseEstimator>(done => { resolve = done }))
    await share()
    await click('追跡を開始')
    await click('共有を停止')
    resolve(engine)
    await flushPromises()
    expect(engine.close).toHaveBeenCalledOnce()
    expect(engine.draw).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('骨格表示中')
  })

  it('allows retrying a failed model load while keeping sharing active', async () => {
    create.mockRejectedValueOnce(new Error('offline'))
    await share()
    await click('追跡を開始')
    expect(wrapper.text()).toContain('モデルを読み込めませんでした')
    expect(wrapper.find('[role="group"]').exists()).toBe(true)
    await click('追跡を開始')
    nextFrame(200)
    await flushPromises()
    expect(engine.draw).toHaveBeenCalled()
  })

  it('stops inference on errors and lets the clean capture loop continue', async () => {
    vi.mocked(engine.draw).mockImplementation(() => { throw new Error('context lost') })
    await share()
    await click('追跡を開始')
    nextFrame(300)
    await flushPromises()
    expect(engine.close).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('ポーズ推定を停止しました')
    expect(wrapper.find('[role="group"]').exists()).toBe(true)
    nextFrame(400)
    expect(engine.draw).toHaveBeenCalledOnce()
  })

  it('selects a model before starting without starting inference automatically', async () => {
    await share()
    expect(wrapper.get('select').element.value).toBe('lite')
    await wrapper.get('select').setValue('full')
    expect(create).not.toHaveBeenCalled()
    await click('追跡を開始')
    expect(create).toHaveBeenCalledWith('full')
  })

  it('replaces active inference and resumes VRM synchronization with the selected model', async () => {
    const replacement: PoseEstimator = { delegate: 'CPU', draw: vi.fn((_canvas, timestamp, onPose) => {
      onPose?.({ points: [], timestamp })
      return 1
    }), close: vi.fn() }
    create.mockResolvedValueOnce(engine).mockResolvedValueOnce(replacement)
    await share()
    await click('追跡を開始')
    await wrapper.get('select').setValue('heavy')
    await flushPromises()
    expect(engine.close).toHaveBeenCalledOnce()
    expect(create).toHaveBeenLastCalledWith('heavy')
    nextFrame(100)
    await flushPromises()
    expect(replacement.draw).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Heavy / CPU')
    expect(wrapper.findComponent(VrmPreview).props('pose')).not.toBeNull()
    expect(wrapper.find('[role="group"]').exists()).toBe(true)
  })

  it('discards a previous model that finishes after a newer selection', async () => {
    let resolve!: (engine: PoseEstimator) => void
    const latest: PoseEstimator = { delegate: 'CPU', draw: vi.fn(() => 1), close: vi.fn() }
    create.mockImplementationOnce(() => new Promise<PoseEstimator>(done => { resolve = done }))
      .mockResolvedValueOnce(latest)
    await share()
    await click('追跡を開始')
    await wrapper.get('select').setValue('full')
    await flushPromises()
    resolve(engine)
    await flushPromises()
    expect(engine.close).toHaveBeenCalledOnce()
    expect(latest.close).not.toHaveBeenCalled()
    nextFrame(200)
    expect(latest.draw).toHaveBeenCalled()
    expect(engine.draw).not.toHaveBeenCalled()
  })

  it('keeps the selected model on a failed switch and retries it', async () => {
    create.mockResolvedValueOnce(engine).mockRejectedValueOnce(new Error('offline'))
    await share()
    await click('追跡を開始')
    await wrapper.get('select').setValue('heavy')
    await flushPromises()
    expect(wrapper.text()).toContain('モデルを読み込めませんでした')
    expect(engine.close).toHaveBeenCalledOnce()
    await click('追跡を開始')
    expect(create).toHaveBeenLastCalledWith('heavy')
  })


  it('runs face and hands together without pose, using clean input and independent toggles', async () => {
    const face = { points: [], blendshapes: { jawOpen: .7 }, timestamp: 100 }
    const faceTask: DetailEstimator = { delegate: 'GPU', close: vi.fn(), draw: vi.fn(() => ({ face, hands: [], count: 1 })) }
    const handTask: DetailEstimator = { delegate: 'CPU', close: vi.fn(), draw: vi.fn(() => ({ face: null, hands: [], count: 0 })) }
    createDetail.mockImplementation(async kind => kind === 'face' ? faceTask : handTask)
    await share()
    await wrapper.get('input[type="checkbox"]').setValue(false)
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes[1].setValue(true)
    await checkboxes[2].setValue(true)
    await click('追跡を開始')
    nextFrame(100)
    await flushPromises()
    expect(create).not.toHaveBeenCalled()
    expect(faceTask.draw).toHaveBeenCalled()
    expect(handTask.draw).toHaveBeenCalled()
    const input = vi.mocked(faceTask.draw).mock.calls[0][0]
    const output = wrapper.get('canvas').element
    expect(input).not.toBe(output)
    expect(vi.mocked(handTask.draw).mock.calls[0][0]).toBe(input)
    expect(wrapper.findComponent(VrmPreview).props('face')).toEqual(face)
    await checkboxes[1].setValue(false)
    expect(faceTask.close).toHaveBeenCalledOnce()
    expect(handTask.close).not.toHaveBeenCalled()
    expect(wrapper.findComponent(VrmPreview).props('face')).toBeNull()
    await click('追跡を停止')
    expect(handTask.close).toHaveBeenCalledOnce()
  })

  it('releases a face model disabled before loading finishes', async () => {
    let resolve!: (task: DetailEstimator) => void
    createDetail.mockImplementation(() => new Promise<DetailEstimator>(done => { resolve = done }))
    const task: DetailEstimator = { delegate: 'GPU', close: vi.fn(), draw: vi.fn() }
    await share()
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await click('追跡を開始')
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(false)
    resolve(task)
    await flushPromises()
    expect(task.close).toHaveBeenCalledOnce()
    expect(task.draw).not.toHaveBeenCalled()
    nextFrame(200)
    expect(engine.draw).toHaveBeenCalled()
  })

  it('reports zero detail FPS when the shared frame stops changing', async () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const draw = vi.fn(() => ({ face: null, hands: [], count: 0 }))
    createDetail.mockResolvedValue({ delegate: 'CPU', close: vi.fn(), draw })
    await share()
    await wrapper.get('input[type="checkbox"]').setValue(false)
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await click('追跡を開始')
    nextFrame(0)
    clock.mockReturnValue(1000)
    nextFrame(1000)
    await flushPromises()
    expect(wrapper.text()).toContain('Face（顔）：CPU・未検出 ／ 1 FPS')
    clock.mockReturnValue(2000)
    nextFrame(2000)
    await flushPromises()
    expect(wrapper.text()).toContain('Face（顔）：CPU・未検出 ／ 0 FPS')
    expect(draw).toHaveBeenCalledOnce()
  })

  it('continues pose inference when face fails, and retries only the failed tracker', async () => {
    createDetail.mockRejectedValueOnce(new Error('offline'))
    const task: DetailEstimator = { delegate: 'GPU', close: vi.fn(), draw: vi.fn(() => ({ face: null, hands: [], count: 0 })) }
    createDetail.mockResolvedValueOnce(task)
    await share()
    await wrapper.findAll('input[type="checkbox"]')[1].setValue(true)
    await click('追跡を開始')
    expect(wrapper.text()).toContain('読み込み失敗')
    nextFrame(300)
    expect(engine.draw).toHaveBeenCalled()
    await click('追跡を開始')
    expect(create).toHaveBeenCalledOnce()
    expect(createDetail).toHaveBeenCalledTimes(2)
    nextFrame(400)
    expect(task.draw).toHaveBeenCalled()
  })

})
