<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BrowserInfo from './BrowserInfo.vue'
import BehaviorTracker from './BehaviorTracker.vue'

/**
 * The five categories of the browser-reveals page as tabs.
 *
 * Every panel stays mounted and is only hidden, so the behaviour log keeps
 * recording and the probes keep their results while another tab is open.
 * The selected tab is kept in the URL hash (#hardware), so a tab can be
 * linked to; it is replaced rather than pushed, so switching tabs does not
 * pile up history entries.
 */

interface Tab {
  id: 'browser' | 'hardware' | 'install' | 'page' | 'behavior'
  label: string
  intro?: string
}

const TABS: Tab[] = [
  {
    id: 'browser',
    label: 'ブラウザ・OS',
    intro:
      'ブラウザの種類とバージョン、OS、言語やタイムゾーン、ダークモードなどの設定です。どれも1つだけならありふれた値ですが、組み合わせると人をかなり絞り込めます。'
  },
  {
    id: 'hardware',
    label: 'ハードウェア',
    intro:
      'GPUの機種や、描画・音声処理の結果に出るわずかな差は、Cookieを消しても変わらないので、ブラウザフィンガープリント(端末の識別)によく使われます。'
  },
  {
    id: 'install',
    label: 'インストール環境',
    intro: '何が入っているかは、OSや言語だけでなく、使っているソフトや仕事の見当まで付けられる材料になります。'
  },
  {
    id: 'page',
    label: 'ウィンドウとページ',
    intro: 'ウィンドウの大きさや位置、いま見られているかどうかは、ページを開いている間ずっと読み取れます。'
  },
  {
    id: 'behavior',
    label: '操作の情報',
    intro:
      'このページを開いた瞬間から、マウス、スクロール、キー入力などをページ自身が記録しています(ここでは表示しているだけで、どこにも送っていません)。マウスの動きやキー入力のリズムには人ごとの癖があるため、ボット検知だけでなく本人の識別(行動バイオメトリクス)にも使われています。'
  }
]

const active = ref<Tab['id']>('browser')
const tabButtons = ref<HTMLButtonElement[]>([])

function fromHash(): Tab['id'] | null {
  const id = decodeURIComponent(location.hash.slice(1))
  return TABS.find((tab) => tab.id === id)?.id ?? null
}

function select(id: Tab['id']) {
  active.value = id
  history.replaceState(history.state, '', `#${id}`)
}

/** Arrow keys move along the tabs, as the ARIA tabs pattern expects. */
function onKeydown(event: KeyboardEvent, index: number) {
  const last = TABS.length - 1
  const next =
    event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
    : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
    : event.key === 'Home' ? 0
    : event.key === 'End' ? last
    : null
  if (next === null) return
  event.preventDefault()
  select(TABS[next].id)
  tabButtons.value[next]?.focus()
}

function onHashChange() {
  const id = fromHash()
  if (id) active.value = id
}

onMounted(() => {
  onHashChange()
  window.addEventListener('hashchange', onHashChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <div class="rt-root">
    <div class="rt-tabs" role="tablist" aria-label="読み取れる情報の種類">
      <button
        v-for="(tab, i) in TABS"
        :id="`rt-tab-${tab.id}`"
        :key="tab.id"
        ref="tabButtons"
        class="rt-tab"
        role="tab"
        :aria-selected="active === tab.id"
        :aria-controls="`rt-panel-${tab.id}`"
        :tabindex="active === tab.id ? 0 : -1"
        @click="select(tab.id)"
        @keydown="onKeydown($event, i)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div
      v-for="tab in TABS"
      v-show="active === tab.id"
      :id="`rt-panel-${tab.id}`"
      :key="tab.id"
      class="rt-panel"
      role="tabpanel"
      :aria-labelledby="`rt-tab-${tab.id}`"
      :data-tab="tab.id"
    >
      <p v-if="tab.intro" class="rt-intro">{{ tab.intro }}</p>
      <BehaviorTracker v-if="tab.id === 'behavior'" />
      <BrowserInfo v-else :category="tab.id" />
    </div>
  </div>
</template>

<style scoped>
.rt-root {
  margin-top: 24px;
}

.rt-tabs {
  display: flex;
  overflow-x: auto;
  /* Only sideways: overflow-x alone makes the row scroll vertically too, and
     Chrome then shows a scrollbar for even a pixel of overflow. */
  overflow-y: hidden;
  /* The line under the tabs is drawn inside the row, not as a border below
     it, so the selected tab's underline can cover it without poking out. */
  box-shadow: inset 0 -1px var(--vp-c-divider);
  scrollbar-width: thin;
}

.rt-tab {
  flex: none;
  /* Tight enough for all five to fit the desktop content column; on a phone
     the row scrolls sideways. */
  padding: 8px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--vp-c-text-2);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.rt-tab:hover {
  color: var(--vp-c-text-1);
}

.rt-tab[aria-selected='true'] {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.rt-tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -2px;
  border-radius: 4px 4px 0 0;
}

.rt-intro {
  margin: 16px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
</style>
