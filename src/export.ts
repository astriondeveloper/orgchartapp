import type { OrgChart } from './model'

/* Export helpers: standalone SVG, high-DPI PNG, and chart JSON. */

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeName(title: string): string {
  return (title.trim() || 'org-chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function svgMarkup(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style')
  // Strip editor-only decorations (e.g. the selection outline).
  clone.querySelectorAll('[data-ui]').forEach((el) => el.remove())
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`
}

export function exportSvg(svgEl: SVGSVGElement, title: string): void {
  download(new Blob([svgMarkup(svgEl)], { type: 'image/svg+xml' }), `${safeName(title)}.svg`)
}

export function exportPng(svgEl: SVGSVGElement, title: string, scale: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const width = svgEl.viewBox.baseVal.width || svgEl.clientWidth
    const height = svgEl.viewBox.baseVal.height || svgEl.clientHeight
    const svgBlob = new Blob([svgMarkup(svgEl)], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        reject(new Error('Canvas unavailable'))
        return
      }
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => {
        if (blob) {
          download(blob, `${safeName(title)}@${scale}x.png`)
          resolve()
        } else {
          reject(new Error('PNG encoding failed'))
        }
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG rasterization failed'))
    }
    img.src = url
  })
}

export function exportJson(chart: OrgChart): void {
  download(
    new Blob([JSON.stringify(chart, null, 2)], { type: 'application/json' }),
    `${safeName(chart.meta.title)}.json`,
  )
}
