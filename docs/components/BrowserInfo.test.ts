// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BrowserInfo from './BrowserInfo.vue'

/**
 * What each section contains is covered in docs/lib/browser-info.test.ts and
 * docs/lib/hardware-info.test.ts.
 * Here it is the wiring: nothing is read before mount (the page is prerendered
 * where there is no browser), the client hints arrive late and are slotted in
 * second, and a change of OS setting updates the table without a reload.
 */

type Listener = () => void

/** A matchMedia whose answers can be flipped, firing `change` like a browser does. */
function fakeMatchMedia() {
  const matching = new Set<string>()
  const listeners = new Map<string, Set<Listener>>()

  const matchMedia = (query: string) => ({
    get matches() {
      return matching.has(query)
    },
    addEventListener: (_: string, fn: Listener) => {
      if (!listeners.has(query)) listeners.set(query, new Set())
      listeners.get(query)!.add(fn)
    },
    removeEventListener: (_: string, fn: Listener) => listeners.get(query)?.delete(fn)
  })

  return {
    matchMedia,
    set(query: string, on: boolean) {
      if (on) matching.add(query)
      else matching.delete(query)
      for (const fn of listeners.get(query) ?? []) fn()
    },
    listenerCount: () => [...listeners.values()].reduce((n, set) => n + set.size, 0)
  }
}

function valueOf(wrapper: ReturnType<typeof mount>, label: string): string {
  const row = wrapper.findAll('.bi-row').find((r) => r.get('.bi-label-text').text() === label)
  if (!row) throw new Error(`no row "${label}"`)
  return row.get('.bi-value').text()
}

const BROWSER = { props: { category: 'browser' as const } }
const HARDWARE = { props: { category: 'hardware' as const } }

describe('BrowserInfo', () => {
  let media: ReturnType<typeof fakeMatchMedia>

  beforeEach(() => {
    media = fakeMatchMedia()
    vi.stubGlobal('matchMedia', media.matchMedia)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the sections, with the client hints right after the UA', async () => {
    const wrapper = mount(BrowserInfo, BROWSER)
    await flushPromises()

    expect(wrapper.findAll('.bi-section').map((s) => s.attributes('data-section'))).toEqual([
      'user-agent',
      'client-hints',
      'locale',
      'privacy',
      'display'
    ])
    expect(valueOf(wrapper, 'User-Agent')).toContain(navigator.userAgent)
  })

  it('marks what the browser does not offer instead of leaving it blank', async () => {
    // happy-dom has no navigator.userAgentData, like Firefox and Safari.
    const wrapper = mount(BrowserInfo, BROWSER)
    await flushPromises()

    expect(valueOf(wrapper, 'OS名')).toContain('取得できない')
  })

  it('follows a change of OS theme without a reload', async () => {
    media.set('(prefers-color-scheme: light)', true)
    const wrapper = mount(BrowserInfo, BROWSER)
    await flushPromises()
    expect(valueOf(wrapper, 'ダークモード')).toMatch(/^light/)

    media.set('(prefers-color-scheme: light)', false)
    media.set('(prefers-color-scheme: dark)', true)
    await flushPromises()

    expect(valueOf(wrapper, 'ダークモード')).toMatch(/^dark/)
  })

  it('stops listening once it is gone', async () => {
    const wrapper = mount(BrowserInfo, BROWSER)
    await flushPromises()
    expect(media.listenerCount()).toBeGreaterThan(0)

    wrapper.unmount()

    expect(media.listenerCount()).toBe(0)
  })

  it('copies everything as JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mount(BrowserInfo, BROWSER)
    await flushPromises()

    const copy = wrapper.findAll('.bi-btn').find((b) => b.text() === 'JSONでコピー')!
    await copy.trigger('click')
    await flushPromises()

    const copied = JSON.parse(writeText.mock.calls[0][0])
    expect(copied['User-Agent']['User-Agent']).toBe(navigator.userAgent)
    expect(copy.text()).toBe('Copied')
  })

  describe('hardware', () => {
    it('lists its own sections', async () => {
      const wrapper = mount(BrowserInfo, HARDWARE)
      await flushPromises()

      expect(wrapper.findAll('.bi-section').map((s) => s.attributes('data-section'))).toEqual([
        'cpu-memory',
        'screen',
        'input',
        'gpu',
        'rendering',
        'devices',
        'battery',
        'network'
      ])
      expect(valueOf(wrapper, 'CPUの論理コア数')).toMatch(new RegExp(`^${navigator.hardwareConcurrency}(?!\\d)`))
    })

    it('shows a probe that found nothing as unavailable', async () => {
      // happy-dom renders no audio, like a browser without OfflineAudioContext.
      const wrapper = mount(BrowserInfo, HARDWARE)
      await flushPromises()

      expect(valueOf(wrapper, 'AudioContextの処理結果')).toContain('取得できない')
    })

    it('follows a change of pointer, e.g. a tablet docked to a keyboard', async () => {
      media.set('(pointer: coarse)', true)
      const wrapper = mount(BrowserInfo, HARDWARE)
      await flushPromises()
      expect(valueOf(wrapper, '主なポインタ')).toMatch(/^coarse/)

      media.set('(pointer: coarse)', false)
      media.set('(pointer: fine)', true)
      await flushPromises()

      expect(valueOf(wrapper, '主なポインタ')).toMatch(/^fine/)
    })
  })
})

describe('BrowserInfo install', () => {
  it('lists its own sections, without names where nothing could be measured', async () => {
    // happy-dom has no canvas to measure fonts with.
    const wrapper = mount(BrowserInfo, { props: { category: 'install' as const } })
    await flushPromises()

    expect(wrapper.findAll('.bi-section').map((s) => s.attributes('data-section'))).toEqual([
      'fonts',
      'voices',
      'storage'
    ])
    expect(valueOf(wrapper, 'インストールされているフォント')).toContain('取得できない')
  })
})
