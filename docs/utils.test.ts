import { describe, it, expect } from 'vitest'
import { transformPages, groupByCategory, buildCategoryTree, type PageData } from './utils'

/**
 * These functions back the /notes and /tools index pages (via CategoryList)
 * for every page on the site, so a regression here is site-wide and silent:
 * pages keep building, they just stop being listed or get the wrong title.
 */

/** Shapes a createContentLoader entry the way VitePress hands it over. */
function page(url: string, src = '', frontmatter: Record<string, unknown> = {}) {
  return { url, src, frontmatter }
}

describe('transformPages', () => {
  it('drops the section index itself, in both url spellings', () => {
    const pages = transformPages(
      [page('/tools/', '# Tools'), page('/tools/index.html', '# Tools'), page('/tools/kept.html', '# Kept')],
      'tools'
    )

    expect(pages.map((p) => p.url)).toEqual(['/tools/kept.html'])
  })

  it('keeps nested index pages, which stand for their category', () => {
    const pages = transformPages([page('/notes/agents/index.html', '# Agents')], 'notes')

    expect(pages).toHaveLength(1)
    expect(pages[0].categoryPath).toEqual(['Agents'])
  })

  describe('title resolution', () => {
    it('prefers frontmatter over the first heading', () => {
      const pages = transformPages([page('/tools/a.html', '# Heading', { title: 'Frontmatter' })], 'tools')

      expect(pages[0].title).toBe('Frontmatter')
    })

    it('falls back to the first H1 in the source', () => {
      const pages = transformPages([page('/tools/a.html', 'intro\n\n# Real Heading\n\n## Later')], 'tools')

      expect(pages[0].title).toBe('Real Heading')
    })

    it('falls back to a humanised file name when there is no heading', () => {
      const pages = transformPages([page('/tools/my-great_tool.html', 'no heading at all')], 'tools')

      expect(pages[0].title).toBe('My great tool')
    })

    it('names an index page after its folder', () => {
      const pages = transformPages([page('/notes/agents/', '')], 'notes')

      expect(pages[0].title).toBe('Agents')
    })
  })

  describe('category resolution', () => {
    it('puts pages at the section root under General', () => {
      const pages = transformPages([page('/tools/loose.html', '# Loose')], 'tools')

      expect(pages[0].category).toBe('General')
      expect(pages[0].categoryPath).toEqual(['General'])
    })

    it('builds a capitalised path from nested folders', () => {
      const pages = transformPages([page('/tools/deep_nest/sub-dir/x.html', '# X')], 'tools')

      expect(pages[0].categoryPath).toEqual(['Deep nest', 'Sub dir'])
      expect(pages[0].category).toBe('Sub dir')
    })
  })

  it('sorts by title, not by url', () => {
    const pages = transformPages(
      [page('/tools/a.html', '# Zebra'), page('/tools/z.html', '# Apple'), page('/tools/m.html', '# Mango')],
      'tools'
    )

    expect(pages.map((p) => p.title)).toEqual(['Apple', 'Mango', 'Zebra'])
  })
})

describe('groupByCategory', () => {
  it('groups items and preserves their incoming order', () => {
    const items = [
      { category: 'A', name: 'a1' },
      { category: 'B', name: 'b1' },
      { category: 'A', name: 'a2' }
    ]

    expect(groupByCategory(items)).toEqual({
      A: [items[0], items[2]],
      B: [items[1]]
    })
  })

  it('returns an empty object for no items', () => {
    expect(groupByCategory([])).toEqual({})
  })
})

describe('buildCategoryTree', () => {
  const entry = (title: string, url: string, categoryPath: string[]): PageData => ({
    title,
    url,
    category: categoryPath[categoryPath.length - 1],
    categoryPath
  })

  it('nests categories along categoryPath', () => {
    const tree = buildCategoryTree([entry('X', '/tools/deep/sub/x.html', ['Deep', 'Sub'])])

    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe('Deep')
    expect(tree[0].pages).toEqual([])
    expect(tree[0].children[0].name).toBe('Sub')
    expect(tree[0].children[0].pages.map((p) => p.title)).toEqual(['X'])
  })

  it('lifts an index page into indexUrl instead of listing it as a page', () => {
    const tree = buildCategoryTree([
      entry('Games', '/tools/games/index.html', ['Games']),
      entry('Tetris', '/tools/games/tetris.html', ['Games'])
    ])

    expect(tree[0].indexUrl).toBe('/tools/games/index.html')
    expect(tree[0].pages.map((p) => p.title)).toEqual(['Tetris'])
  })

  it('leaves indexUrl null for a category without an index page', () => {
    const tree = buildCategoryTree([entry('Tetris', '/tools/games/tetris.html', ['Games'])])

    expect(tree[0].indexUrl).toBeNull()
  })

  it('sorts categories by name and pages by title', () => {
    const tree = buildCategoryTree([
      entry('Zebra', '/tools/b/zebra.html', ['Beta']),
      entry('Apple', '/tools/b/apple.html', ['Beta']),
      entry('Solo', '/tools/a/solo.html', ['Alpha'])
    ])

    expect(tree.map((c) => c.name)).toEqual(['Alpha', 'Beta'])
    expect(tree[1].pages.map((p) => p.title)).toEqual(['Apple', 'Zebra'])
  })

  it('round-trips the output of transformPages', () => {
    const pages = transformPages(
      [
        page('/tools/hiragana-katakana.html', '# Hiragana ↔ Katakana'),
        page('/tools/games/index.html', '# Games'),
        page('/tools/games/tetris.html', '# Tetris')
      ],
      'tools'
    )
    const tree = buildCategoryTree(pages)

    expect(tree.map((c) => c.name)).toEqual(['Games', 'General'])
    expect(tree[0].indexUrl).toBe('/tools/games/index.html')
    expect(tree[0].pages.map((p) => p.title)).toEqual(['Tetris'])
    expect(tree[1].pages.map((p) => p.title)).toEqual(['Hiragana ↔ Katakana'])
  })
})
