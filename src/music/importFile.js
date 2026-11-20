import { parseSongsFromText } from './parseLyrics.js'

let pdfjsReady = null

async function loadPdfjs() {
  if (pdfjsReady) return pdfjsReady
  pdfjsReady = (async () => {
    const pdfjs = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return pdfjsReady
}

export async function extractTextFromFile(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text')) {
    return { text: await file.text(), kind: 'text' }
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const buf = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer: buf })
    return { text: result.value || '', kind: 'docx' }
  }
  if (name.endsWith('.pdf')) {
    const text = await extractPdfText(await file.arrayBuffer())
    return { text, kind: 'pdf' }
  }
  if (name.endsWith('.doc')) {
    throw new Error('Please save Word files as .docx (or export a PDF / copy the text).')
  }
  // Unknown: try text
  const asText = await file.text()
  if (asText && !asText.includes('\0')) return { text: asText, kind: 'text' }
  throw new Error(`Unsupported file type: ${file.name}`)
}

function isHeadingColor(r, g, b) {
  // Red titles / section labels used in CUPC Google Docs, or blue title links
  if (r > 120 && r > g * 1.8 && r > b * 1.8) return 'red'
  if (b > 120 && b > r * 1.6 && b > g * 1.2) return 'blue'
  return null
}

async function extractPdfText(data) {
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data }).promise
  const parts = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent({ includeMarkedContent: false })
    const scale = 2
    const viewport = page.getViewport({ scale })
    let colors = null
    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      await page.render({ canvasContext: ctx, viewport }).promise
      colors = ctx
    } catch {
      colors = null
    }

    // Group items into lines by Y
    const items = content.items.filter((it) => it && typeof it.str === 'string')
    const lines = []
    for (const it of items) {
      const tr = it.transform || [1, 0, 0, 1, 0, 0]
      const x = tr[4]
      const y = Math.round(tr[5] * 2) / 2
      let line = lines.find((l) => Math.abs(l.y - y) < 3)
      if (!line) {
        line = { y, items: [] }
        lines.push(line)
      }
      let heading = null
      if (colors) {
        const [vx, vy] = viewport.convertToViewportPoint(tr[4], tr[5] + (it.height || 8) * 0.4)
        const px = Math.max(0, Math.min(colors.canvas.width - 1, Math.round(vx + 2)))
        const py = Math.max(0, Math.min(colors.canvas.height - 1, Math.round(vy)))
        try {
          const d = colors.getImageData(px, py, 1, 1).data
          heading = isHeadingColor(d[0], d[1], d[2])
        } catch {
          heading = null
        }
      }
      line.items.push({ x, str: it.str, heading })
    }
    lines.sort((a, b) => b.y - a.y)
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x)
      const text = line.items
        .map((i) => i.str)
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim()
      if (!text) continue
      const heading = line.items.some((i) => i.heading)
      // Don't mark obvious section labels as song titles; the parser already reads them.
      const isSection = /^(verse|verso|estrofa|chorus|chorous|coro|bridge|puente|pre-?coro|pre-?chorus|tag|intro|outro)\b/i.test(text)
      if (heading && !isSection) parts.push('::TITLE:: ' + text)
      else parts.push(text)
    }
    parts.push('')
  }
  return parts.join('\n')
}

export async function importFilesToSongs(fileList) {
  const files = Array.from(fileList || [])
  const results = []
  for (const file of files) {
    try {
      const { text, kind } = await extractTextFromFile(file)
      const songs = parseSongsFromText(text).map((s) => ({
        ...s,
        notes: s.notes || `Imported from ${file.name}`,
        sourceFile: file.name
      }))
      results.push({ file: file.name, kind, text, songs, error: null })
    } catch (err) {
      results.push({ file: file.name, kind: null, text: '', songs: [], error: err.message || String(err) })
    }
  }
  return results
}
