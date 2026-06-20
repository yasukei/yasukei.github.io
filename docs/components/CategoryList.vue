<script setup lang="ts">
import { computed } from 'vue'
import { groupByCategory, type PageData } from '../utils'

const props = defineProps<{
  items: PageData[]
}>()

const processedCategories = computed(() => {
  const groups = groupByCategory(props.items)
  return Object.entries(groups).map(([category, pages]) => {
    const indexPage = pages.find(p => p.url.endsWith('/index.html') || p.url.endsWith('/'))
    const childPages = pages.filter(p => p !== indexPage)
    return {
      name: category,
      indexUrl: indexPage ? indexPage.url : null,
      pages: childPages
    }
  })
})
</script>

<template>
  <div v-for="cat in processedCategories" :key="cat.name" style="margin-top: 1.5rem;">
    <h3 v-if="cat.indexUrl">
      <a :href="cat.indexUrl">{{ cat.name }}</a>
    </h3>
    <h3 v-else>{{ cat.name }}</h3>
    <ul>
      <li v-for="page in cat.pages" :key="page.url">
        <a :href="page.url"><strong>{{ page.title }}</strong></a>
      </li>
    </ul>
  </div>
</template>
