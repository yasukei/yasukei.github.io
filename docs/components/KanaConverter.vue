<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { toHiragana, toKatakana } from '../lib/kana'

type Pane = 'hiragana' | 'katakana'

const hiragana = ref('ひらがな と カタカナ を へんかん します。')
const katakana = ref(toKatakana(hiragana.value))

// Guard so the pane being edited is never rewritten (which would move the caret).
// Sync flush keeps the guard valid while the paired watcher runs.
let source: Pane | null = null

watch(hiragana, (value) => {
  if (source === 'katakana') return
  source = 'hiragana'
  katakana.value = toKatakana(value)
  source = null
}, { flush: 'sync' })

watch(katakana, (value) => {
  if (source === 'hiragana') return
  source = 'katakana'
  hiragana.value = toHiragana(value)
  source = null
}, { flush: 'sync' })

const count = computed(() => [...hiragana.value].length)

function clear() {
  hiragana.value = ''
}

const copied = ref<Pane | ''>('')

async function copy(kind: Pane) {
  const text = kind === 'hiragana' ? hiragana.value : katakana.value
  try {
    await navigator.clipboard.writeText(text)
    copied.value = kind
    setTimeout(() => {
      if (copied.value === kind) copied.value = ''
    }, 1200)
  } catch {
    // Clipboard access can be denied; nothing useful to do here.
  }
}
</script>

<template>
  <div class="kc-root">
    <div class="kc-toolbar">
      <button class="kc-btn" @click="clear">Clear</button>
      <span class="kc-count">{{ count }} chars</span>
    </div>
    <div class="kc-panels">
      <div class="kc-pane">
        <div class="kc-pane-head">
          <span class="kc-pane-label">Hiragana / ひらがな</span>
          <button class="kc-copy" @click="copy('hiragana')">
            {{ copied === 'hiragana' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <textarea
          class="kc-textarea"
          v-model="hiragana"
          placeholder="ひらがなを入力..."
          spellcheck="false"
          lang="ja"
        />
      </div>
      <div class="kc-pane">
        <div class="kc-pane-head">
          <span class="kc-pane-label">Katakana / カタカナ</span>
          <button class="kc-copy" @click="copy('katakana')">
            {{ copied === 'katakana' ? 'Copied' : 'Copy' }}
          </button>
        </div>
        <textarea
          class="kc-textarea"
          v-model="katakana"
          placeholder="カタカナヲニュウリョク..."
          spellcheck="false"
          lang="ja"
        />
      </div>
    </div>
    <p class="kc-hint">
      Both panes convert as you type — edit either side. Kanji, latin letters and
      punctuation are left as they are.
    </p>
  </div>
</template>

<style scoped>
.kc-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.kc-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.kc-btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}

.kc-btn:hover {
  background: var(--vp-c-bg-mute);
}

.kc-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.kc-panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  min-height: 260px;
}

@media (max-width: 768px) {
  .kc-panels {
    grid-template-columns: 1fr;
  }
}

.kc-pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  overflow: hidden;
}

.kc-pane-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 10px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-border);
}

.kc-pane-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kc-copy {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid var(--vp-c-border);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  font-size: 11px;
}

.kc-copy:hover {
  background: var(--vp-c-bg-mute);
}

.kc-textarea {
  flex: 1;
  padding: 12px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border: none;
  outline: none;
  resize: vertical;
  font-size: 15px;
  line-height: 1.8;
}

.kc-hint {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
