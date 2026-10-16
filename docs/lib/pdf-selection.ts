export const MAX_PDF_BYTES = 100 * 1024 * 1024
export const MAX_PDF_PAGES = 300

export interface PdfPageRef {
  sourceId: number
  pageIndex: number
}

/** The numbers refer to the current visible order, starting at one. */
export function parsePageSelection(value: string, count: number): Set<number> {
  const selected = new Set<number>()
  if (!value.trim()) throw new Error('ページ番号を入力してください。例: 1-3, 5')
  for (const part of value.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('ページ指定は「1-3, 5」の形式で入力してください。')
    const first = Number(match[1])
    const last = Number(match[2] ?? match[1])
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > count) {
      throw new Error(`ページ番号は1〜${count}の範囲で指定してください。`)
    }
    for (let number = first; number <= last; number++) selected.add(number - 1)
  }
  return selected
}
