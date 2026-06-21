---
layout: page
head:
  - - meta
    - http-equiv: refresh
      content: '0; url=/notes/'
  - - link
    - rel: canonical
      href: '/notes/'
---

<script setup>
import { onBeforeMount } from 'vue'
import { useRouter } from 'vitepress'

const { go } = useRouter()
onBeforeMount(() => {
  go('/notes/')
})
</script>

# Redirecting...

If you are not redirected automatically, please [click here](/notes/).
