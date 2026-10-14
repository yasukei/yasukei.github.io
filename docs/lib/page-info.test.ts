// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import {
  collectPage,
  focusSection,
  formatMs,
  loadSection,
  originSection,
  readPageEnv,
  windowSection,
  type NavigationTiming,
  type PageEnv
} from './page-info'
import type { Section } from './browser-info'

function row(section: Section, label: string) {
  const found = section.rows.find((r) => r.label === label)
  if (!found) throw new Error(`no row "${label}" in ${section.id}`)
  return found
}

const NAVIGATION: NavigationTiming = {
  type: 'reload',
  nextHopProtocol: 'h2',
  domainLookupStart: 10.2,
  domainLookupEnd: 32.7,
  connectStart: 32.7,
  connectEnd: 80.1,
  responseStart: 150.4,
  domContentLoadedEventEnd: 420.6,
  loadEventEnd: 0,
  transferSize: 0
}

const ENV: PageEnv = {
  innerWidth: 1280,
  innerHeight: 720,
  outerWidth: 1296,
  outerHeight: 840,
  screenX: -1920,
  screenY: 0,
  visibilityState: 'visible',
  hasFocus: true,
  online: true,
  referrer: 'https://www.google.com/',
  historyLength: 3,
  navigation: NAVIGATION,
  memory: { usedJSHeapSize: 10 * 1024 ** 2, jsHeapSizeLimit: 4 * 1024 ** 3 }
}

describe('formatMs', () => {
  it('rounds to whole milliseconds', () => {
    expect(formatMs(22.5)).toBe('23 ms')
    expect(formatMs(0)).toBe('0 ms')
  })
})

describe('windowSection', () => {
  it('shows the size, the frame around the page and the position', () => {
    const section = windowSection(ENV)

    expect(section.rows.slice(0, 3).map((r) => r.label)).toEqual([
      'ウィンドウ全体',
      'ページが表示されている範囲',
      'ウィンドウ全体 − ページ表示範囲 = ブラウザのUI部分'
    ])
    expect(row(section, 'ウィンドウ全体').value).toBe('1296 × 840')
    expect(row(section, 'ページが表示されている範囲').value).toBe('1280 × 720')
    // Width first, like every other size on the page.
    expect(row(section, 'ウィンドウ全体 − ページ表示範囲 = ブラウザのUI部分').value).toBe('横 16px / 縦 120px')
    // A window on a monitor to the left of the main one.
    expect(row(section, '画面上の位置').value).toBe('-1920, 0')
  })
})

describe('focusSection', () => {
  it('shows a tab in the background', () => {
    const section = focusSection({ ...ENV, visibilityState: 'hidden', hasFocus: false })

    expect(row(section, 'タブが表示されているか').value).toBe('hidden')
    expect(row(section, 'ウィンドウにフォーカスがあるか').value).toBe('false')
  })
})

describe('originSection', () => {
  it('keeps an empty referrer as empty, not as missing', () => {
    expect(row(originSection({ ...ENV, referrer: '' }), 'リファラー').value).toBe('')
    expect(row(originSection(ENV), 'このタブの履歴の件数').value).toBe('3')
  })
})

describe('loadSection', () => {
  it('turns the navigation entry into durations', () => {
    const section = loadSection(ENV)

    expect(row(section, '来かた').value).toBe('reload (リロードした)')
    expect(row(section, '通信プロトコル').value).toBe('h2')
    expect(row(section, 'DNSの名前解決').value).toBe('23 ms')
    expect(row(section, '接続 (TCP + TLS)').value).toBe('47 ms')
    expect(row(section, '最初の1バイトが届くまで').value).toBe('150 ms')
    expect(row(section, 'DOMContentLoaded まで').value).toBe('421 ms')
    expect(row(section, 'JavaScriptのメモリ使用量').value).toBe('10.0 MB / 上限 4.0 GB')
  })

  it('says when load has not happened yet', () => {
    expect(row(loadSection(ENV), 'load まで').value).toBe('まだ')
    expect(row(loadSection({ ...ENV, navigation: { ...NAVIGATION, loadEventEnd: 812 } }), 'load まで').value).toBe(
      '812 ms'
    )
  })

  it('passes an unknown navigation type through', () => {
    expect(row(loadSection({ ...ENV, navigation: { ...NAVIGATION, type: 'something-new' } }), '来かた').value).toBe(
      'something-new'
    )
  })

  it('is unavailable without a navigation entry or performance.memory', () => {
    const section = loadSection({ ...ENV, navigation: null, memory: null })

    expect(section.rows.every((r) => r.value === null)).toBe(true)
  })
})

describe('readPageEnv', () => {
  it('reads a window into plain values', () => {
    const env = readPageEnv(window)

    expect(env.innerWidth).toBe(window.innerWidth)
    expect(env.historyLength).toBe(history.length)
    expect(typeof env.hasFocus).toBe('boolean')
    expect(collectPage(env).map((s) => s.id)).toEqual(['window', 'focus', 'origin', 'load'])
  })
})
