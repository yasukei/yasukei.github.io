// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AspectRatioCalculator from './AspectRatioCalculator.vue'

/**
 * The arithmetic is covered in docs/lib/aspect-ratio.test.ts. What is left here
 * is the wiring: which box is computed and which is left under the caret, and
 * what a ratio change does to a size the user already typed.
 *
 * The one rule the component has to keep is that the box being typed in is
 * never rewritten -- in a browser that yanks the caret mid-number -- while
 * every other input (a preset, the rounding toggle, swap) has to move the
 * *other* box, which means remembering which side was touched last.
 */

function ui(wrapper: ReturnType<typeof mount>) {
  const [ratio, width, height] = wrapper.findAll('input[type="text"]')
  return {
    ratio,
    width,
    height,
    ratioText: () => (ratio.element as HTMLInputElement).value,
    widthText: () => (width.element as HTMLInputElement).value,
    heightText: () => (height.element as HTMLInputElement).value,
    preset: (label: string) =>
      wrapper.findAll('.ar-preset').find((button) => button.text() === label)!,
    rounding: () => wrapper.get('input[type="checkbox"]'),
    copy: () => wrapper.get('.ar-toolbar .ar-btn'),
    swap: () => wrapper.get('.ar-swap')
  }
}

describe('AspectRatioCalculator', () => {
  it('opens on a 16:9 size that matches its ratio', () => {
    const { ratioText, widthText, heightText } = ui(mount(AspectRatioCalculator))

    expect(ratioText()).toBe('16:9')
    expect(widthText()).toBe('1920')
    expect(heightText()).toBe('1080')
  })

  it('computes the height from a typed width', async () => {
    const { width, widthText, heightText } = ui(mount(AspectRatioCalculator))

    await width.setValue('3840')

    expect(widthText()).toBe('3840')
    expect(heightText()).toBe('2160')
  })

  it('computes the width from a typed height', async () => {
    const { height, widthText, heightText } = ui(mount(AspectRatioCalculator))

    await height.setValue('720')

    expect(heightText()).toBe('720')
    expect(widthText()).toBe('1280')
  })

  it('keeps taking input from either side, one after the other', async () => {
    const { width, height, widthText, heightText } = ui(mount(AspectRatioCalculator))

    await width.setValue('1280')
    expect(heightText()).toBe('720')

    await height.setValue('1080')
    expect(widthText()).toBe('1920')

    await width.setValue('640')
    expect(heightText()).toBe('360')
  })

  it('blanks the other box while a number is half deleted', async () => {
    const { width, height, widthText, heightText } = ui(mount(AspectRatioCalculator))

    await width.setValue('')
    expect(heightText()).toBe('')

    // And the box comes back as soon as there is a number to work from.
    await width.setValue('800')
    expect(heightText()).toBe('450')

    await height.setValue('abc')
    expect(widthText()).toBe('')
  })

  describe('presets', () => {
    it('recomputes from the side last typed in', async () => {
      const { width, height, preset, widthText, heightText } = ui(mount(AspectRatioCalculator))

      await width.setValue('1600')
      await preset('4:3').trigger('click')
      // The width is what the user typed, so the height is the one that moves.
      expect(widthText()).toBe('1600')
      expect(heightText()).toBe('1200')

      await height.setValue('1000')
      await preset('1:1').trigger('click')
      expect(heightText()).toBe('1000')
      expect(widthText()).toBe('1000')
    })

    it('marks the preset matching the current ratio', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { preset, ratio } = ui(wrapper)

      expect(preset('16:9').classes()).toContain('ar-preset-active')

      await ratio.setValue('4:3')
      expect(preset('4:3').classes()).toContain('ar-preset-active')
      expect(preset('16:9').classes()).not.toContain('ar-preset-active')
    })
  })

  describe('a ratio typed by hand', () => {
    it('accepts any ratio, not just the presets', async () => {
      const { ratio, width, heightText } = ui(mount(AspectRatioCalculator))

      await ratio.setValue('2.39:1')
      await width.setValue('2390')

      expect(heightText()).toBe('1000')
    })

    it('accepts the other separators', async () => {
      const { ratio, widthText, heightText } = ui(mount(AspectRatioCalculator))

      await ratio.setValue('3/2')

      // The width is the side last touched, so the height is the one that moves.
      expect(widthText()).toBe('1920')
      expect(heightText()).toBe('1280')
    })

    it('explains itself instead of calculating when the ratio is unreadable', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { ratio, heightText } = ui(wrapper)

      await ratio.setValue('16:')

      expect(wrapper.find('.ar-error').exists()).toBe(true)
      expect(heightText()).toBe('')
    })

    it('says what an unreduced ratio comes to', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { ratio } = ui(wrapper)

      await ratio.setValue('1920:1080')

      expect(wrapper.get('.ar-note').text()).toContain('16:9')
      expect(wrapper.find('.ar-error').exists()).toBe(false)
    })

    it('stays quiet about a ratio that is already reduced', async () => {
      const wrapper = mount(AspectRatioCalculator)

      expect(wrapper.find('.ar-note').exists()).toBe(false)
    })
  })

  describe('rounding', () => {
    it('gives whole numbers by default', async () => {
      const { ratio, width, heightText } = ui(mount(AspectRatioCalculator))

      await ratio.setValue('1.414:1')
      await width.setValue('1000')

      expect(heightText()).toBe('707')
    })

    it('shows the fraction when asked, and recomputes the value already on screen', async () => {
      const { ratio, width, rounding, heightText } = ui(mount(AspectRatioCalculator))

      await ratio.setValue('1.414:1')
      await width.setValue('1000')
      expect(heightText()).toBe('707')

      await rounding().setValue(false)
      expect(heightText()).toBe('707.21')

      await rounding().setValue(true)
      expect(heightText()).toBe('707')
    })
  })

  describe('swap', () => {
    it('turns a landscape size into the portrait one', async () => {
      const { swap, ratioText, widthText, heightText } = ui(mount(AspectRatioCalculator))

      await swap().trigger('click')

      expect(ratioText()).toBe('9:16')
      expect(widthText()).toBe('1080')
      expect(heightText()).toBe('1920')
    })

    it('leaves a size that is still consistent afterwards', async () => {
      const { swap, width, widthText, heightText } = ui(mount(AspectRatioCalculator))

      await swap().trigger('click')
      await width.setValue('720')

      expect(widthText()).toBe('720')
      expect(heightText()).toBe('1280')
    })
  })

  describe('the preview shape', () => {
    // Both sides are set from the ratio because CSS max-width and max-height
    // clamp independently: a portrait ratio under them kept the full width and
    // lost only height, drawing every ratio as the same landscape rectangle.
    function shape(wrapper: ReturnType<typeof mount>) {
      const style = wrapper.get('.ar-shape').attributes('style') ?? ''
      const read = (property: string) =>
        Number(new RegExp(`${property}:\\s*([\\d.]+)px`).exec(style)?.[1])
      return { width: read('width'), height: read('height') }
    }

    it('is wider than it is tall for a landscape ratio', () => {
      const { width, height } = shape(mount(AspectRatioCalculator))

      expect(width / height).toBeCloseTo(16 / 9, 2)
      expect(width).toBeGreaterThan(height)
    })

    it('turns taller than it is wide for a portrait ratio', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { ratio } = ui(wrapper)

      await ratio.setValue('9:16')

      const { width, height } = shape(wrapper)
      expect(width / height).toBeCloseTo(9 / 16, 2)
      expect(height).toBeGreaterThan(width)
    })

    it('stays inside its slot however extreme the ratio', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { ratio } = ui(wrapper)

      for (const input of ['21:9', '1:1', '2.39:1', '100:1', '1:100']) {
        await ratio.setValue(input)

        const { width, height } = shape(wrapper)
        expect(width, input).toBeLessThanOrEqual(200)
        expect(height, input).toBeLessThanOrEqual(120)
        // And it fills the slot in the direction it is not limited by.
        expect(Math.max(width / 200, height / 120), input).toBeCloseTo(1, 2)
      }
    })
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

    it('copies the pair as one size', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { width, copy } = ui(wrapper)
      await width.setValue('1280')

      await copy().trigger('click')

      expect(writeText).toHaveBeenLastCalledWith('1280x720')
    })

    it('confirms the copy on the button', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { copy } = ui(wrapper)

      await copy().trigger('click')
      await wrapper.vm.$nextTick()

      expect(copy().text()).toBe('Copied')
    })

    it('has nothing to copy while a box is empty', async () => {
      const wrapper = mount(AspectRatioCalculator)
      const { width, copy } = ui(wrapper)
      await width.setValue('')

      expect(copy().attributes('disabled')).toBeDefined()
      await copy().trigger('click')

      expect(writeText).not.toHaveBeenCalled()
    })

    it('survives a clipboard the browser refuses', async () => {
      writeText.mockRejectedValue(new Error('denied'))
      const wrapper = mount(AspectRatioCalculator)
      const { copy } = ui(wrapper)

      await copy().trigger('click')
      await wrapper.vm.$nextTick()

      // No unhandled rejection, and no false confirmation.
      expect(copy().text()).toBe('Copy')
    })
  })
})
