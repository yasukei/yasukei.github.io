<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import InfoPanel from './InfoPanel.vue'
import {
  DISPLAY_FEATURES,
  collectBrowserOs,
  mediaQueryOf,
  type MediaFeature,
  type Section
} from '../lib/browser-info'
import { INPUT_FEATURES, SCREEN_FEATURES, collectHardware } from '../lib/hardware-info'
import { runProbes } from '../lib/hardware-probes'
import { collectInstall } from '../lib/install-info'
import { runInstallProbes } from '../lib/install-probes'
import { collectPage, readPageEnv } from '../lib/page-info'

type Category = 'browser' | 'hardware' | 'install' | 'page'

const props = defineProps<{ category: Category }>()

interface CategorySource {
  collect: () => Promise<Section[]>
  /** Media features whose change re-collects the category. */
  media: MediaFeature[]
  /** Window events that do the same. */
  events: string[]
  /** For values that change without an event, such as the window's position. */
  pollMs?: number
}

const matchMedia = (query: string) => window.matchMedia(query)

const SOURCES: Record<Category, CategorySource> = {
  browser: {
    collect: () => collectBrowserOs(navigator, matchMedia, new Date()),
    media: DISPLAY_FEATURES,
    events: ['languagechange']
  },
  hardware: {
    collect: async () =>
      collectHardware({
        nav: navigator,
        screen,
        devicePixelRatio: window.devicePixelRatio,
        matchMedia,
        probes: await runProbes(navigator)
      }),
    media: [...SCREEN_FEATURES, ...INPUT_FEATURES],
    events: []
  },
  install: {
    collect: async () => collectInstall(await runInstallProbes(navigator)),
    media: [],
    events: []
  },
  page: {
    collect: async () => collectPage(readPageEnv(window)),
    media: [],
    // visibilitychange is fired at the document and bubbles up to the window.
    events: ['resize', 'focus', 'blur', 'visibilitychange', 'online', 'offline', 'load'],
    pollMs: 1000
  }
}

// Empty until mounted: the page is prerendered at build time, where there is
// no navigator, and what the build machine would report is not the reader's.
const sections = ref<Section[]>([])

/** Bumped per refresh, so a slow answer cannot overwrite a newer one. */
let generation = 0

async function refresh() {
  const mine = ++generation
  const collected = await SOURCES[props.category].collect()
  if (mine === generation) sections.value = collected
}

// Changing the OS theme or language while the page is open updates the table,
// which is the point being made: a page is told about it, not just at load.
const stops: (() => void)[] = []

onMounted(() => {
  refresh()

  const source = SOURCES[props.category]
  for (const feature of source.media) {
    for (const value of feature.values) {
      const list = window.matchMedia(mediaQueryOf(feature.feature, value))
      list.addEventListener('change', refresh)
      stops.push(() => list.removeEventListener('change', refresh))
    }
  }
  for (const event of source.events) {
    window.addEventListener(event, refresh)
    stops.push(() => window.removeEventListener(event, refresh))
  }
  if (source.pollMs) {
    const timer = setInterval(refresh, source.pollMs)
    stops.push(() => clearInterval(timer))
  }
})

onBeforeUnmount(() => {
  for (const stop of stops) stop()
})
</script>

<template>
  <InfoPanel :sections="sections" refreshable @refresh="refresh" />
</template>
