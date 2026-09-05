import { describe, it, expect } from 'vitest'
import { toHiragana, toKatakana } from './kana'

/** Every character in an inclusive code point range, as one string. */
function range(from: number, to: number): string {
  let out = ''
  for (let code = from; code <= to; code++) out += String.fromCharCode(code)
  return out
}

const ALL_HIRAGANA = range(0x3041, 0x3096) // ぁ..ゖ
const ALL_KATAKANA = range(0x30a1, 0x30f6) // ァ..ヶ

describe('toKatakana', () => {
  it('converts the whole hiragana block', () => {
    expect(toKatakana(ALL_HIRAGANA)).toBe(ALL_KATAKANA)
  })

  it('converts the iteration marks', () => {
    expect(toKatakana('ゝゞ')).toBe('ヽヾ')
  })

  it('leaves katakana as it is', () => {
    expect(toKatakana(ALL_KATAKANA)).toBe(ALL_KATAKANA)
  })

  it('converts only the kana in mixed text', () => {
    expect(toKatakana('東京とうきょう Tokyo 123')).toBe('東京トウキョウ Tokyo 123')
  })
})

describe('toHiragana', () => {
  it('converts the whole katakana block', () => {
    expect(toHiragana(ALL_KATAKANA)).toBe(ALL_HIRAGANA)
  })

  it('converts the iteration marks', () => {
    expect(toHiragana('ヽヾ')).toBe('ゝゞ')
  })

  it('leaves hiragana as it is', () => {
    expect(toHiragana(ALL_HIRAGANA)).toBe(ALL_HIRAGANA)
  })

  it('converts only the kana in mixed text', () => {
    expect(toHiragana('東京トウキョウ Tokyo 123')).toBe('東京とうきょう Tokyo 123')
  })
})

describe('round trips', () => {
  it('preserves every hiragana code point', () => {
    expect(toHiragana(toKatakana(ALL_HIRAGANA))).toBe(ALL_HIRAGANA)
  })

  it('preserves every katakana code point', () => {
    expect(toKatakana(toHiragana(ALL_KATAKANA))).toBe(ALL_KATAKANA)
  })

  it('preserves the iteration marks', () => {
    expect(toHiragana(toKatakana('ゝゞ'))).toBe('ゝゞ')
  })
})

describe('characters that must not change', () => {
  it.each([
    ['empty input', ''],
    ['kanji', '東京都'],
    ['latin and digits', 'Tokyo 2024'],
    ['japanese punctuation', '、。「」・〜'],
    ['the prolonged sound mark', 'ー'],
    ['the standalone dakuten marks', '゛゜']
  ])('%s', (_label, text) => {
    expect(toKatakana(text)).toBe(text)
    expect(toHiragana(text)).toBe(text)
  })

  it('keeps katakana that has no hiragana counterpart', () => {
    // ヷヸヹヺ sit just past ヶ and have nothing to map onto.
    expect(toHiragana('ヷヸヹヺ')).toBe('ヷヸヹヺ')
  })

  it('leaves halfwidth katakana alone', () => {
    // Documented limitation: recombining ｶﾞ into ガ needs a lookup table.
    expect(toHiragana('ｱｲｳ ｶﾞ')).toBe('ｱｲｳ ｶﾞ')
    expect(toKatakana('ｱｲｳ ｶﾞ')).toBe('ｱｲｳ ｶﾞ')
  })
})

describe('specific pairs worth pinning', () => {
  it.each([
    ['ゔ', 'ヴ'],
    ['ゕ', 'ヵ'],
    ['ゖ', 'ヶ'],
    ['っ', 'ッ'],
    ['ゃゅょ', 'ャュョ'],
    ['ぁぃぅぇぉ', 'ァィゥェォ'],
    ['ぱぴぷぺぽ', 'パピプペポ']
  ])('%s <-> %s', (hiragana, katakana) => {
    expect(toKatakana(hiragana)).toBe(katakana)
    expect(toHiragana(katakana)).toBe(hiragana)
  })

  it('handles a long vowel written with the prolonged sound mark', () => {
    expect(toKatakana('らーめん')).toBe('ラーメン')
    expect(toHiragana('ラーメン')).toBe('らーめん')
  })
})

describe('idempotence', () => {
  const mixed = 'ひらがなカタカナ漢字 abc ゝヽ ー'

  it('converting to katakana twice changes nothing further', () => {
    expect(toKatakana(toKatakana(mixed))).toBe(toKatakana(mixed))
  })

  it('converting to hiragana twice changes nothing further', () => {
    expect(toHiragana(toHiragana(mixed))).toBe(toHiragana(mixed))
  })
})
