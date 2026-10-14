/**
 * What a page can tell about what is installed on the machine: fonts, speech
 * synthesis voices, and how much storage it may use.
 *
 * As with hardware-info.ts, the values that need a real browser (measuring
 * text, waiting for voices) are gathered by install-probes.ts and come in as
 * plain data, so everything here runs in Node.
 */

import { bool, type Section } from './browser-info'
import { fnv1a } from './hardware-info'

export interface FontCandidate {
  name: string
  /** Where the font normally comes from, i.e. what finding it suggests. */
  source: string
}

/**
 * Fonts worth looking for: each one says something about the OS, its
 * language, or what software is installed. Web fonts the site itself loads
 * (VitePress loads Inter) are left out, since the page would find its own.
 */
export const FONT_CANDIDATES: FontCandidate[] = [
  ...[
    'Arial',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Georgia',
    'Trebuchet MS',
    'Tahoma',
    'Impact',
    'Comic Sans MS'
  ].map((name) => ({ name, source: 'Windows / macOS 共通' })),
  ...[
    'Segoe UI',
    'Calibri',
    'Cambria',
    'Consolas',
    'Candara',
    'Constantia',
    'Corbel',
    'Ebrima',
    'Gabriola',
    'Leelawadee UI',
    'Nirmala UI',
    'Sitka Text',
    'Bahnschrift'
  ].map((name) => ({ name, source: 'Windows' })),
  ...['Segoe UI Variable Text', 'Segoe Fluent Icons'].map((name) => ({ name, source: 'Windows 11' })),
  ...['Meiryo', 'MS Gothic', 'MS Mincho', 'Yu Gothic', 'Yu Mincho', 'BIZ UDGothic', 'UD Digi Kyokasho N-R'].map(
    (name) => ({ name, source: 'Windows (日本語)' })
  ),
  ...[
    'Helvetica Neue',
    'Menlo',
    'Monaco',
    'Avenir',
    'Avenir Next',
    'Futura',
    'Gill Sans',
    'Optima',
    'Geneva',
    'Lucida Grande',
    'Apple Color Emoji'
  ].map((name) => ({ name, source: 'macOS' })),
  ...['Hiragino Sans', 'Hiragino Mincho ProN', 'Hiragino Maru Gothic ProN', 'Osaka', 'Toppan Bunkyu Gothic'].map(
    (name) => ({ name, source: 'macOS (日本語)' })
  ),
  ...[
    'DejaVu Sans',
    'Liberation Sans',
    'Ubuntu',
    'Cantarell',
    'Noto Sans',
    'Noto Color Emoji',
    'Droid Sans'
  ].map((name) => ({ name, source: 'Linux' })),
  ...['Noto Sans CJK JP', 'IPAGothic', 'IPAexGothic', 'TakaoGothic', 'VL Gothic'].map((name) => ({
    name,
    source: 'Linux (日本語)'
  })),
  { name: 'Roboto', source: 'Android / ChromeOS' },
  ...['Aptos', 'Century Gothic', 'Garamond', 'Book Antiqua', 'Bookman Old Style', 'Monotype Corsiva'].map(
    (name) => ({ name, source: 'Microsoft Office' })
  ),
  ...['Kozuka Gothic Pr6N', 'Kozuka Mincho Pr6N', 'Minion Pro', 'Myriad Pro', 'Adobe Garamond Pro'].map((name) => ({
    name,
    source: 'Adobe'
  })),
  ...['Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Source Code Pro', 'Hack'].map((name) => ({
    name,
    source: '開発者向け'
  }))
]

/** Generic families a candidate falls back to when it is missing. */
export const FONT_BASES = ['monospace', 'sans-serif', 'serif']

/**
 * Text drawn in `"Candidate", monospace` falls back to plain monospace when
 * the candidate is missing, so the two measure the same. If they measure
 * differently for any of the bases, the candidate is installed. Three bases,
 * because a candidate might happen to match one of them exactly.
 *
 * `measure` takes a CSS font-family list and returns anything comparable,
 * e.g. the width and height of a fixed text drawn in it.
 */
export function detectFonts(candidates: FontCandidate[], measure: (family: string) => string): FontCandidate[] {
  const fallback = FONT_BASES.map((base) => measure(base))
  return candidates.filter((candidate) =>
    FONT_BASES.some((base, i) => measure(`"${candidate.name}", ${base}`) !== fallback[i])
  )
}

/** Each source once, in the order the fonts were listed. */
export function fontSources(found: FontCandidate[]): string[] {
  return [...new Set(found.map((font) => font.source))]
}

