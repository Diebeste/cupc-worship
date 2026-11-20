import { displayKey, transposePlan, transposeText } from './transpose.js'
import { labelForType } from './parseLyrics.js'
import { rolesTextLines } from '../data/roles.js'

export function serviceWhatsAppText(service, songsById, { lang = 'both' } = {}) {
  const date = service.date ? formatDate(service.date) : ''
  const header = [service.name, date, typeLabel(service.type), service.subtitle]
    .filter(Boolean)
    .join(' · ')
  const lines = [`*${header}*`, '']
  lines.push(...rolesTextLines(service).map((l) => l), '')
  ;(service.items || []).forEach((item, i) => {
    const song = songsById[item.songId]
    const title = song?.title || '—'
    const key = item.key || song?.originalKey || ''
    const lead = item.lead ? `  (${item.lead})` : ''
    lines.push(`${i + 1}. ${title}${key ? ` — ${key}` : ''}${lead}`)
  })
  if (service.notes) {
    lines.push('', service.notes)
  }
  lines.push('')
  for (const item of service.items || []) {
    const song = songsById[item.songId]
    if (!song) continue
    const key = item.key || song.originalKey || ''
    const plan = transposePlan(song.originalKey, key)
    lines.push('────────')
    lines.push(`*${song.title}*${key ? ` (${key})` : ''}`)
    lines.push('')
    lines.push(renderSongPlain(song, { lang, steps: plan.steps, useFlats: plan.useFlats }))
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

export function renderSongPlain(song, { lang = 'both', steps = 0, useFlats = false } = {}) {
  const out = []
  for (const s of song.sections || []) {
    const label = [s.label || labelForType(s.type), s.notes].filter(Boolean).join(' — ')
    if (label) out.push(label)
    const es = (s.linesEs || []).map((l) => transposeText(l, steps, useFlats))
    const en = (s.linesEn || []).map((l) => transposeText(l, steps, useFlats))
    if ((lang === 'es' || lang === 'both') && es.some(Boolean)) {
      if (lang === 'both' && en.some(Boolean)) out.push('[ES]')
      out.push(...es)
    }
    if ((lang === 'en' || lang === 'both') && en.some(Boolean)) {
      if (lang === 'both' && es.some(Boolean)) {
        out.push('')
        out.push('[EN]')
      }
      out.push(...en)
    }
    out.push('')
  }
  return out.join('\n').trim()
}

export function encodeSharePayload(service, songs) {
  const payload = {
    v: 1,
    service: {
      name: service.name,
      date: service.date,
      type: service.type,
      leader: service.leader,
      voices: service.voices,
      instruments: service.instruments,
      ujier: service.ujier,
      subtitle: service.subtitle,
      schedulePin: service.schedulePin,
      notes: service.notes,
      items: service.items
    },
    songs
  }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSharePayload(token) {
  try {
    const pad = token.length % 4 === 0 ? '' : '='.repeat(4 - (token.length % 4))
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/') + pad
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function typeLabel(type) {
  return { sunday: 'Sunday', thursday: 'Thursday', event: 'Event', service: 'Service', adhoc: 'Service' }[type] || type || ''
}

export function formatDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y) return iso
  try {
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return iso
  }
}

export { displayKey }
