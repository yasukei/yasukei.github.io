<script setup>
import { data as tools } from './tools.data.ts'
import CategoryList from '../components/CategoryList.vue'
</script>

# Tools

<CategoryList :items="tools" />
