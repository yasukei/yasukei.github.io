<script setup lang="ts">
import type { CategoryNode as CategoryNodeType } from '../utils'

defineProps<{
  node: CategoryNodeType
  level: number
}>()
</script>

<template>
  <div class="category-node" :style="{ marginLeft: level > 0 ? '1.5rem' : '0' }">
    <!-- Header of the category -->
    <h3 v-if="level === 0" style="margin-top: 1.5rem; margin-bottom: 0.5rem;">
      <a v-if="node.indexUrl" :href="node.indexUrl">{{ node.name }}</a>
      <span v-else>{{ node.name }}</span>
    </h3>
    <h4 v-else-if="level === 1" style="margin-top: 1rem; margin-bottom: 0.4rem;">
      <a v-if="node.indexUrl" :href="node.indexUrl">{{ node.name }}</a>
      <span v-else>{{ node.name }}</span>
    </h4>
    <h5 v-else style="margin-top: 0.8rem; margin-bottom: 0.3rem;">
      <a v-if="node.indexUrl" :href="node.indexUrl">{{ node.name }}</a>
      <span v-else>{{ node.name }}</span>
    </h5>

    <!-- Pages directly in this category -->
    <ul v-if="node.pages.length > 0">
      <li v-for="page in node.pages" :key="page.url">
        <a :href="page.url"><strong>{{ page.title }}</strong></a>
      </li>
    </ul>

    <!-- Nested subcategories -->
    <div v-if="node.children.length > 0">
      <CategoryNode
        v-for="child in node.children"
        :key="child.name"
        :node="child"
        :level="level + 1"
      />
    </div>
  </div>
</template>
