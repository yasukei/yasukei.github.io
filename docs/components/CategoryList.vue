<script setup lang="ts">
import { computed } from 'vue'
import { buildCategoryTree, type PageData } from '../utils'
import CategoryNode from './CategoryNode.vue'

const props = defineProps<{
  items: PageData[]
}>()

const categoryTree = computed(() => {
  return buildCategoryTree(props.items)
})
</script>

<template>
  <div class="category-list">
    <CategoryNode
      v-for="cat in categoryTree"
      :key="cat.name"
      :node="cat"
      :level="0"
    />
  </div>
</template>
