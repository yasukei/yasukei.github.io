import { createContentLoader } from 'vitepress'
import { transformPages } from '../utils'

export default createContentLoader('tools/**/*.md', {
  includeSrc: true,
  transform(rawData) {
    return transformPages(rawData, 'tools')
  }
})
