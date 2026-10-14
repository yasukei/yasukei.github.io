import { describe, it, expect } from 'vitest'
import { BehaviorLog, clip, describeElement, keyLabel, mean, speedOf } from './behavior'
import type { Section } from './browser-info'

function value(sections: Section[], label: string) {
  for (const section of sections) {
    const found = section.rows.find((r) => r.label === label)
    if (found) return found.value
  }
  throw new Error(`no row "${label}"`)
}

/** Types `text` at a steady rhythm: each key held `dwell` ms, `gap` ms between keys. */
function type(log: BehaviorLog, text: string, start: number, dwell: number, gap: number): number {
  let t = start
  for (const ch of text) {
    log.keyDown(ch, `Key${ch}`, t, false)
    log.keyUp(`Key${ch}`, t + dwell)
    t += dwell + gap
  }
  return t
}

describe('helpers', () => {
  it('mean', () => {
    expect(mean([])).toBeNull()
    expect(mean([1, 2, 6])).toBe(3)
  })

  it('speedOf counts only the recent movement', () => {
    const points = [
      { t: 0, d: 1000 }, // too old to count
      { t: 800, d: 30 },
      { t: 900, d: 30 }
    ]
    // 60 px over the 300 ms window.
    expect(speedOf(points, 1000)).toBe(200)
    expect(speedOf(points, 5000)).toBe(0)
  })

  it('clip folds whitespace and cuts long text', () => {
    expect(clip('a\n\n  b')).toBe('a b')
    expect(clip('abcdef', 3)).toBe('abc…')
  })

  it('describeElement says which thing it was', () => {
    expect(describeElement({ tagName: 'BUTTON', className: 'bi-btn primary', textContent: '再取得' })).toBe(
      'button.bi-btn "再取得"'
    )
    expect(describeElement({ tagName: 'DIV', id: 'app', className: '', textContent: '' })).toBe('div#app')
    // An SVG element's className is not a string.
    expect(describeElement({ tagName: 'svg', className: { baseVal: 'icon' }, textContent: null })).toBe('svg')
  })

  it('keyLabel names the space bar, and what an IME is composing', () => {
    expect(keyLabel(' ')).toBe('␣')
    expect(keyLabel('a')).toBe('a')
    expect(keyLabel('Process')).toBe('IME')
  })
})

