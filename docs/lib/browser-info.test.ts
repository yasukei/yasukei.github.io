import { describe, it, expect } from 'vitest'
import {
  DISPLAY_FEATURES,
  clientHintsSection,
  displaySection,
  formatUtcOffset,
  localeSection,
  mediaValue,
  osFromClientHints,
  parseUserAgent,
  privacySection,
  toJson,
  userAgentSection,
  type NavigatorLike,
  type Section
} from './browser-info'

/** Real UA strings, as each browser sends them today (reduced where it applies). */
const UA = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 OPR/115.0.0.0',
  firefoxLinux: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
  firefoxWindows7: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  chromeOS:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
}

function row(section: Section, label: string) {
  const found = section.rows.find((r) => r.label === label)
  if (!found) throw new Error(`no row "${label}" in ${section.id}`)
  return found
}

describe('parseUserAgent', () => {
  it.each([
    ['chromeWindows', 'Chrome', '130.0.0.0', 'Windows', '10 / 11'],
    // Edge and Opera carry Chrome's token too, so the order of the checks matters.
    ['edgeWindows', 'Edge', '130.0.0.0', 'Windows', '10 / 11'],
    ['operaWindows', 'Opera', '115.0.0.0', 'Windows', '10 / 11'],
    ['firefoxLinux', 'Firefox', '131.0', 'Linux', null],
    ['firefoxWindows7', 'Firefox', '115.0', 'Windows', '7'],
    // The frozen 10_15_7, whatever the real macOS is.
    ['safariMac', 'Safari', '18.0', 'macOS', '10.15.7'],
    // "like Mac OS X" must not make an iPhone a Mac.
    ['safariIphone', 'Safari', '18.0', 'iOS', '18.0'],
    // Chrome on iOS also says Version/ and Safari/.
    ['chromeIphone', 'Chrome', '126.0.6478.54', 'iOS', '17.5.1'],
    // Android's UA says Linux as well.
    ['chromeAndroid', 'Chrome', '130.0.0.0', 'Android', '10'],
    ['samsungAndroid', 'Samsung Internet', '26.0', 'Android', '14'],
    ['chromeOS', 'Chrome', '130.0.0.0', 'ChromeOS', '14541.0.0']
  ] as const)('%s', (key, browser, browserVersion, os, osVersion) => {
    expect(parseUserAgent(UA[key])).toEqual({ browser, browserVersion, os, osVersion })
  })

  it('gives up cleanly on something it does not know', () => {
    expect(parseUserAgent('curl/8.5.0')).toEqual({
      browser: null,
      browserVersion: null,
      os: null,
      osVersion: null
    })
  })
})

describe('osFromClientHints', () => {
  it.each([
    ['Windows', '15.0.0', 'Windows 11'],
    ['Windows', '13.0.0', 'Windows 11'],
    ['Windows', '10.0.0', 'Windows 10'],
    ['Windows', '1.0.0', 'Windows 10'],
    ['Windows', '0.3.0', 'Windows 7 / 8 / 8.1'],
    ['macOS', '15.3.1', 'macOS 15.3.1'],
    ['Android', '14.0.0', 'Android 14.0.0'],
    // Linux sends an empty platformVersion.
    ['Linux', '', 'Linux'],
    ['', '', null]
  ])('%s %s -> %s', (platform, version, expected) => {
    expect(osFromClientHints(platform, version)).toBe(expected)
  })
})

describe('formatUtcOffset', () => {
  it.each([
    [-540, 'UTC+09:00'], // Japan
    [0, 'UTC+00:00'],
    [300, 'UTC-05:00'], // New York in winter
    [-330, 'UTC+05:30'], // India
    [-345, 'UTC+05:45'] // Nepal
  ])('%i -> %s', (minutes, expected) => {
    expect(formatUtcOffset(minutes)).toBe(expected)
  })
})

describe('userAgentSection', () => {
  it('shows the raw string and what can be read from it', () => {
    const section = userAgentSection({ userAgent: UA.edgeWindows, platform: 'Win32', vendor: 'Google Inc.' })

    expect(row(section, 'User-Agent').value).toBe(UA.edgeWindows)
    expect(row(section, 'ブラウザ (UAから推定)').value).toBe('Edge 130.0.0.0')
    expect(row(section, 'OS (UAから推定)').value).toBe('Windows 10 / 11')
    expect(row(section, 'プラットフォーム').value).toBe('Win32')
    expect(row(section, 'ベンダー').value).toBe('Google Inc.')
  })

  it('keeps the empty vendor Firefox reports apart from a missing one', () => {
    const firefox = userAgentSection({ userAgent: UA.firefoxLinux, vendor: '' })
    const none = userAgentSection({ userAgent: UA.firefoxLinux })

    expect(row(firefox, 'ベンダー').value).toBe('')
    expect(row(none, 'ベンダー').value).toBeNull()
  })
})

