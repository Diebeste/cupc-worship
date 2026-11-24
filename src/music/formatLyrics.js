/** Format pasted, typed, or imported lyrics into the library's v10 style.
 *  Reuses parseLyrics + cleanSong. Does not translate or invent lyrics.
 */

import { parseSongsFromText, parseSongChunk, songToPlainText, labelForType } from './parseLyrics.js'
import { cleanSong, parseLooseHeader, tidyLyricLine } from './cleanLibrarySong.js'
import { parseImportedSongs } from './videopsalm.js'

const CHORD_TOKEN = /^[A-G](?:#|b|♯|♭)?(?:m|min|maj|M|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G](?:#|b|♯|♭)?)?$/
const SHORT_HEADER = /^(?:\[)?\s*(V|C|B|P|PC|T|I|O|E)(?:\s*[-.]?\s*(\d+))?\s*(?:\])?\s*[:.]?\s*$/i
const SHORT_TYPE = {
  v: 'Verse',
  c: 'Chorus',
  b: 'Bridge',
  p: 'Pre-Chorus',
  pc: 'Pre-Chorus',
  t: 'Tag',
  i: 'Intro',
  o: 'Outro',
  e: 'Outro'
}

const META_LINE = /^(?:CCLI\s*(?:Song|License|#|No\.?)?\s*#?\s*\d+|©|\(c\)|copyright\b|all rights reserved|used by permission|for use solely|www\.(?:songselect|ccli|praisecharts)\b|written by\b|words(?:\s+and|\s*&\s*)music\b|letra y m[uú]sica\b|autor(?:es)?\b|compositor(?:es)?\b|published by\b|tone\s*[:]|key\s*:\s*[A-G]|bpm\s*:\s*\d|tempo\s*:\s*\d)/i

const WRITER_LINE = /^(?=.{3,80}$)[A-ZÁÉÍÓÚÑ][\p{L}.'’\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}.'’\-]+){0,3}(?:\s*[|/&,]\s*[A-ZÁÉÍÓÚÑ][\p{L}.'’\-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}.'’\-]+){0,3})+$/u

function expandTabs(line, tabSize = 4) {
  let out = ''
  for (const ch of String(line || '')) {
    if (ch === '\t') out += ' '.repeat(tabSize - (out.length % tabSize))
    else out += ch
  }
  return out
}

function isChordToken(t) {
  return CHORD_TOKEN.test(t) || t === 'N.C.' || t === 'NC'
}

export function looksLikeChordLine(line) {
  const raw = String(line || '').replace(/[|]/g, ' ').trim()
  if (!raw) return false
  const tokens = raw.split(/\s+/)
  const ok = tokens.filter((t) => isChordToken(t))
  return ok.length > 0 && ok.length >= Math.ceil(tokens.length * 0.7)
}

export function injectChords(chordLine, lyricLine) {
  const chords = expandTabs(chordLine)
  const lyrics = expandTabs(lyricLine)
  const placements = []
  const re = /\S+/g
  let m
  while ((m = re.exec(chords))) {
    if (isChordToken(m[0])) placements.push({ col: m.index, chord: m[0] })
  }
  if (!placements.length) return lyrics.replace(/[ \t]+$/, '')
  const snapToWordStart = (col) => {
    let i = Math.max(0, Math.min(col, lyrics.length))
    if (i > 0 && i < lyrics.length && /\S/.test(lyrics[i]) && /\S/.test(lyrics[i - 1])) {
      while (i > 0 && /\S/.test(lyrics[i - 1])) i--
    }
    return i
  }
  let out = ''
  let li = 0
  for (const p of placements) {
    const col = snapToWordStart(p.col)
    if (li < col) {
      if (col <= lyrics.length) {
        out += lyrics.slice(li, col)
        li = col
      } else {
        out += lyrics.slice(li)
        li = lyrics.length
        if (!out.endsWith(' ')) out += ' '
      }
    }
    out += `[${p.chord}]`
  }
  out += lyrics.slice(li)
  return out.replace(/[ \t]+$/, '')
}

export function mergeChordOverLyric(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const next = lines[i + 1]
    const trimmed = tidyLyricLine(raw)
    const nextTrim = next == null ? '' : tidyLyricLine(next)
    const nextIsHeader = !!(nextTrim && (parseLooseHeader(nextTrim) || expandShortHeader(nextTrim) !== nextTrim))
    if (
      looksLikeChordLine(raw) &&
      next != null &&
      nextTrim &&
      !looksLikeChordLine(next) &&
      !nextIsHeader &&
      !isMetaLine(nextTrim)
    ) {
      out.push(injectChords(raw, next))
      i += 1
    } else {
      out.push(raw)
    }
  }
  return out.join('\n')
}

