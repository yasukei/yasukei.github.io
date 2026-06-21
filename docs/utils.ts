export interface PageData {
  title: string
  url: string
  category: string
  categoryPath?: string[]
}

export interface CategoryNode {
  name: string
  indexUrl: string | null
  pages: PageData[]
  children: CategoryNode[]
}

/**
 * Transforms raw data loaded by VitePress content loader.
 * Extracts title, category, and categoryPath for each page in the specified section.
 * 
 * @param rawData Raw data from createContentLoader
 * @param sectionName Name of the section/folder (e.g. 'notes' or 'tools')
 * @returns Sorted PageData array
 */
export function transformPages(rawData: any[], sectionName: string): PageData[] {
  return rawData
    .filter((page) => !page.url.endsWith(`/${sectionName}/`) && !page.url.endsWith(`/${sectionName}/index.html`))
    .map((page) => {
      let title = page.frontmatter.title
      if (!title && page.src) {
        // Extract first H1 heading from markdown source
        const match = page.src.match(/^#\s+(.+)$/m)
        if (match) {
          title = match[1].trim()
        }
      }
      if (!title) {
        // Fallback: format page name
        const parts = page.url.split('/')
        const lastPart = parts[parts.length - 1] || parts[parts.length - 2] || 'Untitled'
        const filename = lastPart.replace(/\.html$/, '')
        title = filename.replace(/[-_]/g, ' ')
        title = title.charAt(0).toUpperCase() + title.slice(1)
      }

      // Determine category from folder structure
      const parts = page.url.split('/')
      const sectionIndex = parts.indexOf(sectionName)
      
      let folderSegments: string[] = []
      if (sectionIndex !== -1) {
        folderSegments = parts.slice(sectionIndex + 1, parts.length - 1)
      }

      const categoryPath = folderSegments.map((segment) => {
        return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/[-_]/g, ' ')
      })

      if (categoryPath.length === 0) {
        categoryPath.push('General')
      }

      const category = categoryPath[categoryPath.length - 1]

      return {
        title,
        url: page.url,
        category,
        categoryPath
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * Groups pages/items by their category.
 * 
 * @param items Array of items with a category property
 * @returns Object mapping category names to arrays of items
 */
export function groupByCategory<T extends { category: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

/**
 * Builds a hierarchical category tree from a list of PageData.
 * 
 * @param pages List of pages
 * @returns A tree of CategoryNodes
 */
export function buildCategoryTree(pages: PageData[]): CategoryNode[] {
  const root: { children: Record<string, any>, pages: PageData[], indexUrl: string | null } = {
    children: {},
    pages: [],
    indexUrl: null
  }

  for (const page of pages) {
    const path = page.categoryPath || [page.category]
    let current = root

    for (const segment of path) {
      if (!current.children[segment]) {
        current.children[segment] = {
          name: segment,
          indexUrl: null,
          pages: [],
          children: {}
        }
      }
      current = current.children[segment]
    }

    const urlParts = page.url.split('/')
    const lastPart = urlParts[urlParts.length - 1]
    const isIndex = lastPart === 'index.html' || lastPart === 'index' || lastPart === ''

    if (isIndex) {
      current.indexUrl = page.url
    } else {
      current.pages.push(page)
    }
  }

  function toNodeList(nodeMap: Record<string, any>): CategoryNode[] {
    return Object.values(nodeMap)
      .map((node) => {
        const sortedChildren = toNodeList(node.children)
        const sortedPages = [...node.pages].sort((a, b) => a.title.localeCompare(b.title))
        return {
          name: node.name,
          indexUrl: node.indexUrl,
          pages: sortedPages,
          children: sortedChildren
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return toNodeList(root.children)
}

