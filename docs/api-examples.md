# Runtime API Examples

This page demonstrates how to use VitePress's runtime API.

## `useData`

The `useData` helper provides access to site-level and page-level data.

<script setup>
import { useData } from 'vitepress'

const { site, theme, page, frontmatter } = useData()
</script>

### Site Data
<pre>{{ JSON.stringify(site, null, 2) }}</pre>

### Theme Config
<pre>{{ JSON.stringify(theme, null, 2) }}</pre>

### Page Data
<pre>{{ JSON.stringify(page, null, 2) }}</pre>

### Page Frontmatter
<pre>{{ JSON.stringify(frontmatter, null, 2) }}</pre>