describe('clientHintsSection', () => {
  it('reads both the low- and the high-entropy hints', async () => {
    const asked: string[][] = []
    const nav: NavigatorLike = {
      userAgent: UA.chromeWindows,
      userAgentData: {
        brands: [
          { brand: 'Chromium', version: '130' },
          { brand: 'Not?A_Brand', version: '99' }
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async (hints) => {
          asked.push(hints)
          return {
            platformVersion: '15.0.0',
            architecture: 'x86',
            bitness: '64',
            model: '',
            fullVersionList: [{ brand: 'Chromium', version: '130.0.6723.70' }],
            formFactors: ['Desktop']
          }
        }
      }
    }

    const section = await clientHintsSection(nav)

    expect(asked[0]).toContain('platformVersion')
    expect(row(section, 'ブランド').value).toEqual(['Chromium 130', 'Not?A_Brand 99'])
    expect(row(section, 'モバイル端末か').value).toBe('false')
    expect(row(section, 'OS名').value).toBe('Windows')
    expect(row(section, 'OSバージョン').value).toBe('15.0.0')
    expect(row(section, 'OS (Client Hintsから推定)').value).toBe('Windows 11')
    expect(row(section, 'CPUアーキテクチャ').value).toBe('x86 64bit')
    expect(row(section, '端末モデル').value).toBe('')
    expect(row(section, 'ブラウザの完全なバージョン').value).toEqual(['Chromium 130.0.6723.70'])
    expect(row(section, 'フォームファクター').value).toEqual(['Desktop'])
  })

  it('shows every row as unavailable where there is no userAgentData', async () => {
    const section = await clientHintsSection({ userAgent: UA.firefoxLinux })

    expect(section.rows.length).toBeGreaterThan(0)
    expect(section.rows.map((r) => r.value)).toEqual(section.rows.map(() => null))
  })

  it('keeps the low-entropy hints when the high-entropy ones are refused', async () => {
    const section = await clientHintsSection({
      userAgent: UA.chromeWindows,
      userAgentData: {
        brands: [],
        mobile: true,
        platform: 'Android',
        getHighEntropyValues: () => Promise.reject(new DOMException('blocked', 'NotAllowedError'))
      }
    })

    expect(row(section, 'モバイル端末か').value).toBe('true')
    expect(row(section, 'OS (Client Hintsから推定)').value).toBe('Android')
    expect(row(section, 'OSバージョン').value).toBeNull()
    expect(row(section, '端末モデル').value).toBeNull()
  })
})

describe('localeSection', () => {
  it('lists the languages in the order the browser prefers them', () => {
    const section = localeSection(
      { userAgent: '', language: 'ja', languages: ['ja', 'en-US', 'en'] },
      new Date()
    )

    expect(row(section, '言語').value).toBe('ja')
    expect(row(section, '言語の優先順位').value).toEqual(['ja', 'en-US', 'en'])
  })

  it('fills in the time zone and the format samples', () => {
    const section = localeSection({ userAgent: '' }, new Date(2026, 0, 2, 3, 4, 5))

    expect(row(section, 'タイムゾーン').value).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null)
    expect(row(section, 'UTCとの時差').value).toMatch(/^UTC[+-]\d\d:\d\d$/)
    expect(row(section, '日時の書式').value).toMatch(/2026/)
    expect(row(section, '数値の書式').value).toBe((1234567.89).toLocaleString())
  })
})

describe('privacySection', () => {
  it('turns flags into text and keeps missing ones apart', () => {
    const section = privacySection({
      userAgent: '',
      cookieEnabled: true,
      doNotTrack: '1',
      webdriver: false
    })

    expect(row(section, 'Cookieが有効か').value).toBe('true')
    expect(row(section, 'Do Not Track').value).toBe('1')
    expect(row(section, '自動操作中か').value).toBe('false')
    // Not in this browser, which is different from being off.
    expect(row(section, 'Global Privacy Control').value).toBeNull()
  })
})

describe('mediaValue / displaySection', () => {
  /** A matchMedia that answers yes to exactly the given queries. */
  const matching = (...queries: string[]) => (query: string) => ({ matches: queries.includes(query) })

  it('reports the value that matches', () => {
    const scheme = DISPLAY_FEATURES.find((f) => f.feature === 'prefers-color-scheme')!

    expect(mediaValue(matching('(prefers-color-scheme: dark)'), scheme)).toBe('dark')
  })

  it('reports null when no value matches, which is how an unknown feature looks', () => {
    const data = DISPLAY_FEATURES.find((f) => f.feature === 'prefers-reduced-data')!

    expect(mediaValue(matching(), data)).toBeNull()
  })

  it('has one row per feature', () => {
    const section = displaySection(
      matching('(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)', '(forced-colors: none)')
    )

    expect(section.rows.map((r) => r.value)).toEqual([
      'dark',
      'reduce',
      null,
      'none',
      null,
      null,
      null
    ])
  })
})

describe('toJson', () => {
  it('keys the values by section and label', () => {
    const json = toJson([
      {
        id: 'a',
        title: 'A',
        rows: [
          { label: 'one', api: 'x', value: '1' },
          { label: 'list', api: 'y', value: ['p', 'q'] },
          { label: 'none', api: 'z', value: null }
        ]
      }
    ])

    expect(JSON.parse(json)).toEqual({ A: { one: '1', list: ['p', 'q'], none: null } })
  })
})