export function expandShortHeader(line) {
  const t = tidyLyricLine(line)
  const m = t.match(SHORT_HEADER)
  if (!m) return line
  const key = m[1].toLowerCase()
  const label = SHORT_TYPE[key]
  if (!label) return line
  const num = m[2] ? ` ${parseInt(m[2], 10)}` : ''
  return label + num
}

function isMetaLine(line) {
  const t = tidyLyricLine(line)
  if (!t) return false
  return META_LINE.test(t)
}

function isWriterLine(line) {
  const t = tidyLyricLine(line)
  if (!t || isMetaLine(t) || parseLooseHeader(t) || looksLikeChordLine(t)) return false
  if (/[¿¡?]/.test(t) || t.split(/\s+/).length > 8) return false
  return WRITER_LINE.test(t) && /[|/]/.test(t)
}

function looksLikeJson(text) {
  const t = String(text || '').trim()
  if (t.startsWith('{')) return true
  if (t.startsWith('[')) {
    const next = t.slice(1).trimStart()
    return next.startsWith('{') || next.startsWith('[') || next.startsWith('"')
  }
  return false
}


function rewriteLangTags(text) {
  const lines = String(text || '').split('\n')
  if (!lines.some((l) => /^\s*\[(EN|ES)\]\s*$/i.test(l))) return text

  const preamble = []
  const en = []
  const es = []
  let lang = null
  let label = ''
  let started = false

  const lastContent = (bucket) => {
    for (let i = bucket.length - 1; i >= 0; i--) {
      if (String(bucket[i] || '').trim()) return bucket[i].trim()
    }
    return ''
  }
  const pushLabel = (bucket) => {
    if (!label) return
    if (lastContent(bucket) === label) return
    if (bucket.length && bucket[bucket.length - 1] !== '') bucket.push('')
    bucket.push(label)
  }

  for (const raw of lines) {
    const trimmed = raw.trim()
    const tag = trimmed.match(/^\[(EN|ES)\]$/i)
    if (tag) {
      started = true
      lang = tag[1].toUpperCase() === 'ES' ? 'es' : 'en'
      pushLabel(lang === 'es' ? es : en)
      continue
    }
    if (parseLooseHeader(trimmed)) {
      started = true
      label = trimmed
      if (lang) pushLabel(lang === 'es' ? es : en)
      continue
    }
    if (!started) {
      if (trimmed || preamble.length) preamble.push(raw)
      continue
    }
    if (lang === 'es') es.push(raw)
    else if (lang === 'en') en.push(raw)
  }

  const bodyEn = en.join('\n').trim()
  const bodyEs = es.join('\n').trim()
  const head = preamble.join('\n').trim()
  const parts = []
  if (head) parts.push(head)
  if (bodyEs && bodyEn) parts.push(bodyEs, '-----', bodyEn)
  else if (bodyEs) parts.push(bodyEs)
  else if (bodyEn) parts.push(bodyEn)
  else return text
  return parts.join('\n\n') + '\n'
}

