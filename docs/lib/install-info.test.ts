import { describe, it, expect } from 'vitest'
import {
  FONT_BASES,
  FONT_CANDIDATES,
  collectInstall,
  detectFonts,
  fontSources,
  fontsSection,
  formatBytes,
  storageSection,
  voicesSection,
  type FontCandidate,
  type VoiceInfo
} from './install-info'
import type { Section } from './browser-info'

function row(section: Section, label: string) {
  const found = section.rows.find((r) => r.label === label)
  if (!found) throw new Error(`no row "${label}" in ${section.id}`)
  return found
}

/**
 * A pretend machine: a font measures as itself when installed, and falls back
 * to the base family after the comma when it is not, like a browser does.
 */
function machineWith(...installed: string[]) {
  return (family: string) => {
    const quoted = family.match(/^"([^"]+)", (.+)$/)
    if (!quoted) return `width of ${family}`
    return installed.includes(quoted[1]) ? `width of ${quoted[1]}` : `width of ${quoted[2]}`
  }
}

describe('detectFonts', () => {
  const candidates: FontCandidate[] = [
    { name: 'Meiryo', source: 'Windows (日本語)' },
    { name: 'Menlo', source: 'macOS' },
    { name: 'Consolas', source: 'Windows' }
  ]

  it('finds the installed fonts and only those', () => {
    expect(detectFonts(candidates, machineWith('Meiryo', 'Consolas')).map((f) => f.name)).toEqual([
      'Meiryo',
      'Consolas'
    ])
  })

  it('finds nothing on a machine with none of them', () => {
    expect(detectFonts(candidates, machineWith())).toEqual([])
  })

  it('still finds a font that happens to measure like one of the bases', () => {
    // Menlo measures exactly like the monospace fallback, but not like the others.
    const measure = (family: string) => {
      if (family === '"Menlo", monospace') return 'width of monospace'
      return machineWith('Menlo')(family)
    }

    expect(detectFonts(candidates, measure).map((f) => f.name)).toEqual(['Menlo'])
  })

  it('tries each candidate against every base', () => {
    const asked: string[] = []
    detectFonts([candidates[0]], (family) => {
      asked.push(family)
      return 'same'
    })

    expect(asked).toEqual([...FONT_BASES, ...FONT_BASES.map((base) => `"Meiryo", ${base}`)])
  })
})

describe('FONT_CANDIDATES', () => {
  it('lists each font once', () => {
    const names = FONT_CANDIDATES.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('leaves out the web font this site loads itself', () => {
    expect(FONT_CANDIDATES.map((f) => f.name)).not.toContain('Inter')
  })
})

describe('fontSources', () => {
  it('lists each source once, in order', () => {
    expect(
      fontSources([
        { name: 'Meiryo', source: 'Windows (日本語)' },
        { name: 'Consolas', source: 'Windows' },
        { name: 'Yu Gothic', source: 'Windows (日本語)' }
      ])
    ).toEqual(['Windows (日本語)', 'Windows'])
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [300 * 1024 ** 3, '300.0 GB'],
    [2 * 1024 ** 4, '2.0 TB']
  ])('%d -> %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('fontsSection', () => {
  it('lists the fonts and what they suggest', () => {
    const section = fontsSection([
      { name: 'Meiryo', source: 'Windows (日本語)' },
      { name: 'JetBrains Mono', source: '開発者向け' }
    ])

    expect(row(section, 'インストールされているフォント').value).toEqual(['Meiryo', 'JetBrains Mono'])
    expect(row(section, '見つかった数').value).toBe(`2 / ${FONT_CANDIDATES.length}`)
    expect(row(section, 'フォントから分かること').value).toEqual(['Windows (日本語)', '開発者向け'])
    expect(row(section, 'フォントの組み合わせのハッシュ').value).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('voicesSection', () => {
  const voices: VoiceInfo[] = [
    { name: 'Microsoft Haruka - Japanese (Japan)', lang: 'ja-JP', localService: true, default: true },
    { name: 'Google 日本語', lang: 'ja-JP', localService: false, default: false },
    { name: 'Google US English', lang: 'en-US', localService: false, default: false }
  ]

  it('counts local and online voices and lists the languages once', () => {
    const section = voicesSection(voices)

    expect(row(section, '音声の数').value).toBe('3 (端末内 1 / オンライン 2)')
    expect(row(section, 'デフォルトの音声').value).toBe('Microsoft Haruka - Japanese (Japan) (ja-JP)')
    expect(row(section, '対応している言語').value).toBe('en-US, ja-JP')
    expect(row(section, '音声の名前').value).toBe(voices.map((v) => v.name).join(', '))
  })

  it('tells "no voices" apart from "no speech synthesis"', () => {
    expect(row(voicesSection([]), '音声の数').value).toBe('0 (端末内 0 / オンライン 0)')
    expect(row(voicesSection(null), '音声の数').value).toBeNull()
  })
})

describe('storageSection', () => {
  it('shows the estimate in readable units', () => {
    const section = storageSection({ quota: 300 * 1024 ** 3, usage: 1536, persisted: false })

    expect(row(section, 'このサイトが保存できる上限').value).toBe('300.0 GB')
    expect(row(section, 'このサイトの使用量').value).toBe('1.5 KB')
    expect(row(section, '消されにくい設定か').value).toBe('false')
  })
})

describe('collectInstall', () => {
  it('builds every section, even when no probe found anything', () => {
    expect(collectInstall({ fonts: null, voices: null, storage: null }).map((s) => s.id)).toEqual([
      'fonts',
      'voices',
      'storage'
    ])
  })
})
