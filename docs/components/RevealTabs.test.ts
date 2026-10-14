// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import RevealTabs from './RevealTabs.vue'

/**
 * The tabs only switch which panel is shown. The panels themselves are
 * covered by BrowserInfo.test.ts and BehaviorTracker.test.ts; what matters
 * here is that a hidden panel stays mounted (so the behaviour log keeps
 * recording) and that the URL hash and the selected tab follow each other.
 */

function visible(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll('[role="tabpanel"]')
    .filter((panel) => (panel.element as HTMLElement).style.display !== 'none')
    .map((panel) => panel.attributes('data-tab')!)
}

function selected(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper
    .findAll('[role="tab"]')
    .filter((tab) => tab.attributes('aria-selected') === 'true')
    .map((tab) => tab.text())
}

describe('RevealTabs', () => {
  afterEach(() => {
    history.replaceState(null, '', location.pathname)
  })

  it('opens on the first tab with every panel mounted', async () => {
    const wrapper = mount(RevealTabs)
    await flushPromises()

    expect(wrapper.findAll('[role="tab"]').map((t) => t.text())).toEqual([
      'ブラウザ・OS',
      'ハードウェア',
      'インストール環境',
      'ウィンドウとページ',
      '操作の情報',
      '許可が必要なもの'
    ])
    expect(visible(wrapper)).toEqual(['browser'])
    // Hidden, not unmounted: the behaviour log has to keep recording.
    expect(wrapper.find('[data-tab="behavior"] .bt-trail').exists()).toBe(true)
    wrapper.unmount()
  })

  it('switches panels on click and keeps the choice in the hash', async () => {
    const wrapper = mount(RevealTabs)
    await wrapper.get('#rt-tab-hardware').trigger('click')

    expect(visible(wrapper)).toEqual(['hardware'])
    expect(selected(wrapper)).toEqual(['ハードウェア'])
    expect(location.hash).toBe('#hardware')
    wrapper.unmount()
  })

  it('switches tabs without adding history entries', async () => {
    const before = history.length
    const wrapper = mount(RevealTabs)
    await wrapper.get('#rt-tab-hardware').trigger('click')
    await wrapper.get('#rt-tab-install').trigger('click')

    expect(history.length).toBe(before)
    wrapper.unmount()
  })

  it('opens the tab a link points at', async () => {
    history.replaceState(null, '', '#behavior')
    const wrapper = mount(RevealTabs)
    await flushPromises()

    expect(visible(wrapper)).toEqual(['behavior'])
    wrapper.unmount()
  })

  it('ignores a hash that is not a tab', async () => {
    history.replaceState(null, '', '#nonsense')
    const wrapper = mount(RevealTabs)
    await flushPromises()

    expect(visible(wrapper)).toEqual(['browser'])
    wrapper.unmount()
  })

  it('follows the hash when it changes', async () => {
    const wrapper = mount(RevealTabs)
    history.replaceState(null, '', '#page')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()

    expect(visible(wrapper)).toEqual(['page'])
    wrapper.unmount()
  })

  it('moves along the tabs with the arrow keys, wrapping at the ends', async () => {
    const wrapper = mount(RevealTabs, { attachTo: document.body })
    const tabs = () => wrapper.findAll('[role="tab"]')

    await tabs()[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(selected(wrapper)).toEqual(['許可が必要なもの'])
    expect(document.activeElement?.id).toBe('rt-tab-permission')

    await tabs()[5].trigger('keydown', { key: 'ArrowRight' })
    expect(selected(wrapper)).toEqual(['ブラウザ・OS'])

    await tabs()[0].trigger('keydown', { key: 'End' })
    expect(selected(wrapper)).toEqual(['許可が必要なもの'])

    // Only the selected tab is in the tab order.
    expect(tabs().map((t) => t.attributes('tabindex'))).toEqual(['-1', '-1', '-1', '-1', '-1', '0'])
    wrapper.unmount()
  })
})
