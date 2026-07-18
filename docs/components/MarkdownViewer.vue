<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'

const input = ref(`# Markdown Viewer

Type or paste **markdown** here and see it rendered on the right.

## Features

- Real-time preview
- Standard markdown syntax
- Code blocks with fencing

## Example

\`\`\`javascript
const hello = 'world'
console.log(hello)
\`\`\`

> Blockquote example

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
`)

const rendered = computed(() => marked.parse(input.value))

function clear() {
  input.value = ''
}

function copy() {
  navigator.clipboard.writeText(input.value)
}

const isFullscreen = ref(false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function onKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="mv-root" :class="{ 'mv-fullscreen': isFullscreen }">
    <div class="mv-toolbar">
      <button class="mv-btn" @click="copy">Copy</button>
      <button class="mv-btn" @click="clear">Clear</button>
      <button class="mv-btn mv-btn-fs" @click="toggleFullscreen">
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
    </div>
    <div class="mv-panels">
      <div class="mv-pane">
        <div class="mv-pane-label">Markdown</div>
        <textarea class="mv-textarea" v-model="input" placeholder="Enter markdown..." spellcheck="false" />
      </div>
      <div class="mv-pane">
        <div class="mv-pane-label">Preview</div>
        <div class="mv-preview vp-doc" v-html="rendered" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.mv-root.mv-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  margin: 0;
  padding: 12px;
  background: var(--vp-c-bg);
}

.mv-root.mv-fullscreen .mv-panels {
  min-height: 0;
  flex: 1;
}

.mv-btn-fs {
  margin-left: auto;
}

.mv-toolbar {
  display: flex;
  gap: 8px;
}

.mv-btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.mv-btn:hover {
  background: var(--vp-c-bg-mute);
}

.mv-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 480px;
}

@media (max-width: 768px) {
  .mv-panels {
    grid-template-columns: 1fr;
  }
}

.mv-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  overflow: hidden;
}

.mv-pane-label {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.mv-textarea {
  flex: 1;
  padding: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: none;
  outline: none;
  resize: none;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
}

.mv-preview {
  flex: 1;
  padding: 12px 16px;
  overflow-y: auto;
  background: var(--vp-c-bg);
}
</style>
