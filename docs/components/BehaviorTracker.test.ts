// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BehaviorTracker from './BehaviorTracker.vue'

/**
 * What the log makes of the events is covered in docs/lib/behavior.test.ts.
 * Here it is the wiring: real DOM events reach the log, the table catches up
 * on its timer, and nothing is left listening once the component is gone.
 */

function valueOf(wrapper: ReturnType<typeof mount>, label: string): string {
  const row = wrapper.findAll('.bi-row').find((r) => r.get('.bi-label-text').text() === label)
  if (!row) throw new Error(`no row "${label}"`)
  return row.get('.bi-value').text()
}

describe('BehaviorTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function tick() {
    await vi.advanceTimersByTimeAsync(200)
  }

  it('shows the sections as soon as it mounts', async () => {
    const wrapper = mount(BehaviorTracker)
    await tick()

    expect(wrapper.findAll('.bi-section').map((s) => s.attributes('data-section'))).toEqual([
      'mouse',
      'scroll',
      'keys',
      'clipboard',
      'tab',
      'sensors'
    ])
    expect(valueOf(wrapper, '今の位置')).toContain('まだ動いていません')
    wrapper.unmount()
  })

  it('follows the pointer anywhere on the page', async () => {
    const wrapper = mount(BehaviorTracker)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 20 }))
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 13, clientY: 24 }))
    await tick()

    expect(valueOf(wrapper, '今の位置')).toMatch(/^13, 24/)
    expect(valueOf(wrapper, '動かした距離')).toBe('5 px')
    wrapper.unmount()
  })

  it('counts keys pressed outside any field', async () => {
    const wrapper = mount(BehaviorTracker)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }))
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA' }))
    await tick()

    expect(valueOf(wrapper, 'キーを押した回数')).toMatch(/^1 回/)
    wrapper.unmount()
  })

  it('reads the field while it is being typed in', async () => {
    const wrapper = mount(BehaviorTracker)
    await wrapper.get('textarea').setValue('not sent yet')
    await tick()

    expect(valueOf(wrapper, '入力欄の中身 (送信前)')).toMatch(/^not sent yet/)
    wrapper.unmount()
  })

  it('puts the sensor permission button right above the sensor section', async () => {
    // A browser that hides the sensors until asked, as iOS does.
    vi.stubGlobal('DeviceOrientationEvent', Object.assign(class {}, { requestPermission: vi.fn() }))
    try {
      const wrapper = mount(BehaviorTracker)
      await tick()

      const button = wrapper.get('.bt-btn')
      expect(button.element.nextElementSibling?.getAttribute('data-section')).toBe('sensors')
      wrapper.unmount()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('has no button where the sensors need no asking', async () => {
    // happy-dom has no DeviceOrientationEvent at all, like a desktop Firefox.
    const wrapper = mount(BehaviorTracker)
    await tick()

    expect(wrapper.find('.bt-btn').exists()).toBe(false)
    wrapper.unmount()
  })

  it('stops listening and ticking once it is gone', async () => {
    const wrapper = mount(BehaviorTracker)
    await tick()
    expect(vi.getTimerCount()).toBe(1)

    const remove = vi.spyOn(window, 'removeEventListener')
    wrapper.unmount()

    expect(vi.getTimerCount()).toBe(0)
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(['pointermove', 'keydown', 'scroll']))
  })
})
