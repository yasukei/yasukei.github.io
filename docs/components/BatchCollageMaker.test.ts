// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BatchCollageMaker from './BatchCollageMaker.vue'
import { renderBatchCollage, type RenderedCollage } from '../lib/batch-collage-canvas'

vi.mock('../lib/batch-collage-canvas', () => ({ renderBatchCollage: vi.fn() }))
const rendered = () => ({ blob: new Blob(['jpeg'], { type: 'image/jpeg' }), size: { width: 240, height: 160 } })

beforeEach(() => {
  let next = 0
  URL.createObjectURL = vi.fn(() => `blob:collage/${++next}`)
  URL.revokeObjectURL = vi.fn()
  vi.mocked(renderBatchCollage).mockResolvedValue(rendered())
})
afterEach(() => { vi.restoreAllMocks() })

async function ready() {
  const wrapper = mount(BatchCollageMaker)
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: ['a', 'b', 'c', 'd'].map(name => new File(['image'], `${name}.jpg`)) })
  await input.trigger('change')
  return wrapper
}

describe('batch collage lifecycle', () => {
  it('discards both the preview and ZIP when settings change or the component unmounts', async () => {
    const wrapper = await ready()
    await wrapper.get('.actions button').trigger('click')
    await flushPromises()
    expect(wrapper.find('a[download="collages.zip"]').exists()).toBe(true)
    await wrapper.findAll('.settings input')[0].setValue('1')
    expect(wrapper.find('figure').exists()).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:collage/1')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:collage/2')
    await wrapper.get('.actions button').trigger('click')
    await flushPromises()
    wrapper.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:collage/3')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:collage/4')
  })

  it.each(['cancel', 'unmount'])('does not publish a late result after %s', async action => {
    let finish!: (value: RenderedCollage) => void
    vi.mocked(renderBatchCollage).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const wrapper = await ready()
    await wrapper.get('.actions button').trigger('click')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    if (action === 'cancel') await wrapper.findAll('.actions button')[1].trigger('click')
    else wrapper.unmount()
    finish(rendered())
    await flushPromises()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    if (action === 'cancel') {
      expect(wrapper.text()).toContain('中止しました')
      expect(wrapper.find('a[download="collages.zip"]').exists()).toBe(false)
      wrapper.unmount()
    }
  })
})
