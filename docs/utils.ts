export interface PageData {
  title: string
  url: string
  category: string
}

/**
 * Transforms raw data loaded by VitePress content loader.
 * Extracts title and category for each page in the specified section.
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

      // Determine category from folder structure (e.g., /notes/cheatsheets/git.html -> cheatsheets)
      const parts = page.url.split('/')
      let category = 'General'
      if (parts.length > 3) {
        category = parts[parts.length - 2]
        category = category.charAt(0).toUpperCase() + category.slice(1).replace(/[-_]/g, ' ')
      }

      return {
        title,
        url: page.url,
        category
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
