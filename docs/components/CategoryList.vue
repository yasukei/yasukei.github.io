<script setup lang="ts">
import { computed } from 'vue'
import { groupByCategory, type PageData } from '../utils'

const props = defineProps<{
  items: PageData[]
}>()

const groupedItems = computed(() => groupByCategory(props.items))
</script>

<template>
  <div v-for="(pages, category) in groupedItems" :key="category" style="margin-top: 1.5rem;">
    <h3>{{ category }}</h3>
    <ul>
      <li v-for="page in pages" :key="page.url">
        <a :href="page.url"><strong>{{ page.title }}</strong></a>
      </li>
    </ul>
  </div>
</template>