describe('BehaviorLog', () => {
  it('starts out saying nothing has happened yet', () => {
    const sections = new BehaviorLog().sections(0)

    expect(sections.map((s) => s.id)).toEqual(['mouse', 'scroll', 'keys', 'clipboard', 'tab'])
    expect(value(sections, '今の位置')).toBeNull()
    expect(value(sections, '動かした距離')).toBe('0 px')
    expect(value(sections, 'キーとキーの間隔の平均')).toBeNull()
    // A null here is "not yet", so every one of them says so instead of "unsupported".
    const unexplained = sections.flatMap((s) => s.rows).filter((r) => r.value === null && !r.missing)
    expect(unexplained.map((r) => r.label)).toEqual([])
  })

  describe('mouse', () => {
    it('adds up the distance and knows the current speed', () => {
      const log = new BehaviorLog()
      log.move(0, 0, 1000)
      log.move(30, 40, 1100) // 50 px
      log.move(30, 100, 1200) // 60 px

      const sections = log.sections(1200)
      expect(value(sections, '今の位置')).toBe('30, 100')
      expect(value(sections, '動かした距離')).toBe('110 px')
      expect(value(sections, '今の速さ')).toBe(`${Math.round((110 / 300) * 1000)} px/秒`)
      // And standing still, the speed falls back to nothing.
      expect(value(log.sections(3000), '今の速さ')).toBe('0 px/秒')
    })

    it('records clicks with what was clicked', () => {
      const log = new BehaviorLog()
      log.click({ x: 10.4, y: 20.6 }, 0, 'button.bi-btn "再取得"')
      log.click({ x: 5, y: 6 }, 1, 'a "Home"')

      const sections = log.sections(1)
      expect(value(sections, 'クリックした回数')).toBe('2 回')
      expect(value(sections, '最後にクリックした場所')).toBe('5, 6 の a "Home"')
    })

    it('gives no position for a click made from the keyboard', () => {
      const log = new BehaviorLog()
      log.click(null, 0, 'button.rt-tab "ハードウェア"')

      expect(value(log.sections(0), '最後にクリックした場所')).toBe('キーボードで押した button.rt-tab "ハードウェア"')
    })

    it('keeps only a bounded trail', () => {
      const log = new BehaviorLog()
      for (let i = 0; i < 2000; i++) log.move(i, 0, i)

      expect(log.trail.length).toBeLessThan(2000)
      // The distance still counts every movement.
      expect(value(log.sections(2000), '動かした距離')).toBe('1999 px')
    })
  })

  describe('scroll', () => {
    it('remembers the deepest point even after scrolling back up', () => {
      const log = new BehaviorLog()
      log.scroll(0, 0.25, 0)
      log.scroll(1500, 0.8, 100)
      log.scroll(200, 0.3, 200)

      const sections = log.sections(200)
      expect(value(sections, 'スクロール位置')).toBe('200 px')
      expect(value(sections, 'ページのどこまで見たか')).toBe('80%')
    })

    it('measures speed from the movement, not from the first position', () => {
      const log = new BehaviorLog()
      log.scroll(5000, 0.9, 0) // where the page happened to be opened
      log.scroll(5030, 0.9, 100)

      expect(value(log.sections(100), 'スクロールの速さ')).toBe('100 px/秒')
    })
  })

  describe('keys', () => {
    it('measures how long keys are held and the gaps between them', () => {
      const log = new BehaviorLog()
      type(log, 'abc', 0, 80, 120)

      const sections = log.sections(1000)
      expect(value(sections, 'キーを押した回数')).toBe('3 回')
      expect(value(sections, 'キーを押している時間の平均')).toBe('80 ms')
      expect(value(sections, 'キーとキーの間隔の平均')).toBe('120 ms')
      expect(value(sections, '最近のキー')).toEqual([
        'c  押下 80ms / 間隔 120ms',
        'b  押下 80ms / 間隔 120ms',
        'a  押下 80ms / 間隔 -'
      ])
    })

    it('leaves pauses out of the rhythm', () => {
      const log = new BehaviorLog()
      const t = type(log, 'ab', 0, 80, 100)
      type(log, 'c', t + 5000, 80, 100)

      expect(value(log.sections(t + 6000), 'キーとキーの間隔の平均')).toBe('100 ms')
    })

    it('counts a held key once, however often it repeats', () => {
      const log = new BehaviorLog()
      log.keyDown('a', 'KeyA', 0, false)
      log.keyDown('a', 'KeyA', 500, true)
      log.keyDown('a', 'KeyA', 530, true)
      log.keyUp('KeyA', 600)

      const sections = log.sections(600)
      expect(value(sections, 'キーを押した回数')).toBe('1 回')
      expect(value(sections, 'キーを押している時間の平均')).toBe('600 ms')
    })

    it('handles overlapping keys, as fast typists press the next before releasing', () => {
      const log = new BehaviorLog()
      log.keyDown('t', 'KeyT', 0, false)
      log.keyDown('h', 'KeyH', 50, false)
      log.keyUp('KeyT', 90)
      log.keyUp('KeyH', 140)

      expect(log.keys.map((k) => [k.key, k.dwell])).toEqual([
        ['t', 90],
        ['h', 90]
      ])
    })

    it('starts a key over when its keyup never came, as with the C of ⌘C on macOS', () => {
      const log = new BehaviorLog()
      log.keyDown('Meta', 'MetaLeft', 0, false)
      log.keyDown('c', 'KeyC', 100, false)
      log.keyUp('MetaLeft', 200) // and no keyup for KeyC
      log.keyDown('c', 'KeyC', 60_000, false)
      log.keyUp('KeyC', 60_080)

      const sections = log.sections(60_080)
      expect(value(sections, 'キーを押した回数')).toBe('3 回')
      expect(log.keys.map((k) => [k.key, k.dwell])).toEqual([
        ['Meta', 200],
        ['c', 80]
      ])
    })

    it('ignores a keyup it never saw go down', () => {
      const log = new BehaviorLog()
      log.keyUp('KeyA', 10)

      expect(log.keys).toEqual([])
    })

    it('shows what is in the field before it is sent', () => {
      const log = new BehaviorLog()
      log.input('my secret draft')

      expect(value(log.sections(0), '入力欄の中身 (送信前)')).toBe('my secret draft')
    })
  })

  describe('clipboard', () => {
    it('shows the selection, the last copy and the last paste', () => {
      const log = new BehaviorLog()
      log.select('selected')
      log.copy('copied')
      log.paste('pasted\ntext')

      const sections = log.sections(0)
      expect(value(sections, '選択中のテキスト')).toBe('selected')
      expect(value(sections, '最後にコピーした内容')).toBe('copied')
      expect(value(sections, '最後に貼り付けた内容')).toBe('pasted text')
    })

    it('tells copying nothing apart from never copying', () => {
      const log = new BehaviorLog()
      log.copy('')

      expect(value(log.sections(0), '最後にコピーした内容')).toBe('')
    })
  })

  describe('tab', () => {
    it('counts the switches away and the time spent away', () => {
      const log = new BehaviorLog()
      log.visibility('hidden', 1000)
      log.visibility('visible', 4000)
      log.visibility('hidden', 10000)
      log.visibility('visible', 12000)

      const sections = log.sections(15000)
      expect(value(sections, '他のタブに切り替えた回数')).toBe('2 回')
      expect(value(sections, '他のタブにいた時間の合計')).toBe('5.0 秒')
      expect(value(sections, '最後の出来事')).toBe('タブに戻ってきた (3.0 秒前)')
    })

    it('counts the time away while still away', () => {
      const log = new BehaviorLog()
      log.visibility('hidden', 1000)

      expect(value(log.sections(2500), '他のタブにいた時間の合計')).toBe('1.5 秒')
    })

    it('does not double count a repeated state', () => {
      const log = new BehaviorLog()
      log.visibility('hidden', 0)
      log.visibility('hidden', 100)
      log.visibility('visible', 1000)
      log.visibility('visible', 2000)

      const sections = log.sections(2000)
      expect(value(sections, '他のタブに切り替えた回数')).toBe('1 回')
      expect(value(sections, '他のタブにいた時間の合計')).toBe('1.0 秒')
    })

    it('counts focus lost separately from tab switches', () => {
      const log = new BehaviorLog()
      log.blur(100)
      log.focus(300)
      log.blur(500)

      const sections = log.sections(500)
      expect(value(sections, 'フォーカスが外れた回数')).toBe('2 回')
      expect(value(sections, '他のタブに切り替えた回数')).toBe('0 回')
      expect(value(sections, '最後の出来事')).toBe('フォーカスが外れた (0.0 秒前)')
    })
  })
})
