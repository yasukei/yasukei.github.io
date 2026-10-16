// VitePress preloads a page's direct dynamic imports in its generated HTML.
// Keep this lightweight boundary separate so PDF engines are fetched only
// after the user adds files or saves a result, even on a direct page visit.
export function loadPdfLibrary() {
  return import('pdf-lib')
}

export function loadPdfPreview() {
  return import('./pdf-preview')
}

export function loadPdfExport() {
  return import('./pdf-editor')
}
