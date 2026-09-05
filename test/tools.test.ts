import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import config from '../docs/.vitepress/config.mts'

/**
 * Contracts every tool page has to keep, applied by globbing docs/tools rather
 * than by naming pages, so a tool added later is covered without touching this
 * file.
 *
 * These check the ways a tool page can be broken while still building: an
 * imported component that is never placed in the page, a missing H1 that
 * downgrades the title to a guess from the file name, or a page that simply
 * never appears in the navigation.
 */

const ROOT = path.resolve(import.meta.dirname, '..')
const DOCS = path.join(ROOT, 'docs')
const TOOLS = path.join(DOCS, 'tools')

interface SidebarItem {
  text?: string
  link?: string
  items?: SidebarItem[]
}

interface ToolPage {
  /** File name without extension, as it appears in the url. */
  slug: string
  file: string
  source: string
  /** Everything outside the <script setup> block. */
  body: string
}

/** index.md is the listing of the tools, not a tool. */
const toolPages: ToolPage[] = readdirSync(TOOLS)
  .filter((name) => name.endsWith('.md') && name !== 'index.md')
  .map((name) => {
    const file = path.join(TOOLS, name)
    const source = readFileSync(file, 'utf-8')
    return {
      slug: name.replace(/\.md$/, ''),
      file,
      source,
      body: source.replace(/<script[\s\S]*?<\/script>/g, '')
    }
  })

function headingOf(source: string): string | null {
  return source.match(/^#\s+(.+)$/m)?.[1].trim() ?? null
}

function componentImports(source: string): { name: string; from: string }[] {
  return [...source.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+\.vue)['"]/g)].map((m) => ({
    name: m[1],
    from: m[2]
  }))
}

function flattenSidebar(items: SidebarItem[]): SidebarItem[] {
  return items.flatMap((item) => [item, ...flattenSidebar(item.items ?? [])])
}

const sidebar = (config.themeConfig?.sidebar ?? []) as SidebarItem[]
const toolsGroup = sidebar.find((group) => group.text === 'Tools')
const toolsSidebar = flattenSidebar(toolsGroup?.items ?? [])

/** Resolves a site-root link the way VitePress serves it, back to its source. */
function sourceOfLink(link: string): string | null {
  const base = path.join(DOCS, link)
  const candidates = [base, `${base}.md`, path.join(base, 'index.md')]
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null
}

const rel = (file: string) => path.relative(ROOT, file)

describe('tool pages', () => {
  it('there are some to check', () => {
    // Without this, globbing the wrong directory would make every it.each
    // below vacuous rather than failing.
    expect(toolPages.length).toBeGreaterThan(0)
  })

  describe.each(toolPages)('$slug', (page) => {
    it('has an H1 to take its title from', () => {
      // Both the /tools index and the sidebar fall back to a prettified file
      // name without one, which silently looks almost right.
      expect(headingOf(page.source)).not.toBeNull()
    })

    it('imports components that exist', () => {
      const missing = componentImports(page.source)
        .map((imported) => path.resolve(path.dirname(page.file), imported.from))
        .filter((target) => !existsSync(target))
        .map(rel)

      expect(missing).toEqual([])
    })

    it('places every component it imports', () => {
      // An unused import builds cleanly and renders an empty page.
      const unused = componentImports(page.source)
        .filter((imported) => !new RegExp(`<${imported.name}[\\s/>]`).test(page.body))
        .map((imported) => imported.name)

      expect(unused).toEqual([])
    })

    it('is listed in the sidebar under its own title', () => {
      const entry = toolsSidebar.find((item) => item.link === `/tools/${page.slug}`)

      expect(entry, `no sidebar entry links to /tools/${page.slug}`).toBeDefined()
      expect(entry?.text).toBe(headingOf(page.source))
    })
  })
})

describe('sidebar', () => {
  it('is generated for both sections', () => {
    expect(sidebar.map((group) => group.text)).toEqual(['Notes', 'Tools'])
  })

  it('links only to pages that exist', () => {
    // The links are built from relative paths at config time, which has gone
    // wrong before: an entry that points nowhere still renders in the nav.
    const dangling = flattenSidebar(sidebar)
      .filter((item) => item.link !== undefined)
      .filter((item) => sourceOfLink(item.link as string) === null)
      .map((item) => `${item.text} -> ${item.link}`)

    expect(dangling, `\n${dangling.join('\n')}\n`).toEqual([])
  })

  it('links to every tool page', () => {
    const linked = new Set(toolsSidebar.map((item) => item.link))
    const missing = toolPages.map((page) => `/tools/${page.slug}`).filter((link) => !linked.has(link))

    expect(missing).toEqual([])
  })
})
