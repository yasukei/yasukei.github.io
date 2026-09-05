/**
 * Hiragana <-> katakana conversion.
 *
 * The two scripts sit at a fixed +0x60 offset from each other in Unicode:
 * hiragana occupies U+3041-U+3096 and katakana U+30A1-U+30F6, in the same
 * order. The iteration marks ゝゞ / ヽヾ (U+309D-U+309E, U+30FD-U+30FE) follow
 * the same offset. Nothing else is touched, so kanji, latin letters, digits,
 * punctuation and the prolonged sound mark ー pass through unchanged.
 *
 * Two katakana characters are deliberately left alone in both directions:
 * ヷヸヹヺ (U+30F7-U+30FA) have no hiragana counterpart, and halfwidth katakana
 * (U+FF66-U+FF9D) would need a lookup table to recombine dakuten, so they are
 * out of scope.
 */

const HIRAGANA_RE = /[ぁ-ゖゝゞ]/g
const KATAKANA_RE = /[ァ-ヶヽヾ]/g

const OFFSET = 0x60

export function toKatakana(text: string): string {
  return text.replace(HIRAGANA_RE, (ch) => String.fromCharCode(ch.charCodeAt(0) + OFFSET))
}

export function toHiragana(text: string): string {
  return text.replace(KATAKANA_RE, (ch) => String.fromCharCode(ch.charCodeAt(0) - OFFSET))
}
