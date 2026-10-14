/**
 * What a page can read about the browser and the OS with nothing but
 * JavaScript, without asking the user for any permission.
 *
 * Everything is gathered into sections of rows. Each row carries the
 * expression a page would evaluate (`api`), so the reader can paste it into
 * the console of any site and see the same thing, and a short note on why the
 * value is interesting.
 *
 * The collectors take the browser objects as arguments rather than reaching
 * for globals, so the tests can hand them a fake navigator. `Intl` is the one
 * global used directly: it is the same in Node and in a browser.
 */

/** null means the browser does not offer this API at all. */
export type Value = string | string[] | null

export interface Row {
  label: string
  /** The expression that reads the value, as you would type it in the console. */
  api: string
  value: Value
  note?: string
}

export interface Section {
  id: string
  title: string
  rows: Row[]
}

/** navigator.userAgentData, which TypeScript's DOM types do not include yet. */
export interface UADataLike {
  brands?: readonly { brand: string; version: string }[]
  mobile?: boolean
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>
}

/** The part of `navigator` read here. The real `navigator` is assignable to it. */
export interface NavigatorLike {
  userAgent: string
  platform?: string
  vendor?: string
  language?: string
  languages?: readonly string[]
  cookieEnabled?: boolean
  doNotTrack?: string | null
  globalPrivacyControl?: boolean
  pdfViewerEnabled?: boolean
  webdriver?: boolean
  userAgentData?: UADataLike
}

export type MatchMedia = (query: string) => { matches: boolean }

// ---------------------------------------------------------------------------
// User-Agent string
// ---------------------------------------------------------------------------

export interface ParsedUserAgent {
  browser: string | null
  browserVersion: string | null
  os: string | null
  osVersion: string | null
}

/**
 * Checked in order, first match wins. Most browsers append their own token to
 * Chrome's UA, so they have to come before Chrome; Safari's `Version/` token is
 * also present in Chrome on iOS, which is why Safari is last.
 */
