// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BrowserInfo from './BrowserInfo.vue'

/**
 * What each section contains is covered in docs/lib/browser-info.test.ts.
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
    const wrapper = mount(BrowserInfo)
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
    const wrapper = mount(BrowserInfo)
    await flushPromises()

    expect(valueOf(wrapper, 'OS名')).toContain('取得できない')
  })

  it('follows a change of OS theme without a reload', async () => {
    media.set('(prefers-color-scheme: light)', true)
    const wrapper = mount(BrowserInfo)
    await flushPromises()
    expect(valueOf(wrapper, 'ダークモード')).toMatch(/^light/)

    media.set('(prefers-color-scheme: light)', false)
    media.set('(prefers-color-scheme: dark)', true)
    await flushPromises()

    expect(valueOf(wrapper, 'ダークモード')).toMatch(/^dark/)
  })

  it('stops listening once it is gone', async () => {
    const wrapper = mount(BrowserInfo)
    await flushPromises()
    expect(media.listenerCount()).toBeGreaterThan(0)

    wrapper.unmount()

    expect(media.listenerCount()).toBe(0)
  })

  it('copies everything as JSON', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = mount(BrowserInfo)
    await flushPromises()

    const copy = wrapper.findAll('.bi-btn').find((b) => b.text() === 'JSONでコピー')!
    await copy.trigger('click')
    await flushPromises()

    const copied = JSON.parse(writeText.mock.calls[0][0])
    expect(copied['User-Agent']['User-Agent']).toBe(navigator.userAgent)
    expect(copy.text()).toBe('Copied')
  })
})