export function preprocessPastedText(rawText) {
  const source = String(rawText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ')
  const meta = { artist: '', notes: '', originalKey: '', bpm: '' }
  if (!source.trim()) return { text: '', meta }
  if (looksLikeJson(source)) return { text: source, meta }

  const merged = mergeChordOverLyric(source)
  const out = []
  const noteParts = []
  for (const line of merged.split('\n')) {
    const trimmed = tidyLyricLine(line)
    if (!trimmed) {
      out.push('')
      continue
    }
    const keyLine = trimmed.match(/^(?:key|tono)\s*:\s*([A-G][#b♯♭]?(?:m|min)?)\s*$/i)
    if (keyLine) {
      if (!meta.originalKey) meta.originalKey = keyLine[1]
      continue
    }
    const bpmLine = trimmed.match(/^(?:bpm|tempo)\s*:\s*(\d{2,3})\s*$/i)
    if (bpmLine) {
      if (!meta.bpm) meta.bpm = bpmLine[1]
      continue
    }
    if (isMetaLine(trimmed)) {
      noteParts.push(trimmed)
      continue
    }
    if (isWriterLine(trimmed)) {
      if (!meta.artist) meta.artist = trimmed.replace(/\s*[|/]\s*/g, ', ')
      else noteParts.push(trimmed)
      continue
    }
    const expanded = expandShortHeader(line)
    out.push(expanded)
  }
  if (noteParts.length) meta.notes = noteParts.join('\n')
  return { text: rewriteLangTags(out.join('\n')), meta }
}

export function mergeEditorSections(esText, enText) {
  const esSecs = parseSongChunk({ title: 'x', key: '', body: String(esText || '').split('\n') }).sections
  const enSecs = parseSongChunk({ title: 'x', key: '', body: String(enText || '').split('\n') }).sections
  const n = Math.max(esSecs.length, enSecs.length, 1)
  const out = []
  for (let i = 0; i < n; i++) {
    const es = esSecs[i]
    const en = enSecs[i]
    out.push({
      type: (es && es.type !== 'verse' ? es.type : null) || (en && en.type !== 'verse' ? en.type : null) || 'verse',
      label: es?.label || en?.label || '',
      notes: [es?.notes, en?.notes].filter(Boolean).join(' · '),
      linesEs: es ? (es.linesEs?.some(Boolean) ? es.linesEs : es.linesEn) : [],
      linesEn: en ? (en.linesEn?.some(Boolean) ? en.linesEn : en.linesEs) : []
    })
  }
  return out.filter((s) => s.linesEn?.some(Boolean) || s.linesEs?.some(Boolean) || s.notes)
}


function recoverSectionHeaders(song, before) {
  const sections = (song.sections || []).map((s, i) => {
    const prev = (before?.sections || [])[i] || {}
    const parsedList = [s.label, prev.label].map((l) => parseLooseHeader(l)).filter(Boolean)
    const parsed = parsedList.find((p) => p.notes) || parsedList[0] || null
    let type = s.type || prev.type || 'verse'
    let label = s.label || prev.label || ''
    let notes = s.notes || prev.notes || ''
    if (parsed) {
      type = type && type !== 'verse' ? type : parsed.type
      label = parsed.label || label
      notes = notes || parsed.notes || ''
    }
    if (!label && type && type !== 'verse') label = labelForType(type)
    return { ...s, type, label, notes }
  })
  return { ...song, sections }
}

function applyClean(parsed, opts = {}) {
  const meta = opts.meta || {}
  const title = (opts.isFirst && opts.title && String(opts.title).trim()) || parsed.title || ''
  const originalKey = (opts.isFirst && opts.originalKey) || parsed.originalKey || meta.originalKey || ''
  const artist = (opts.isFirst && opts.artist && String(opts.artist).trim()) || parsed.artist || meta.artist || ''
  const notes = [opts.isFirst ? opts.notes : '', parsed.notes, meta.notes].filter((n) => String(n || '').trim()).join('\n')
  const raw = {
    id: parsed.id || null,
    title,
    artist,
    originalKey,
    bpm: parsed.bpm || meta.bpm || '',
    notes,
    sections: parsed.sections || []
  }
  const before = {
    title: raw.title || '',
    artist: raw.artist || '',
    sections: JSON.parse(JSON.stringify(raw.sections || []))
  }
  const res = cleanSong(raw, { library: opts.library || [] })
  const cleaned = recoverSectionHeaders(res.song, raw)
  return {
    ...parsed,
    ...cleaned,
    ccli: parsed.ccli,
    sourceFile: parsed.sourceFile,
    sourceIndex: parsed.sourceIndex,
    _formatFlags: res.flags || [],
    _formatAction: res.action,
    _formatChanges: res.changes || [],
    _formatted: changedFrom(before, cleaned)
  }
}

function changedFrom(before, after) {
  return (before.title || '') !== (after.title || '')
    || (before.artist || '') !== (after.artist || '')
    || JSON.stringify(before.sections || []) !== JSON.stringify(after.sections || [])
}

function sectionsChanged(a, b) {
  return JSON.stringify(a.sections || []) !== JSON.stringify(b.sections || [])
}

function normalizeForCompare(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function markTextFormatting(songs, sourceText) {
  const src = normalizeForCompare(sourceText)
  return (songs || []).map((s) => {
    if (!s || s._formatted) return s
    return { ...s, _formatted: normalizeForCompare(previewPlain(s)) !== src }
  })
}

export function formatSongsFromText(rawText, opts = {}) {
  const sourceText = String(rawText || '')
  if (!sourceText.trim()) return { songs: [], meta: {}, sourceText }
  const { text, meta } = preprocessPastedText(sourceText)
  let parsed = []
  if (opts.allowVideoPsalm) {
    try {
      const vp = parseImportedSongs(text)
      if (vp && vp.length) parsed = vp
    } catch {
      /* fall through to lyric parse */
    }
  }
  if (!parsed.length) parsed = parseSongsFromText(text)
  if (!parsed.length && text.trim()) {
    const one = parseSongChunk({
      title: opts.title || '',
      key: opts.originalKey || meta.originalKey || '',
      body: text.split('\n')
    })
    parsed = [{ ...one, artist: '', notes: '', bpm: '', sourceIndex: 0 }]
  }
  let songs = parsed.map((p, i) => applyClean(p, { ...opts, meta, isFirst: i === 0 }))
  if (!looksLikeJson(sourceText)) songs = markTextFormatting(songs, sourceText)
  return { songs, meta, sourceText }
}

export function formatEditorLyrics({ esText = '', enText = '', title = '', originalKey = '', artist = '', notes = '', library = [] } = {}) {
  const esPrep = preprocessPastedText(esText)
  const enPrep = preprocessPastedText(enText)
  const sections = mergeEditorSections(esPrep.text, enPrep.text)
  const raw = {
    title,
    originalKey,
    artist: artist || esPrep.meta.artist || enPrep.meta.artist || '',
    bpm: esPrep.meta.bpm || enPrep.meta.bpm || '',
    notes: [notes, esPrep.meta.notes, enPrep.meta.notes].filter(Boolean).join('\n'),
    sections
  }
  const res = cleanSong(raw, { library })
  const cleaned = recoverSectionHeaders(res.song, raw)
  const song = {
    ...cleaned,
    _formatFlags: res.flags || [],
    _formatAction: res.action,
    _formatChanges: res.changes || [],
    _formatted: sectionsChanged(raw, cleaned) || raw.title !== cleaned.title || (raw.artist || '') !== (cleaned.artist || '')
  }
  return { song, flags: res.flags || [], meta: { ...esPrep.meta, ...enPrep.meta } }
}

export function formatImportedSongs(songs, opts = {}) {
  return (songs || []).map((s, i) => applyClean(s, { ...opts, isFirst: i === 0 }))
}

export function stripFormatMeta(song) {
  if (!song || typeof song !== 'object') return song
  const {
    _formatFlags,
    _formatAction,
    _formatChanges,
    _formatted,
    existing,
    sourceIndex,
    ...rest
  } = song
  return rest
}

export function formatSummary(songs) {
  const list = songs || []
  const formatted = list.filter((s) => s && s._formatted).length
  return { total: list.length, formatted, unchanged: list.length - formatted }
}

export function previewPlain(song) {
  return songToPlainText(song, { lang: 'both', chords: true })
}

export { songToPlainText, labelForType }
