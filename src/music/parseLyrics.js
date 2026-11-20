/** Parse pasted or imported lyric documents into songs with sections and EN/ES lyrics. */

import { parseKey } from './transpose.js'

const SECTION_ALIASES = {
  verse: 'verse',
  'verse i': 'verse',
  'verse ii': 'verse',
  'verse iii': 'verse',
  verso: 'verse',
  estrofa: 'verse',
  chorus: 'chorus',
  chorous: 'chorus',
  coro: 'chorus',
  bridge: 'bridge',
  puente: 'bridge',
  'pre-chorus': 'prechorus',
  'pre-chorous': 'prechorus',
  'pre chorus': 'prechorus',
  prechorus: 'prechorus',
  'pre-coro': 'prechorus',
  'pre coro': 'prechorus',
  precoro: 'prechorus',
  tag: 'tag',
  intro: 'intro',
  outro: 'outro',
  ending: 'outro',
  instrumental: 'instrumental',
  interlude: 'instrumental',
  vamp: 'tag',
  hook: 'chorus',
  coda: 'outro',
  final: 'outro',
  'sin instrumentos': 'tag',
  comienzo: 'intro',
  'segunda parte': 'other'
}

const SECTION_RE =
  /^(verse|verso|estrofa|chorus|chorous|coro|bridge|puente|pre[-\s]?chorus|pre[-\s]?chorous|pre[-\s]?coro|prechorus|precoro|tag|intro|outro|ending|instrumental|interlude|vamp|hook|coda|final|sin instrumentos|comienzo|segunda parte)(?:\s*([IVX0-9]+))?(?:\s*[:.\-–—]\s*(.*))?$/i

