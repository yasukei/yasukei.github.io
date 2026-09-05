// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KanaConverter from './KanaConverter.vue'

/**
 * The conversion itself is covered in docs/lib/kana.test.ts. What is worth
 * testing here is the wiring the component adds on top: two panes that feed
 * each other through a pair of watchers.
 *
 * That wiring has two failure modes neither the build nor a logic test can
 * see. It can loop, with each watcher retriggering the other; and it can
 * rewrite the pane currently being typed in, which in a browser yanks the
 * caret to the end mid-sentence. A guard prevents both, and it only works if
 * it is cleared again afterwards -- so the tests below always edit twice.
 */

function panes(wrapper: ReturnType<typeof mount>) {
  const [hiragana, katakana] = wrapper.findAll('textarea')
  return {
    hiragana,
    katakana,
    hiraganaText: () => (hiragana.element as HTMLTextAreaElement).value,
    katakanaText: () => (katakana.element as HTMLTextAreaElement).value
  }
}

describe('KanaConverter', () => {
  it('starts with both panes showing the same text', () => {
    const { hiraganaText, katakanaText } = panes(mount(KanaConverter))

    expect(hiraganaText()).toBe('ひらがな と カタカナ を へんかん します。')
    expect(katakanaText()).toBe('ヒラガナ ト カタカナ ヲ ヘンカン シマス。')
  })

  it('converts into the katakana pane while typing hiragana', async () => {
    const { hiragana, katakanaText } = panes(mount(KanaConverter))

    await hiragana.setValue('とうきょう')

    expect(katakanaText()).toBe('トウキョウ')
  })

  it('converts into the hiragana pane while typing katakana', async () => {
    const { katakana, hiraganaText } = panes(mount(KanaConverter))

    await katakana.setValue('オオサカ')

    expect(hiraganaText()).toBe('おおさか')
  })

  it('never rewrites the pane being edited', async () => {
    const { hiragana, katakana, hiraganaText, katakanaText } = panes(mount(KanaConverter))

    // Katakana pasted into the hiragana pane: the other side converts, but the
    // text under the caret is left exactly as the user left it.
    await hiragana.setValue('カタカナ混じり')
    expect(hiraganaText()).toBe('カタカナ混じり')
    expect(katakanaText()).toBe('カタカナ混ジリ')

    // And the same in the other direction.
    await katakana.setValue('ヒラガナまじり')
    expect(katakanaText()).toBe('ヒラガナまじり')
    expect(hiraganaText()).toBe('ひらがなまじり')
  })

  it('keeps syncing after each edit, so the guard is released', async () => {
    const { hiragana, katakana, hiraganaText, katakanaText } = panes(mount(KanaConverter))

    await hiragana.setValue('あ')
    expect(katakanaText()).toBe('ア')

    await katakana.setValue('イ')
    expect(hiraganaText()).toBe('い')

    await hiragana.setValue('う')
    expect(katakanaText()).toBe('ウ')

    await katakana.setValue('エ')
    expect(hiraganaText()).toBe('え')
  })

  it('clears both panes at once', async () => {
    const wrapper = mount(KanaConverter)
    const { hiraganaText, katakanaText } = panes(wrapper)

    await wrapper.get('.kc-btn').trigger('click')

    expect(hiraganaText()).toBe('')
    expect(katakanaText()).toBe('')
  })

  it('counts characters of the current input', async () => {
    const wrapper = mount(KanaConverter)
    const { hiragana } = panes(wrapper)

    await hiragana.setValue('あいうえお')

    expect(wrapper.get('.kc-count').text()).toBe('5 chars')
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

    it('copies each pane in its own script', async () => {
      const wrapper = mount(KanaConverter)
      const { hiragana } = panes(wrapper)
      await hiragana.setValue('ねこ')

      const [copyHiragana, copyKatakana] = wrapper.findAll('.kc-copy')

      await copyHiragana.trigger('click')
      expect(writeText).toHaveBeenLastCalledWith('ねこ')

      await copyKatakana.trigger('click')
      expect(writeText).toHaveBeenLastCalledWith('ネコ')
    })

    it('confirms the copy on the button that was pressed', async () => {
      const wrapper = mount(KanaConverter)
      const [copyHiragana, copyKatakana] = wrapper.findAll('.kc-copy')

      await copyHiragana.trigger('click')
      await wrapper.vm.$nextTick()

      expect(copyHiragana.text()).toBe('Copied')
      expect(copyKatakana.text()).toBe('Copy')
    })

    it('survives a clipboard the browser refuses', async () => {
      writeText.mockRejectedValue(new Error('denied'))
      const wrapper = mount(KanaConverter)
      const [copyHiragana] = wrapper.findAll('.kc-copy')

      await copyHiragana.trigger('click')
      await wrapper.vm.$nextTick()

      // No unhandled rejection, and no false confirmation.
      expect(copyHiragana.text()).toBe('Copy')
    })
  })
})