const BROWSERS: [name: string, pattern: RegExp][] = [
  ['Edge', /Edg(?:e|A|iOS)?\/([\d.]+)/],
  ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
  ['Samsung Internet', /SamsungBrowser\/([\d.]+)/],
  ['Vivaldi', /Vivaldi\/([\d.]+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/],
  ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
  ['Safari', /Version\/([\d.]+).*Safari\//]
]

/** `Windows NT x.y` is the kernel version; 10 and 11 share 10.0. */
const WINDOWS_NT: Record<string, string> = {
  '10.0': '10 / 11',
  '6.3': '8.1',
  '6.2': '8',
  '6.1': '7'
}

/** iOS before macOS: an iPhone UA says "like Mac OS X". Android before Linux. */
const OSES: [name: string, pattern: RegExp, version: (match: string) => string][] = [
  ['Windows', /Windows NT (\d+\.\d+)/, (nt) => WINDOWS_NT[nt] ?? `NT ${nt}`],
  ['iOS', /(?:iPhone|iPad|iPod).*? OS (\d+(?:_\d+)*)/, (v) => v.replace(/_/g, '.')],
  ['Android', /Android (\d+(?:\.\d+)*)/, (v) => v],
  ['ChromeOS', /CrOS \S+ ([\d.]+)/, (v) => v],
  ['macOS', /Mac OS X (\d+(?:[_.]\d+)*)/, (v) => v.replace(/_/g, '.')],
  ['Linux', /Linux/, () => '']
]

export function parseUserAgent(ua: string): ParsedUserAgent {
  const browser = BROWSERS.find(([, pattern]) => pattern.test(ua))
  const os = OSES.find(([, pattern]) => pattern.test(ua))

  return {
    browser: browser?.[0] ?? null,
    browserVersion: browser ? (ua.match(browser[1])?.[1] ?? null) : null,
    os: os?.[0] ?? null,
    osVersion: os ? os[2](ua.match(os[1])?.[1] ?? '') || null : null
  }
}

function joinName(name: string | null, version: string | null): string | null {
  if (name === null) return null
  return version ? `${name} ${version}` : name
}

export function userAgentSection(nav: NavigatorLike): Section {
  const parsed = parseUserAgent(nav.userAgent)
  return {
    id: 'user-agent',
    title: 'User-Agent',
    rows: [
      {
        label: 'User-Agent',
        api: 'navigator.userAgent',
        value: nav.userAgent,
        note: 'ページを開くたびにHTTPヘッダーでサーバーにも送られている文字列。最近のブラウザは情報を減らす方向(UA Reduction)で、OSのバージョンなどは固定値になっていることが多い。'
      },
      {
        label: 'ブラウザ (UAから推定)',
        api: 'navigator.userAgent を解析',
        value: joinName(parsed.browser, parsed.browserVersion),
        note: 'Brave などは自分を名乗らないので Chrome と区別できない。'
      },
      {
        label: 'OS (UAから推定)',
        api: 'navigator.userAgent を解析',
        value: joinName(parsed.os, parsed.osVersion),
        note: 'Windows 10 と 11 はどちらも "Windows NT 10.0"、macOS は何年も "10_15_7" に固定、Android の Chrome は "Android 10; K" に固定。UA だけでは本当のバージョンは分からない。'
      },
      {
        label: 'プラットフォーム',
        api: 'navigator.platform',
        value: str(nav.platform),
        note: '非推奨だが今も全ブラウザで読める。Win32 / MacIntel / Linux x86_64 / iPhone など。'
      },
      {
        label: 'ベンダー',
        api: 'navigator.vendor',
        value: str(nav.vendor),
        note: 'Chrome系は "Google Inc."、Safari は "Apple Computer, Inc."、Firefox は空文字。UA を偽装していてもここで食い違うことがある。'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// User-Agent Client Hints (Chromium only)
// ---------------------------------------------------------------------------

/** The high-entropy hints asked for, in the order they are shown. */
const HIGH_ENTROPY_HINTS = [
  'platformVersion',
  'architecture',
  'bitness',
  'model',
  'fullVersionList',
  'formFactors'
] as const

/**
 * The real OS version, which the UA string no longer tells.
 *
 * On Windows `platformVersion` is not the Windows version but the UniversalApiContract
 * version: 13 and above is Windows 11, 1-10 is Windows 10, and 0 is anything older.
 * Elsewhere it is the OS version as it is (macOS 15.3.1, Android 14).
 */
export function osFromClientHints(platform: string, platformVersion: string): string | null {
  if (!platform) return null
  if (!platformVersion) return platform
  if (platform === 'Windows') {
    const major = Number.parseInt(platformVersion, 10)
    if (Number.isNaN(major)) return platform
    if (major >= 13) return 'Windows 11'
    if (major > 0) return 'Windows 10'
    return 'Windows 7 / 8 / 8.1'
  }
  return `${platform} ${platformVersion}`
}

function brandList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value.map((b: { brand: string; version: string }) => `${b.brand} ${b.version}`)
}

export async function clientHintsSection(nav: NavigatorLike): Promise<Section> {
  const ua = nav.userAgentData
  let high: Record<string, unknown> = {}
  if (ua?.getHighEntropyValues) {
    try {
      high = await ua.getHighEntropyValues([...HIGH_ENTROPY_HINTS])
    } catch {
      // A Permissions-Policy can forbid high-entropy hints; the rows just show
      // as unavailable.
    }
  }

  const platform = str(ua?.platform)
  const platformVersion = str(high.platformVersion)

  return {
    id: 'client-hints',
    title: 'User-Agent Client Hints (Chrome系のみ)',
    rows: [
      {
        label: 'ブランド',
        api: 'navigator.userAgentData.brands',
        value: brandList(ua?.brands),
        note: 'UA文字列の後継。"Not A(Brand" のような偽のブランドがわざと混ぜてあるのは、特定の文字列だけを前提にしたサイトの作りを防ぐため(GREASE)。Firefox / Safari には無い。'
      },
      {
        label: 'モバイル端末か',
        api: 'navigator.userAgentData.mobile',
        value: bool(ua?.mobile)
      },
      {
        label: 'OS名',
        api: 'navigator.userAgentData.platform',
        value: platform
      },
      {
        label: 'OSバージョン',
        api: "getHighEntropyValues(['platformVersion'])",
        value: platformVersion,
        note: '詳しい値(high entropy)は Promise で返ってくるが、許可ダイアログは出ない。'
      },
      {
        label: 'OS (Client Hintsから推定)',
        api: 'platform + platformVersion',
        value: platform === null ? null : osFromClientHints(platform, platformVersion ?? ''),
        note: 'UAでは区別できない Windows 10 と 11 もここで分かる(platformVersion 13以上なら11)。'
      },
      {
        label: 'CPUアーキテクチャ',
        api: "getHighEntropyValues(['architecture', 'bitness'])",
        value: joinName(str(high.architecture), high.bitness ? `${high.bitness}bit` : null),
        note: 'UA文字列では Apple Silicon の Mac も "Intel Mac OS X" と名乗るが、ここでは "arm" と分かる。'
      },
      {
        label: '端末モデル',
        api: "getHighEntropyValues(['model'])",
        value: str(high.model),
        note: 'Android では "Pixel 8" のような機種名が入る。PC では空。'
      },
      {
        label: 'ブラウザの完全なバージョン',
        api: "getHighEntropyValues(['fullVersionList'])",
        value: brandList(high.fullVersionList)
      },
      {
        label: 'フォームファクター',
        api: "getHighEntropyValues(['formFactors'])",
        value: Array.isArray(high.formFactors) ? (high.formFactors as string[]) : null,
        note: 'Desktop / Mobile / Tablet / XR など。比較的新しいヒント。'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Language, time zone and formats
// ---------------------------------------------------------------------------

/**
 * `getTimezoneOffset` counts minutes *behind* UTC, so Japan is -540. This
 * flips it into the usual "UTC+09:00".
 */
export function formatUtcOffset(minutesBehindUtc: number): string {
  const ahead = -minutesBehindUtc
  const sign = ahead < 0 ? '-' : '+'
  const abs = Math.abs(ahead)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

export function localeSection(nav: NavigatorLike, now: Date): Section {
  const resolved = Intl.DateTimeFormat().resolvedOptions()
  const hourCycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle

  return {
    id: 'locale',
    title: '言語・タイムゾーン・書式',
    rows: [
      {
        label: '言語',
        api: 'navigator.language',
        value: str(nav.language)
      },
      {
        label: '言語の優先順位',
        api: 'navigator.languages',
        value: nav.languages ? [...nav.languages] : null,
        note: 'ブラウザ設定の並び順そのまま。珍しい組み合わせほど個人を絞り込む手がかりになる。'
      },
      {
        label: 'タイムゾーン',
        api: 'Intl.DateTimeFormat().resolvedOptions().timeZone',
        value: resolved.timeZone ?? null,
        note: 'IPアドレスの国と食い違っていると、VPN利用の手がかりとして使われることがある。'
      },
      {
        label: 'UTCとの時差',
        api: 'new Date().getTimezoneOffset()',
        value: formatUtcOffset(now.getTimezoneOffset())
      },
      {
        label: '書式のロケール',
        api: 'Intl.DateTimeFormat().resolvedOptions().locale',
        value: resolved.locale
      },
      {
        label: '暦・数字の体系',
        api: 'resolvedOptions().calendar / numberingSystem',
        value: `${resolved.calendar} / ${resolved.numberingSystem}`
      },
      {
        label: '時刻の表記',
        api: "new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle",
        value: hourCycle ?? null,
        note: 'h23 は24時間制、h12 は12時間制(午前/午後)。'
      },
      {
        label: '日時の書式',
        api: "new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(new Date())",
        value: new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(now)
      },
      {
        label: '数値の書式',
        api: '(1234567.89).toLocaleString()',
        value: (1234567.89).toLocaleString(),
        note: '小数点と桁区切りがカンマかピリオドかは地域で変わる(ドイツなら 1.234.567,89)。'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Cookies and privacy signals
// ---------------------------------------------------------------------------

export function privacySection(nav: NavigatorLike): Section {
  return {
    id: 'privacy',
    title: 'Cookie・プライバシー設定',
    rows: [
      {
        label: 'Cookieが有効か',
        api: 'navigator.cookieEnabled',
        value: bool(nav.cookieEnabled)
      },
      {
        label: 'Do Not Track',
        api: 'navigator.doNotTrack',
        value: str(nav.doNotTrack),
        note: '"1" なら追跡拒否を設定済み。法的拘束力がなく形骸化していて、Safari は削除済み、Firefox も設定項目を外した。皮肉にも、オンにしている少数派であること自体が識別の材料になる。'
      },
      {
        label: 'Global Privacy Control',
        api: 'navigator.globalPrivacyControl',
        value: bool(nav.globalPrivacyControl),
        note: 'DNTの後継。カリフォルニア州などでは法的に尊重が求められる。Firefox / Brave などが対応。'
      },
      {
        label: 'PDFをブラウザで表示するか',
        api: 'navigator.pdfViewerEnabled',
        value: bool(nav.pdfViewerEnabled)
      },
      {
        label: '自動操作中か',
        api: 'navigator.webdriver',
        value: bool(nav.webdriver),
        note: 'Selenium や Playwright で動かしていると true。ボット検知の最初のチェック項目。'
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Display and accessibility preferences (CSS media features)
// ---------------------------------------------------------------------------

export interface MediaFeature {
  label: string
  feature: string
  /** Every value the spec defines; the first that matches is the answer. */
  values: string[]
  note?: string
}

export const DISPLAY_FEATURES: MediaFeature[] = [
  {
    label: 'ダークモード',
    feature: 'prefers-color-scheme',
    values: ['light', 'dark'],
    note: 'OSの設定を変えると、このページの値もリロードなしで変わる。ページは設定の変更を監視できる。'
  },
  {
    label: 'アニメーションを減らす',
    feature: 'prefers-reduced-motion',
    values: ['no-preference', 'reduce']
  },
  {
    label: 'コントラスト',
    feature: 'prefers-contrast',
    values: ['no-preference', 'more', 'less', 'custom']
  },
  {
    label: '強制カラー (ハイコントラスト)',
    feature: 'forced-colors',
    values: ['none', 'active'],
    note: 'Windows のハイコントラストテーマなど。'
  },
  {
    label: '透明度を下げる',
    feature: 'prefers-reduced-transparency',
    values: ['no-preference', 'reduce']
  },
  {
    label: '色の反転',
    feature: 'inverted-colors',
    values: ['none', 'inverted'],
    note: '主に Safari が対応。'
  },
  {
    label: 'データ通信量を減らす',
    feature: 'prefers-reduced-data',
    values: ['no-preference', 'reduce'],
    note: 'ほとんどのブラウザが未対応。'
  }
]

export function mediaQueryOf(feature: string, value: string): string {
  return `(${feature}: ${value})`
}

/** The value that matches, or null when none does, i.e. the browser does not know the feature. */
export function mediaValue(matchMedia: MatchMedia, feature: MediaFeature): string | null {
  return feature.values.find((value) => matchMedia(mediaQueryOf(feature.feature, value)).matches) ?? null
}

export function displaySection(matchMedia: MatchMedia): Section {
  return {
    id: 'display',
    title: '表示・アクセシビリティ設定',
    rows: DISPLAY_FEATURES.map((feature) => ({
      label: feature.label,
      api: `matchMedia('${mediaQueryOf(feature.feature, '…')}')`,
      value: mediaValue(matchMedia, feature),
      note: feature.note
    }))
  }
}

// ---------------------------------------------------------------------------

/** Everything shown, as plain JSON keyed by section and label, for copying out. */
export function toJson(sections: Section[]): string {
  const out: Record<string, Record<string, Value>> = {}
  for (const section of sections) {
    out[section.title] = Object.fromEntries(section.rows.map((row) => [row.label, row.value]))
  }
  return JSON.stringify(out, null, 2)
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function bool(value: unknown): string | null {
  return typeof value === 'boolean' ? String(value) : null
}
