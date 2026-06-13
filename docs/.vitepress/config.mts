import { defineConfig } from 'vitepress'
import fs from 'fs'
import path from 'path'

function getTitleFromMarkdown(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const frontmatterTitleMatch = content.match(/^title:\s*(["']?)(.*?)\1\s*$/m)
    if (frontmatterTitleMatch) {
      return frontmatterTitleMatch[2].trim()
    }
    const h1Match = content.match(/^#\s+(.+)$/m)
    if (h1Match) {
      return h1Match[1].trim()
    }
  } catch (e) {
    // Ignore errors
  }
  const basename = path.basename(filePath, '.md')
  const formatted = basename.replace(/[-_]/g, ' ')
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function generateSidebarItems(dirPath: string, relativePath: string = '/notes/'): any[] {
  const items: any[] = []
  if (!fs.existsSync(dirPath)) return items

  const files = fs.readdirSync(dirPath)

  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      const categoryName = file.charAt(0).toUpperCase() + file.slice(1).replace(/[-_]/g, ' ')
      const subItems = generateSidebarItems(fullPath, `${relativePath}${file}/`)
      if (subItems.length > 0) {
        items.push({
          text: categoryName,
          collapsed: false,
          items: subItems
        })
      }
    } else if (file.endsWith('.md') && file !== 'index.md') {
      const title = getTitleFromMarkdown(fullPath)
      const pageLink = `${relativePath}${file.replace(/\.md$/, '')}`
      items.push({ text: title, link: pageLink })
    }
  }

  return items.sort((a, b) => a.text.localeCompare(b.text))
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "yasukei.github.io",
  description: "notes, tools, etc.",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Notes', link: '/notes' }
    ],

    sidebar: [
      {
        text: 'Notes',
        items: [
          { text: 'Introduction', link: '/notes/' },
          ...generateSidebarItems(path.join(process.cwd(), 'docs/notes'))
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yasukei/yasukei.github.io' }
    ]
  }
})
