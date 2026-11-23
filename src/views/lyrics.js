import { h } from '../dom.js'
import { transposeText, transposePlan } from '../music/transpose.js'
import { labelForType } from '../music/parseLyrics.js'

const CHORD_SPLIT = /(\[[^\]]+\])/g

export function planFor(song, targetKey) {
  return transposePlan(song?.originalKey || '', targetKey || song?.originalKey || '')
}

function displayLines(lines) {
  const out = []
  let pendingBreak = false
  for (const raw of lines || []) {
    let line = String(raw || '').trim()
    if (!line || /^-+$/.test(line)) {
      if (out.length) pendingBreak = true
      continue
    }
    line = line.replace(/^\/\/\s*/, '').replace(/\/\/$/, '').trim()
    if (!line) {
      if (out.length) pendingBreak = true
      continue
    }
    if (pendingBreak) {
      out.push({ break: true })
      pendingBreak = false
    }
    out.push(line)
  }
  return out
}

export function renderLyrics(song, opts = {}) {
  const lang = opts.lang || 'both'
  const layout = opts.layout || (lang === 'both' ? 'side' : 'stack')
  const showChords = opts.showChords !== false
  const steps = opts.steps || 0
  const useFlats = !!opts.useFlats
  const wrap = h('div', { class: 'lyrics' })
  for (const section of song.sections || []) {
    wrap.append(renderSection(section, { lang, layout, showChords, steps, useFlats }))
  }
  if (!wrap.childElementCount) wrap.append(h('p', { class: 'muted' }, '—'))
  return wrap
}

function renderSection(section, opts) {
  const el = h('section', { class: 'section' })
  const label = section.label || labelForType(section.type)
  if (label || section.notes) {
    el.append(
      h('div', { class: 'section-label' },
        label || '',
        section.notes ? h('span', { class: 'section-notes' }, section.notes) : null
      )
    )
  }
  const es = displayLines(section.linesEs || [])
  const en = displayLines(section.linesEn || [])
  const showEs = (opts.lang === 'es' || opts.lang === 'both') && es.some((l) => l && !l.break)
  const showEn = (opts.lang === 'en' || opts.lang === 'both') && en.some((l) => l && !l.break)
  if (opts.lang === 'both' && showEs && showEn && opts.layout !== 'stack') {
    el.append(
      h('div', { class: 'side-by-side' },
        block('ES', es, opts),
        block('EN', en, opts)
      )
    )
  } else {
    if (showEs) el.append(block(opts.lang === 'both' && showEn ? 'ES' : '', es, opts))
    if (showEn) el.append(block(opts.lang === 'both' && showEs ? 'EN' : '', en, opts))
    if (!showEs && !showEn) {
      // fall back to whichever exists
      if (es.some(Boolean)) el.append(block('', es, opts))
      else if (en.some(Boolean)) el.append(block('', en, opts))
    }
  }
  return el
}

function block(tag, lines, opts) {
  const b = h('div', { class: 'lyric-block' })
  if (tag) b.append(h('div', { class: 'lang-tag' }, tag))
  for (const line of lines) {
    if (line && line.break) b.append(h('div', { class: 'stanza-break' }))
    else b.append(renderLine(line, opts))
  }
  return b
}

export function renderLine(line, opts) {
  const text = transposeText(line || '', opts.steps || 0, opts.useFlats)
  if (!opts.showChords) {
    return h('p', { class: 'lyric-line' }, text.replace(/\[([^\]]+)\]/g, ''))
  }
  if (!/\[/.test(text)) return h('p', { class: 'lyric-line' }, text)
  const parts = text.split(CHORD_SPLIT)
  const chords = []
  const lyrics = []
  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      chords.push(part.slice(1, -1))
      if (lyrics.length === chords.length) lyrics.push('')
    } else {
      if (chords.length === lyrics.length) chords.push('')
      lyrics.push(part)
    }
  }
  while (chords.length < lyrics.length) chords.push('')
  while (lyrics.length < chords.length) lyrics.push('')
  const cols = parts.length || 1
  const template = chords.map((_, i) => {
    const w = Math.max(chords[i].length, (lyrics[i] || '').length, 1)
    return `${Math.max(w, 1)}ch`
  }).join(' ')
  return h('div', { class: 'chord-pair' },
    h('div', { class: 'chord-row', style: { gridTemplateColumns: template } },
      ...chords.map((c) => h('span', {}, c || ' '))
    ),
    h('div', { class: 'lyric-row', style: { gridTemplateColumns: template } },
      ...lyrics.map((c) => h('span', {}, c || ' '))
    )
  )
}

export function sectionsToPaste(sections, lang) {
  const lines = []
  for (const s of sections || []) {
    if (s.label || s.notes) lines.push([s.label, s.notes].filter(Boolean).join(' — '))
    const arr = lang === 'en' ? s.linesEn : s.linesEs
    if (arr?.length) lines.push(...arr, '')
  }
  return lines.join('\n').trim()
}

export function buildSectionsFromPaste(esText, enText) {
  // Keep edit simple: one block per language, plus detect section headers when possible
  const { parseSongsFromText } = arguments.callee // placeholder, imported in editor
  return { esText, enText }
}
