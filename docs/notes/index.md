<script setup>
import { data as notes } from './notes.data.ts'
import CategoryList from '../components/CategoryList.vue'
</script>

# Notes

<CategoryList :items="notes" />