const TITLE_KEY_RE =
  /^(.{2,90}?)\s*[\(（]\s*([A-G][#b♯♭]?(?:m|min)?|FA|SOL|LA|MI|RE|DO|SI)\s*[\)）]\s*\.?$/i

const TITLE_SOLFEGE_RE = /^(.{2,90}?)\s+(FA|SOL|LA|MI|RE|DO|SI)\s*$/

const DIVIDER_RE = /^[\s]*[-_—–−=.─―‐]{2,}[>\s]*$/

const TABLE_HEADERS = /^(canci[oó]n|nota|lead|song|key)$/i

const SKIP_TITLES = /^(jueves ac[uú]stico|semana de alabanza|comienzo|segunda parte|cupc|mississauga)$/i

const ES_HINTS =
  /\b(el|la|los|las|de|del|que|y|en|un|una|por|con|mi|tu|su|te|me|al|se|es|no|yo|tú|ti|señor|dios|jesús|cristo|amor|coraz[oó]n|gloria|alabanza|coro|verso|estrofa|puente|digno|santo|nombre|vida|hoy|para|como|eres|todo|ante|sin|mi|tus|sus|una|unos|porque|cuando|donde|cómo|más|también|este|esta)\b/gi
const EN_HINTS =
  /\b(the|and|you|your|to|of|in|my|me|is|it|for|with|that|this|are|be|we|our|i|how|lord|jesus|christ|love|glory|chorus|verse|bridge|holy|name|heart|come|give|there|when|from|will|not|but|one|without|him|his|her|us|was|have|has|been|can|can't|cannot|oh|all|so)\b/gi

function cleanLine(s) {
  return String(s)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/[●•▪︎]/g, '')
    .replace(/[⬆️⬇️↗️➡️↑↓➡︎⬆︎⬇︎↗]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function looksLikeChordLine(line) {
  const raw = line.replace(/[|]/g, ' ').trim()
  if (!raw) return false
  const tokens = raw.split(/\s+/)
  if (!tokens.length) return false
  const chord = /^[A-G](?:#|b|♯|♭)?(?:m|min|maj|M|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G](?:#|b|♯|♭)?)?$/
  const ok = tokens.filter((t) => chord.test(t) || t === 'N.C.' || t === 'NC')
  return ok.length >= Math.ceil(tokens.length * 0.7)
}

function wrapChordsIfBare(line) {
  if (!looksLikeChordLine(line)) return line
  return line
    .split(/(\s+)/)
    .map((t) => (/^[A-G]/.test(t) ? `[${t}]` : t))
    .join('')
}

function sectionTypeFrom(label) {
  const base = label.toLowerCase().replace(/\s+/g, ' ').trim()
  const noNum = base.replace(/\s+[ivx0-9]+$/, '').trim()
  if (SECTION_ALIASES[base]) return SECTION_ALIASES[base]
  if (SECTION_ALIASES[noNum]) return SECTION_ALIASES[noNum]
  const key = Object.keys(SECTION_ALIASES).find((k) => base.startsWith(k))
  return key ? SECTION_ALIASES[key] : 'other'
}

function detectLang(text) {
  const es = (text.match(ES_HINTS) || []).length
  const en = (text.match(EN_HINTS) || []).length
  if (es >= en + 2) return 'es'
  if (en >= es + 2) return 'en'
  if (es > en) return 'es'
  if (en > es) return 'en'
  return 'unknown'
}

function parseSectionHeader(line) {
  const cleaned = cleanLine(line).replace(/\/+/g, '').trim()
  const m = cleaned.match(SECTION_RE)
  if (!m) return null
  const type = sectionTypeFrom(m[1])
  const num = m[2] ? ` ${m[2].toUpperCase()}` : ''
  const notes = (m[3] || '').trim()
  const prettyType = {
    verse: 'Verse',
    chorus: 'Chorus',
    bridge: 'Bridge',
    prechorus: 'Pre-Chorus',
    tag: 'Tag',
    intro: 'Intro',
    outro: 'Outro',
    instrumental: 'Instrumental',
    other: m[1]
  }[type] || m[1]
  return { type, label: (prettyType + num).trim(), notes }
}

function parseTitleKey(line) {
  let raw = String(line || '')
  const forced = /^::TITLE::\s*/.test(raw)
  raw = raw.replace(/^::TITLE::\s*/, '')
  const s = cleanLine(raw)
  if (!s || s.length > 90) return forced ? { title: tidyTitle(s) || s, key: '', forced: true } : null
  if (forced) {
    const inner = s.match(TITLE_KEY_RE) || s.match(TITLE_SOLFEGE_RE)
    if (inner) return { title: tidyTitle(inner[1]), key: parseKey(inner[2]) || inner[2], forced: true }
    return { title: tidyTitle(s), key: '', forced: true }
  }
  let m = s.match(TITLE_KEY_RE)
  if (m && !SECTION_RE.test(m[1]) && !TABLE_HEADERS.test(m[1])) {
    return { title: tidyTitle(m[1]), key: parseKey(m[2]) || m[2] }
  }
  m = s.match(TITLE_SOLFEGE_RE)
  if (m && !SECTION_RE.test(m[1])) {
    return { title: tidyTitle(m[1]), key: parseKey(m[2]) }
  }
  return null
}

function tidyTitle(t) {
  return t
    .replace(/[.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .replace(/^(canci[oó]n)\s+/i, '')
    .trim()
}

function isTableNoise(line, next) {
  const s = cleanLine(line)
  if (TABLE_HEADERS.test(s)) return true
  if (/canci[oó]n\b/i.test(s) && /\bnota\b/i.test(s)) return true
  if (/^song\b/i.test(s) && /\bkey\b/i.test(s)) return true
  // setlist table row: "Song title    C" or "Song title    G#"
  if (/^.{2,50}?\s+([A-G](?:#|b|♯|♭)?)\s*$/.test(s) && !/[,(]/.test(s) && s.split(/\s+/).length <= 8) {
    return true
  }
  if (/^([A-G][#b]?)(?:\s+[A-G][#b]?)?$/.test(s) && next && parseTitleKey(next)) return true
  return false
}



function looksLikeKeylessTitle(line, lines, i, current) {
  const forced = /^::TITLE::/.test(String(line || ''))
  const s = cleanLine(String(line || '').replace(/^::TITLE::\s*/, ''))
  if (forced && s && !parseSectionHeader(s) && !SKIP_TITLES.test(s) && !isTableNoise(s, lines[i + 1])) {
    return true
  }
  if (!s || s.length < 4 || s.length > 50) return false
  if (parseSectionHeader(s) || looksLikeChordLine(s)) return false
  if (SKIP_TITLES.test(s) || TABLE_HEADERS.test(s)) return false
  let next = ''
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j]) { next = lines[j].replace(/^::TITLE::\s*/, ''); break }
  }
  const nextIsHeader = next && !!parseSectionHeader(next)
  const words = s.split(/\s+/)
  const allCaps = s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s) && words.length >= 2
  // Mid-document keyless titles must be a heading, not a lyric line:
  //  - ALL CAPS headings, or
  //  - 2–6 Title-Case words immediately followed by a section header
  const titleCase = /^([A-ZÁÉÍÓÚÑ][\p{L}'’]*)([ -][A-ZÁÉÍÓÚÑ][\p{L}'’]*)+$/u.test(s)
  const small = words.filter((w) => /^(the|and|of|to|a|in|el|la|de|del|que|y|en|un|con|por|mi|tu|i|you|me)$/i.test(w)).length
  if (small >= 1 && !allCaps) return false
  if (!current) {
    return allCaps || nextIsHeader || (titleCase && words.length >= 2 && words.length <= 6)
  }
  const bodyLen = current.body.filter(Boolean).length
  if (bodyLen < 4) return false
  if (nextIsHeader && (allCaps || titleCase) && words.length >= 2 && words.length <= 8) return true
  if (allCaps && words.length >= 2 && words.length <= 6) return true
  return false
}

/**
 * Split a multi-song document into raw song chunks { title, key, body }.
 */
export function splitSongs(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n').replace(/\f/g, '\n')
  const lines = text.split('\n').map(cleanLine)

  const chunks = []
  let current = null

  const startSong = (title, key, extraLine) => {
    if (current && (current.body.some(Boolean) || current.title)) chunks.push(current)
    current = { title, key: key || '', body: [] }
    if (extraLine) current.body.push(extraLine)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) {
      if (current) current.body.push('')
      continue
    }
    if (SKIP_TITLES.test(line) && !current) continue
    if (isTableNoise(line, lines[i + 1])) continue

    const tk = parseTitleKey(line)
    if (tk && !parseSectionHeader(line)) {
      startSong(tk.title, tk.key)
      continue
    }

    // Title-case or ALL CAPS heading (no key). Used at the start of a document
    // and mid-document when the current song already has a body.
    if (looksLikeKeylessTitle(line, lines, i, current)) {
      startSong(tidyTitle(line), '')
      continue
    }

    // A mid-document title with key always starts a new song
    if (current && tk && !parseSectionHeader(line)) {
      startSong(tk.title, tk.key)
      continue
    }

    if (!current) current = { title: '', key: '', body: [] }
    current.body.push(line)
  }
  if (current && (current.body.some(Boolean) || current.title)) chunks.push(current)

  // Re-walk: title-key lines that appeared after we already had a current song
  // are handled above only if parseTitleKey at start. Mid-song titles:
  return resplitOnTitleKeys(chunks)
}

function resplitOnTitleKeys(chunks) {
  const out = []
  for (const ch of chunks) {
    const lines = ch.body
    let cur = { title: ch.title, key: ch.key, body: [] }
    let started = !!ch.title
    for (const line of lines) {
      const tk = line && parseTitleKey(line)
      if (tk && !parseSectionHeader(line) && (started || cur.body.some(Boolean))) {
        if (cur.title || cur.body.some(Boolean)) out.push(cur)
        cur = { title: tk.title, key: tk.key, body: [] }
        started = true
        continue
      }
      cur.body.push(line)
    }
    if (cur.title || cur.body.some(Boolean)) out.push(cur)
  }
  return out.filter((c) => c.title || c.body.filter(Boolean).join(' ').length > 20)
}

function blocksByDivider(lines) {
  const blocks = []
  let cur = []
  for (const line of lines) {
    if (DIVIDER_RE.test(line) || /^[.]{6,}$/.test(line)) {
      blocks.push(cur)
      cur = []
    } else cur.push(line)
  }
  blocks.push(cur)
  return blocks.map((b) => {
    // trim leading/trailing blanks
    while (b.length && !b[0]) b.shift()
    while (b.length && !b[b.length - 1]) b.pop()
    return b
  }).filter((b) => b.some(Boolean))
}

function parseBlockSections(lines) {
  const sections = []
  let current = { type: 'verse', label: '', notes: '', lines: [] }
  const push = () => {
    const cleaned = current.lines.map(wrapChordsIfBare)
    // drop trailing blanks
    while (cleaned.length && !cleaned[cleaned.length - 1]) cleaned.pop()
    if (cleaned.some(Boolean) || current.notes) {
      sections.push({ ...current, lines: cleaned })
    }
    current = { type: 'verse', label: '', notes: '', lines: [] }
  }
  for (const line of lines) {
    const header = line && parseSectionHeader(line)
    if (header) {
      push()
      current = { ...header, lines: [] }
      continue
    }
    current.lines.push(line)
  }
  push()
  return sections
}

function mergeLangSections(enSections, esSections) {
  const n = Math.max(enSections.length, esSections.length)
  if (!n) return []
  const out = []
  for (let i = 0; i < n; i++) {
    const en = enSections[i]
    const es = esSections[i]
    const base = es || en || {}
    out.push({
      type: (en && en.type !== 'verse' ? en.type : null) || (es && es.type !== 'verse' ? es.type : null) || base.type || 'verse',
      label: (es && es.label) || (en && en.label) || '',
      notes: [en?.notes, es?.notes].filter(Boolean).join(' · '),
      linesEn: en ? en.lines : [],
      linesEs: es ? es.lines : []
    })
  }
  return out
}

function sectionsSingleLang(sections, lang) {
  return sections.map((s) => ({
    type: s.type,
    label: s.label,
    notes: s.notes,
    linesEn: lang === 'en' ? s.lines : [],
    linesEs: lang === 'es' ? s.lines : []
  }))
}

function interleaveUnknown(lines) {
  // Try to detect a language switch: a run of ES then EN (or vice versa) without a divider.
  const nonempty = lines.map((l, i) => ({ l, i, lang: l ? detectLang(l) : 'empty' }))
  const meaningful = nonempty.filter((x) => x.lang === 'en' || x.lang === 'es')
  if (meaningful.length < 6) return null
  // find a pivot where language flips and stays flipped
  let pivot = -1
  for (let i = 3; i < meaningful.length - 3; i++) {
    const before = meaningful.slice(0, i)
    const after = meaningful.slice(i)
    const bEs = before.filter((x) => x.lang === 'es').length
    const bEn = before.filter((x) => x.lang === 'en').length
    const aEs = after.filter((x) => x.lang === 'es').length
    const aEn = after.filter((x) => x.lang === 'en').length
    if (bEs >= bEn * 2 && aEn >= aEs * 2) {
      pivot = after[0].i
      break
    }
    if (bEn >= bEs * 2 && aEs >= aEn * 2) {
      pivot = after[0].i
      break
    }
  }
  if (pivot < 0) return null
  const first = lines.slice(0, pivot)
  const second = lines.slice(pivot)
  return [first, second]
}

export function parseSongChunk(chunk) {
  const lines = (chunk.body || []).map((l) => cleanLine(l === undefined ? '' : l))
  let blocks = blocksByDivider(lines)
  if (blocks.length === 1) {
    const split = interleaveUnknown(lines)
    if (split) blocks = split
  }

  let sections
  if (blocks.length >= 2) {
    const langs = blocks.map((b) => detectLang(b.filter(Boolean).join(' ')))
    // Pair first two main language blocks; extras append to the matching lang
    let enLines = []
    let esLines = []
    blocks.forEach((b, i) => {
      const lang = langs[i] === 'unknown' && i === 1 ? (langs[0] === 'es' ? 'en' : 'es') : langs[i]
      if (lang === 'es') esLines = esLines.concat(esLines.length ? [''] : [], b)
      else if (lang === 'en') enLines = enLines.concat(enLines.length ? [''] : [], b)
      else if (!esLines.length) esLines = b
      else enLines = enLines.concat(enLines.length ? [''] : [], b)
    })
    sections = mergeLangSections(parseBlockSections(enLines), parseBlockSections(esLines))
  } else {
    const lang = detectLang(lines.filter(Boolean).join(' '))
    sections = sectionsSingleLang(parseBlockSections(lines), lang === 'en' ? 'en' : 'es')
  }

  return {
    title: chunk.title || guessTitle(sections) || 'Untitled song',
    originalKey: parseKey(chunk.key) || chunk.key || '',
    sections
  }
}

function guessTitle(sections) {
  const first = sections[0]?.linesEn?.find(Boolean) || sections[0]?.linesEs?.find(Boolean)
  if (!first) return ''
  return first.slice(0, 40)
}

export function parseSongsFromText(rawText) {
  const chunks = splitSongs(rawText)
  return chunks.map((ch, i) => {
    const parsed = parseSongChunk(ch)
    return {
      id: null,
      title: parsed.title,
      artist: '',
      originalKey: parsed.originalKey,
      bpm: '',
      sections: parsed.sections,
      notes: '',
      sourceIndex: i
    }
  })
}

export function songToPlainText(song, { lang = 'both', chords = true } = {}) {
  const lines = []
  const key = song.originalKey ? ` (${song.originalKey})` : ''
  lines.push(`${song.title || 'Untitled'}${key}`)
  if (song.artist) lines.push(song.artist)
  lines.push('')
  for (const s of song.sections || []) {
    const label = [s.label || labelForType(s.type), s.notes].filter(Boolean).join(' — ')
    if (label) lines.push(label)
    const useEn = lang === 'en' || lang === 'both'
    const useEs = lang === 'es' || lang === 'both'
    if (useEs && s.linesEs?.some(Boolean)) {
      if (lang === 'both' && s.linesEn?.some(Boolean)) lines.push('[ES]')
      lines.push(...s.linesEs)
    }
    if (useEn && s.linesEn?.some(Boolean)) {
      if (lang === 'both' && s.linesEs?.some(Boolean)) {
        lines.push('')
        lines.push('[EN]')
      }
      lines.push(...s.linesEn)
    }
    lines.push('')
  }
  let out = lines.join('\n')
  if (!chords) out = out.replace(/\[([^\]]+)\]/g, '')
  return out.trim() + '\n'
}

export function labelForType(type) {
  return {
    verse: 'Verse',
    chorus: 'Chorus',
    bridge: 'Bridge',
    prechorus: 'Pre-Chorus',
    tag: 'Tag',
    intro: 'Intro',
    outro: 'Outro',
    instrumental: 'Instrumental'
  }[type] || ''
}

export function searchHaystack(song) {
  const parts = [song.title, song.artist, song.originalKey, song.notes]
  for (const s of song.sections || []) {
    parts.push(s.label, s.notes, ...(s.linesEn || []), ...(s.linesEs || []))
  }
  return parts.filter(Boolean).join('\n').toLowerCase()
}

export { cleanLine, parseTitleKey, detectLang }
