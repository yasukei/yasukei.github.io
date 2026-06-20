---
name: add-note
description: Guide the creation, placement, and formatting of a new note in the wiki/notes section of the personal website.
---

# Add Note Skill

This skill provides guidelines for creating and integrating a new Markdown note in the `docs/notes/` directory.

## 1. Directory Structure & Organization
All notes are located in subdirectories of [docs/notes/](../../../docs/notes/).
Categories map to directory names:
- [docs/notes/cheatsheets/](../../../docs/notes/cheatsheets/) - For quick reference cheat sheets
- [docs/notes/mcp/](../../../docs/notes/mcp/) - For Model Context Protocol related notes
- [docs/notes/github/](../../../docs/notes/github/) - For GitHub specific notes
- [docs/notes/jules/](../../../docs/notes/jules/) - For project Jules related notes

If creating a new category, create a new directory under [docs/notes/](../../../docs/notes/). The directory name should be in lowercase and use hyphens for spaces (e.g. `web-development`).

## 2. Formatting & Metadata
Each note should be a Markdown file (`.md`) ending in a newline.
- **Title**: Place a standard Markdown `# H1 Header` at the top of the file, or use YAML frontmatter:
  ```yaml
  ---
  title: Your Custom Title
  description: Brief description of the note.
  ---
  ```
- **Formatting Guidelines**:
  - Keep sections structured with `##` or `###` headings.
  - Follow VitePress-flavored markdown guidelines (e.g., standard custom containers like `::: info` if needed, etc.).
  - Preserve any links by linking properly to other pages using markdown syntax like `[Link Title](../category/page-name)`.

## 3. Sidebar & Index Automation
The VitePress configuration automatically scans and registers notes:
- The sidebar configuration in [config.mts](../../../docs/.vitepress/config.mts) calls `generateSidebarItems()` on `docs/notes` which auto-detects all files (excluding `index.md`) and groups them by their parent directory.
- The Note index page [docs/notes/index.md](../../../docs/notes/index.md) pulls data dynamically via `notes.data.ts`.
- **Do not** manually edit [config.mts](../../../docs/.vitepress/config.mts) or [docs/notes/index.md](../../../docs/notes/index.md) when adding a note; it will appear automatically.
