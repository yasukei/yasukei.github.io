// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepField from './StepField.vue'

/**
 * The point of this field is the exact value, so the tests are about the ways
 * an exact value can be lost: an arrow that steps by more than one, a bound
 * that can be walked past, and -- the one that makes a field unusable -- a box
 * that clamps what is being typed before the typist has finished.
 */

/** Mounted the way it is actually used: with v-model, so the value comes back in. */
function field(value = 50, overrides: Record<string, unknown> = {}) {
  let wrapper: ReturnType<typeof mount>
  wrapper = mount(StepField, {
    props: {
      modelValue: value,
      min: 20,
      max: 80,
      label: 'Hero size',
      unit: '%',
      'onUpdate:modelValue': (next: number) => wrapper.setProps({ modelValue: next }),
      ...overrides
    }
  })
  return wrapper
}

const emitted = (wrapper: ReturnType<typeof field>) =>
  (wrapper.emitted('update:modelValue') ?? []).map(([value]) => value)

const box = (wrapper: ReturnType<typeof field>) => wrapper.get('input[type="text"]')
const shown = (wrapper: ReturnType<typeof field>) =>
  (box(wrapper).element as HTMLInputElement).value

/**
 * Types into the box without leaving it. setValue fires `change` as well as
 * `input`, which in a browser only happens on blur or Enter -- so using it
 * here would commit every keystroke and hide the very thing being tested.
 */
async function type(wrapper: ReturnType<typeof field>, text: string) {
  ;(box(wrapper).element as HTMLInputElement).value = text
  await box(wrapper).trigger('input')
}

describe('StepField', () => {
  it('shows the value it was given', () => {
    const wrapper = field(42)

    expect(shown(wrapper)).toBe('42')
    expect(wrapper.get('input[type="range"]').attributes('value')).toBe('42')
  })

  describe('the arrows', () => {
    it('step by exactly one, which is what the slider cannot do', async () => {
      const wrapper = field(50)

      await wrapper.get('[aria-label="Increase Hero size"]').trigger('click')
      await wrapper.get('[aria-label="Decrease Hero size"]').trigger('click')

      expect(emitted(wrapper)).toEqual([51, 50])
    })

    it('stop at the bounds rather than walking past them', async () => {
      const top = field(80)
      const bottom = field(20)

      expect(top.get('[aria-label="Increase Hero size"]').attributes('disabled')).toBeDefined()
      expect(bottom.get('[aria-label="Decrease Hero size"]').attributes('disabled')).toBeDefined()

      await top.get('[aria-label="Increase Hero size"]').trigger('click')
      expect(emitted(top)).toEqual([])
    })

    it('leaves the other arrow alone at a bound', () => {
      const wrapper = field(80)

      expect(wrapper.get('[aria-label="Decrease Hero size"]').attributes('disabled')).toBeUndefined()
    })
  })

  describe('the box', () => {
    it('takes a typed number once the field is left', async () => {
      const wrapper = field(50)

      await type(wrapper, '63')
      await box(wrapper).trigger('change')

      expect(emitted(wrapper)).toEqual([63])
    })

    it('does not fight the typist mid-number', async () => {
      // Typing "50" into a field with a minimum of 20 starts with a 5; see
      // `commit` for what clamping it there would do.
      const wrapper = field(20)

      await type(wrapper, '5')

      expect(emitted(wrapper)).toEqual([])
      expect(shown(wrapper)).toBe('5')

      await type(wrapper, '50')
      await box(wrapper).trigger('change')

      expect(emitted(wrapper)).toEqual([50])
    })

    it('pulls an out of range number back to the bound, and shows that it did', async () => {
      const wrapper = field(50)

      await type(wrapper, '999')
      await box(wrapper).trigger('change')

      expect(emitted(wrapper)).toEqual([80])
      expect(shown(wrapper)).toBe('80')
    })

    it('rounds a fraction to a whole unit', async () => {
      const wrapper = field(50)

      await type(wrapper, '63.7')
      await box(wrapper).trigger('change')

      expect(emitted(wrapper)).toEqual([64])
    })

    it('puts back what was there when the box is left empty or nonsense', async () => {
      const wrapper = field(50)

      await type(wrapper, '')
      await box(wrapper).trigger('change')
      expect(shown(wrapper)).toBe('50')

      await type(wrapper, 'abc')
      await box(wrapper).trigger('change')
      expect(shown(wrapper)).toBe('50')
      expect(emitted(wrapper)).toEqual([])
    })

    it('says nothing when the value did not actually change', async () => {
      const wrapper = field(50)

      await type(wrapper, '50')
      await box(wrapper).trigger('change')

      expect(emitted(wrapper)).toEqual([])
    })
  })

  it('follows the slider', async () => {
    const wrapper = field(50)

    await wrapper.get('input[type="range"]').setValue('35')

    expect(emitted(wrapper)).toEqual([35])
  })

  it('catches up when the value is changed from outside', async () => {
    const wrapper = field(50)

    await wrapper.setProps({ modelValue: 72 })

    expect(shown(wrapper)).toBe('72')
  })

  it('labels the slider plainly and the box as its value', () => {
    const wrapper = field()

    expect(wrapper.get('input[type="range"]').attributes('aria-label')).toBe('Hero size')
    expect(box(wrapper).attributes('aria-label')).toBe('Hero size value')
  })
})
