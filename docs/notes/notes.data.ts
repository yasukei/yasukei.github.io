import { createContentLoader } from 'vitepress'

export interface NotePage {
  title: string
  url: string
  category: string
}

export default createContentLoader('notes/**/*.md', {
  includeSrc: true,
  transform(rawData): NotePage[] {
    return rawData
      .filter((page) => !page.url.endsWith('/notes/') && !page.url.endsWith('/notes/index.html'))
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
        // page.url looks like /notes/cheatsheets/git.html or /notes/coding_agents.html
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
})
