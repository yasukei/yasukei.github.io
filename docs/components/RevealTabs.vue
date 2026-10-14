<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BrowserInfo from './BrowserInfo.vue'
import BehaviorTracker from './BehaviorTracker.vue'
import PermissionPanel from './PermissionPanel.vue'

/**
 * The six categories of the browser-reveals page as tabs.
 *
 * Every panel stays mounted and is only hidden, so the behaviour log keeps
 * recording and the probes keep their results while another tab is open.
 * The selected tab is kept in the URL hash (#hardware), so a tab can be
 * linked to; it is replaced rather than pushed, so switching tabs does not
 * pile up history entries.
 */

interface Tab {
  id: 'browser' | 'hardware' | 'install' | 'page' | 'behavior' | 'permission'
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
  },
  {
    id: 'permission',
    label: '許可が必要なもの',
    intro:
      'ここだけは、アクセスするときにブラウザが許可を求めます。下のボタンを押すと許可ダイアログが出て、許可すると現在地、カメラの映像、マイクの音、機器の名前、スマホの傾きや加速度にアクセスできるようになります(傾きと加速度だけは、Android の Chrome なら許可なしでアクセスできます)。許可しなければ何にもアクセスできず、取得した内容はこのページの外には出ません(どこにも送っていません)。一度許可して「記憶」させると、そのサイトは次からダイアログなしでアクセスできます。'
  }
]

const active = ref<Tab['id']>('browser')

function fromHash(): Tab['id'] | null {
  let id: string
  try {
    id = decodeURIComponent(location.hash.slice(1))
  } catch {
    // A malformed escape such as #%E0 names no tab.
    return null
  }
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
  // Not through a ref array: Vue does not keep one in the order of the v-for.
  document.getElementById(`rt-tab-${TABS[next].id}`)?.focus()
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
      <PermissionPanel v-else-if="tab.id === 'permission'" />
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
  /* Six tabs are wider than the content column, and a row that scrolls
     sideways hides the last one. They wrap onto a second line instead. */
  flex-wrap: wrap;
}

.rt-tab {
  /* Grow to fill the row, so the line under a wrapped row reaches both edges. */
  flex: 1 0 auto;
  padding: 8px 10px;
  border: none;
  /* Each tab draws its own divider along the very bottom, since a wrapped row
     has no single line to put it on. It is a background, which the border is
     painted over, so the selected tab's underline covers it. */
  border-bottom: 2px solid transparent;
  background: linear-gradient(var(--vp-c-divider), var(--vp-c-divider)) bottom / 100% 1px no-repeat border-box;
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
