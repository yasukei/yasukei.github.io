<script setup>
import { data as notes } from './notes.data.ts'

// Group notes by category
const groupedNotes = notes.reduce((acc, note) => {
  if (!acc[note.category]) {
    acc[note.category] = []
  }
  acc[note.category].push(note)
  return acc
}, {})
</script>

# Notes

<div v-for="(pages, category) in groupedNotes" :key="category" style="margin-top: 1.5rem;">
  <h3>{{ category }}</h3>
  <ul>
    <li v-for="page in pages" :key="page.url">
      <a :href="page.url"><strong>{{ page.title }}</strong></a>
    </li>
  </ul>
</div>
