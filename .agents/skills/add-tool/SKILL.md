---
name: add-tool
description: Guide the design and creation of a new interactive utility tool or browser game in the tools section.
---

# Add Tool Skill

This skill outlines rules and best practices for creating interactive tools and browser games under the [docs/tools/](file:///home/yasukei/git/yasukei.github.io/docs/tools/) directory.

## 1. Directory Structure
- Create a markdown page under [docs/tools/](file:///home/yasukei/git/yasukei.github.io/docs/tools/) (e.g., `docs/tools/my-utility.md`).
- If the tool requires custom components, define Vue components inside [docs/components/](file:///home/yasukei/git/yasukei.github.io/docs/components/) or place them directly in a folder under `docs/tools/` if specific to that tool.

## 2. Design Standards & Principles
When adding tools or games:
1. **Interactive Experience**: Make the UI look polished, modern, and highly interactive.
2. **Framework Compliance**: Use standard Vue 3 with `<script setup lang="ts">`.
3. **No Placeholders**: Avoid static placeholders; implement fully functioning logic.
4. **VitePress Support**: Since pages are built as SSG, ensure any browser-only APIs (like `window`, `document`, `localStorage`) are properly protected. Standard VitePress practice is to check `import.meta.env.SSR` or wrap browser-only code in a `<ClientOnly>` component block:
   ```html
   <ClientOnly>
     <MyInteractiveTool />
   </ClientOnly>
   ```

## 3. Sidebar & Index Automation
Similar to notes, the tool index is dynamically populated via `tools.data.ts` and [config.mts](file:///home/yasukei/git/yasukei.github.io/docs/.vitepress/config.mts). Manual sidebar updates are not required for new tools.
