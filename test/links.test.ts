import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { createMarkdownRenderer, type MarkdownRenderer } from 'vitepress'

/**
 * Link checking for the ground `npm run build` does not cover.
 *
 * The VitePress build already fails on dead markdown links between pages, but
 * it never looks at heading anchors, at raw HTML `<a href>`, at links written
 * inside .vue components, or at README.md (which is not part of the site).
 * This checks all of it in one pass, so plain page links are covered twice --
 * cheap insurance if `ignoreDeadLinks` is ever switched on.
 *
 * Anchors come from VitePress's own markdown renderer rather than a
 * reimplementation of its slugify, so custom `{#ids}` and non-ASCII headings
 * are handled exactly as the site handles them, and cannot drift from it.
 */

const ROOT = path.resolve(import.meta.dirname, '..')
const DOCS = path.join(ROOT, 'docs')
const PUBLIC_DIR = path.join(DOCS, 'public')

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'cache'])

/** Protocols and template syntax that never point at a file in this repo. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

interface Link {
  /** Absolute path of the file the link was written in. */
  file: string
  line: number
  /** The href exactly as authored. */
  raw: string
  /** Path portion, before any '#'. */
  target: string
  /** Fragment without the '#', or '' when there is none. */
  fragment: string
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Replaces a run of text with spaces, keeping newlines so line numbers hold. */
function blank(match: string): string {
  return match.replace(/[^\n]/g, ' ')
}

/**
 * Blanks fenced and inline code. docs/notes/cheatsheets/markdown.md documents
 * link syntax by example, so without this the checker reports its samples.
 */
function stripCode(src: string): string {
  return src
    .replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*\2[^\n]*$/gm, blank)
    .replace(/`[^`\n]*`/g, blank)
}

/** Keeps only the <template> block of an SFC; script and style cannot hold links. */
function templateOnly(src: string): string {
  const open = src.match(/<template[^>]*>/)
  const close = src.lastIndexOf('</template>')
  if (!open || open.index === undefined || close === -1) return blank(src)
  const start = open.index + open[0].length
  return blank(src.slice(0, start)) + src.slice(start, close) + blank(src.slice(close))
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length
}

function extractLinks(file: string): Link[] {
  const source = readFileSync(file, 'utf-8')
  const scannable = file.endsWith('.vue') ? templateOnly(source) : stripCode(source)
  const found: Link[] = []

  const patterns = [
    // [text](target) and ![alt](target), optional "title" after the target
    /!?\[(?:[^\][\\]|\\.)*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g,
    // <a href="..."> -- `\s` before the name keeps Vue's :href bindings out
    /<a\b[^>]*?\shref\s*=\s*"([^"]*)"/gi,
    /<img\b[^>]*?\ssrc\s*=\s*"([^"]*)"/gi
  ]

  for (const pattern of patterns) {
    for (const match of scannable.matchAll(pattern)) {
      const raw = match[1].trim()
      if (!raw || EXTERNAL.test(raw) || raw.includes('{{')) continue
      const hash = raw.indexOf('#')
      found.push({
        file,
        line: lineOf(scannable, match.index),
        raw,
        target: hash === -1 ? raw : raw.slice(0, hash),
        fragment: hash === -1 ? '' : raw.slice(hash + 1)
      })
    }
  }

  return found
}

/**
 * Paths a target may legitimately resolve to. Root-relative means the site
 * root for pages under docs/ (where docs/public is also served from the root),
 * but the repository root for README.md, which GitHub renders.
 */
function candidatesFor(link: Link): string[] {
  const inDocs = link.file.startsWith(DOCS + path.sep)
  const bases = link.target.startsWith('/')
    ? inDocs
      ? [path.join(DOCS, link.target), path.join(PUBLIC_DIR, link.target)]
      : [path.join(ROOT, link.target)]
    : [path.resolve(path.dirname(link.file), link.target)]

  return bases.flatMap((base) => {
    const forms = [base]
    if (base.endsWith('.html')) forms.push(base.replace(/\.html$/, '.md'))
    if (!path.extname(base)) forms.push(`${base}.md`, path.join(base, 'index.md'))
    return forms
  })
}

function resolveFile(link: Link): string | null {
  for (const candidate of candidatesFor(link)) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

/** Percent-encoded fragments and literal ones must compare equal. */
function decode(fragment: string): string {
  try {
    return decodeURIComponent(fragment)
  } catch {
    return fragment
  }
}

const sourceFiles = [
  ...walk(DOCS).filter((f) => f.endsWith('.md') || f.endsWith('.vue')),
  path.join(ROOT, 'README.md')
]

const links = sourceFiles.flatMap(extractLinks)

const rel = (file: string) => path.relative(ROOT, file)
const describeLink = (link: Link) => `${rel(link.file)}:${link.line} -> ${link.raw}`

describe('internal links', () => {
  it('finds files to check', () => {
    // Guards against the walker silently matching nothing, which would make
    // every assertion below pass for the wrong reason.
    expect(sourceFiles.length).toBeGreaterThan(10)
    expect(links.length).toBeGreaterThan(0)
  })

  it('all resolve to a file that exists', () => {
    const broken = links
      .filter((link) => link.target !== '' && resolveFile(link) === null)
      .map((link) => `${describeLink(link)}\n    tried: ${candidatesFor(link).map(rel).join(', ')}`)

    expect(broken, `\n${broken.join('\n')}\n`).toEqual([])
  })

  describe('fragments', () => {
    let md: MarkdownRenderer
    const cache = new Map<string, Set<string>>()

    beforeAll(async () => {
      md = await createMarkdownRenderer(DOCS)
    })

    /** Ids VitePress actually emits for a markdown file. */
    function anchorsOf(file: string): Set<string> {
      const cached = cache.get(file)
      if (cached) return cached

      const body = readFileSync(file, 'utf-8').replace(/^---\n[\s\S]*?\n---\n/, '')
      const ids = new Set(
        [...md.render(body).matchAll(/\sid="([^"]*)"/g)].map((m) => decode(m[1]))
      )
      cache.set(file, ids)
      return ids
    }

    it('point at a heading that exists', () => {
      const dangling = links
        .filter((link) => link.fragment !== '')
        .flatMap((link) => {
          // An empty target means an anchor within the same file.
          const targetFile = link.target === '' ? link.file : resolveFile(link)
          // A missing file is already reported by the test above; anchors are
          // only meaningful for markdown, so .vue targets are out of scope.
          if (targetFile === null || !targetFile.endsWith('.md')) return []

          const anchors = anchorsOf(targetFile)
          if (anchors.has(decode(link.fragment))) return []
          return [`${describeLink(link)}\n    ${rel(targetFile)} has: ${[...anchors].join(', ') || '(no headings)'}`]
        })

      expect(dangling, `\n${dangling.join('\n')}\n`).toEqual([])
    })
  })
})