export interface VoiceInfo {
  name: string
  lang: string
  localService: boolean
  default: boolean
}

export interface StorageInfo {
  quota: number | null
  usage: number | null
  persisted: boolean | null
}

/** null means the probe found nothing: the API is missing, refused, or timed out. */
export interface InstallProbes {
  fonts: FontCandidate[] | null
  voices: VoiceInfo[] | null
  storage: StorageInfo | null
}

/** Binary units, as the OS shows disk sizes. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`
}

export function fontsSection(found: FontCandidate[] | null): Section {
  return {
    id: 'fonts',
    title: 'フォント',
    rows: [
      {
        label: 'インストールされているフォント',
        api: "ctx.measureText() で '\"候補\", monospace' と 'monospace' の幅を比べる",
        value: found ? found.map((font) => font.name) : null,
        note: '一覧を読むAPIは許可が必要だが、候補のフォントで文字を描いて幅が変わるかを見れば、入っているかどうかは推測できる。Safari は OS 標準以外のフォントを Web から見えないようにしている。Linux では Arial や MS Gothic を頼むと互換フォントに置き換えられるため、入っていなくても「ある」と出ることがある。'
      },
      {
        label: '見つかった数',
        api: '',
        value: found ? `${found.length} / ${FONT_CANDIDATES.length}` : null
      },
      {
        label: 'フォントから分かること',
        api: '',
        value: found ? fontSources(found) : null,
        note: 'OSとその言語、Office や Adobe のソフトを入れているか、プログラマーかどうかまで見当がつく。'
      },
      {
        label: 'フォントの組み合わせのハッシュ',
        api: '',
        value: found ? fnv1a(found.map((font) => font.name).join(',')) : null
      }
    ]
  }
}

export function voicesSection(voices: VoiceInfo[] | null): Section {
  const local = voices?.filter((voice) => voice.localService).length ?? 0
  const langs = voices ? [...new Set(voices.map((voice) => voice.lang))].sort() : null
  const fallback = voices?.find((voice) => voice.default)
  return {
    id: 'voices',
    title: '音声読み上げ',
    rows: [
      {
        label: '音声の数',
        api: 'speechSynthesis.getVoices().length',
        value: voices ? `${voices.length} (端末内 ${local} / オンライン ${voices.length - local})` : null,
        note: 'OSと、追加でインストールした言語パックで変わる。Chrome はオンラインの Google の音声も足す。'
      },
      {
        label: 'デフォルトの音声',
        api: 'getVoices().find(v => v.default)',
        value: voices ? (fallback ? `${fallback.name} (${fallback.lang})` : '') : null
      },
      {
        label: '対応している言語',
        api: 'getVoices().map(v => v.lang)',
        value: langs && langs.join(', ')
      },
      {
        label: '音声の名前',
        api: 'getVoices().map(v => v.name)',
        value: voices && voices.map((voice) => voice.name).join(', '),
        note: 'Windows なら "Microsoft Haruka" や "Microsoft Ayumi"、Mac なら "Kyoko" のように OS ごとに名前が違う。'
      },
      {
        label: '音声の一覧のハッシュ',
        api: '',
        value: voices ? fnv1a(voices.map((voice) => `${voice.name}|${voice.lang}`).join(',')) : null
      }
    ]
  }
}

export function storageSection(storage: StorageInfo | null): Section {
  const bytes = (n: number | null | undefined) => (typeof n === 'number' ? formatBytes(n) : null)
  return {
    id: 'storage',
    title: 'ストレージ',
    rows: [
      {
        label: 'このサイトが保存できる上限',
        api: '(await navigator.storage.estimate()).quota',
        value: bytes(storage?.quota),
        note: 'Chrome系ではディスク全体の大きさに比例する(おおよそ6割)ので、ディスク容量の見当がつく。シークレットモードでは極端に小さくなるため、それでシークレットモードを見破るサイトもあった。'
      },
      {
        label: 'このサイトの使用量',
        api: '(await navigator.storage.estimate()).usage',
        value: bytes(storage?.usage)
      },
      {
        label: '消されにくい設定か',
        api: 'await navigator.storage.persisted()',
        value: bool(storage?.persisted),
        note: 'true なら、ディスクが足りなくなってもブラウザがこのサイトのデータを自動で消さない。'
      }
    ]
  }
}

/** Every section of the installed-software category, in the order shown. */
export function collectInstall(probes: InstallProbes): Section[] {
  return [fontsSection(probes.fonts), voicesSection(probes.voices), storageSection(probes.storage)]
}
