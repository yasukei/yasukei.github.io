// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownViewer from './MarkdownViewer.vue'

/**
 * Rendering markdown is marked's job, not this component's, so the preview is
 * only checked as far as the binding: what is typed reaches it.
 *
 * The parts worth pinning are the ones marked knows nothing about -- the
 * fullscreen state, the Escape key that leaves it, and the window listener
 * behind that key, which has to be removed on unmount or it outlives the page.
 */

function buttonLabelled(wrapper: ReturnType<typeof mount>, label: string) {
  const button = wrapper.findAll('.mv-btn').find((b) => b.text() === label)
  if (!button) throw new Error(`no button labelled "${label}"`)
  return button
}

const textareaValue = (wrapper: ReturnType<typeof mount>) =>
  (wrapper.get('textarea').element as HTMLTextAreaElement).value

const pressEscape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

describe('MarkdownViewer', () => {
  it('renders what is typed into the preview', async () => {
    const wrapper = mount(MarkdownViewer)

    await wrapper.get('textarea').setValue('# Heading\n\nSome **bold** text.')

    const preview = wrapper.get('.mv-preview').html()
    expect(preview).toContain('<h1>Heading</h1>')
    expect(preview).toContain('<strong>bold</strong>')
  })

  it('empties both the input and the preview when cleared', async () => {
    const wrapper = mount(MarkdownViewer)
    expect(textareaValue(wrapper)).not.toBe('')

    await buttonLabelled(wrapper, 'Clear').trigger('click')

    expect(textareaValue(wrapper)).toBe('')
    expect(wrapper.get('.mv-preview').text()).toBe('')
  })

  describe('fullscreen', () => {
    it('toggles the class and the button label', async () => {
      const wrapper = mount(MarkdownViewer)
      const toggle = wrapper.get('.mv-btn-fs')

      expect(wrapper.get('.mv-root').classes()).not.toContain('mv-fullscreen')
      expect(toggle.text()).toBe('Fullscreen')

      await toggle.trigger('click')
      expect(wrapper.get('.mv-root').classes()).toContain('mv-fullscreen')
      expect(toggle.text()).toBe('Exit Fullscreen')

      await toggle.trigger('click')
      expect(wrapper.get('.mv-root').classes()).not.toContain('mv-fullscreen')
      expect(toggle.text()).toBe('Fullscreen')
    })

    it('leaves fullscreen on Escape', async () => {
      const wrapper = mount(MarkdownViewer)
      await wrapper.get('.mv-btn-fs').trigger('click')

      pressEscape()
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.mv-root').classes()).not.toContain('mv-fullscreen')
    })

    it('ignores Escape when not in fullscreen', async () => {
      const wrapper = mount(MarkdownViewer)

      pressEscape()
      await wrapper.vm.$nextTick()

      expect(wrapper.get('.mv-root').classes()).not.toContain('mv-fullscreen')
    })
  })

  it('removes its window listener on unmount', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')

    const wrapper = mount(MarkdownViewer)
    const registered = add.mock.calls.find(([type]) => type === 'keydown')?.[1]
    expect(registered).toBeDefined()

    wrapper.unmount()

    // The same handler reference must come back off, or navigating between
    // pages leaves a listener behind on every visit.
    expect(remove).toHaveBeenCalledWith('keydown', registered)

    add.mockRestore()
    remove.mockRestore()
  })

  describe('copy', () => {
    const writeText = vi.fn()

    beforeEach(() => {
      writeText.mockReset().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true
      })
    })

    it('copies the markdown source, not the rendered output', async () => {
      const wrapper = mount(MarkdownViewer)
      await wrapper.get('textarea').setValue('# Heading')

      await buttonLabelled(wrapper, 'Copy').trigger('click')

      expect(writeText).toHaveBeenCalledWith('# Heading')
    })
  })
})
