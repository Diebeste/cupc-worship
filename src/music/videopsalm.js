/** Parse VideoPsalm songbooks and the official VideoPsalm plain-text song format.
 *
 * Songbook files are relaxed JSON (often with a UTF-8 BOM, unquoted keys, and
 * literal newlines inside strings) stored under Documents\\VideoPsalm\\SongBooks.
 * Field names follow OpenLP's importer and its official fixtures:
 *   songbook: Abbreviation, Copyright, Songs, Guid, VersionDate, Text (name)
 *   song: ID, Text (title), Author, Composer, Copyright, CCLI, Theme, Alias,
 *         Memo1–3, Reference, Guid, Verses, AudioFile, IsAudioFileEnabled, Capo
 *   verse: Text, optional ID
 * Verse types (V, C, P, B, T, I, O, S, N, R) are written as the first line of
 * a verse in the VideoPsalm editor (V1, C, Chorus, …) — official docs, not a
 * separate JSON key in the published samples. ChordPro chords may appear in Text.
 */

import { parseKey } from './transpose.js'
import { parseSongChunk } from './parseLyrics.js'

const LETTER_TYPES = {
  v: 'verse',
  c: 'chorus',
  p: 'prechorus',
  b: 'bridge',
  t: 'tag',
  i: 'intro',
  o: 'outro',
  s: 'other',
  n: 'instrumental',
  r: 'chorus' // official text-import docs: R. = refrain (French chorus)
}

const WORD_TYPES = {
  verse: 'verse',
  verso: 'verse',
  estrofa: 'verse',
  chorus: 'chorus',
  coro: 'chorus',
  refrain: 'chorus',
  estribillo: 'chorus',
  'pre-chorus': 'prechorus',
  prechorus: 'prechorus',
  'pre-coro': 'prechorus',
  precoro: 'prechorus',
  bridge: 'bridge',
  puente: 'bridge',
  tag: 'tag',
  intro: 'intro',
  outro: 'outro',
  ending: 'outro',
  instrumental: 'instrumental',
  slide: 'other',
  other: 'other'
}

const PRETTY = {
  verse: 'Verse',
  chorus: 'Chorus',
  prechorus: 'Pre-Chorus',
  bridge: 'Bridge',
  tag: 'Tag',
  intro: 'Intro',
  outro: 'Outro',
  instrumental: 'Instrumental',
  other: 'Other'
}

/** Strip UTF-8 BOM and repair VideoPsalm's non-JSON into parseable JSON.
 * Port of OpenLP openlp/plugins/songs/lib/importers/videopsalm.py (read as utf-8-sig,
 * quote bare keys, escape in-string newlines, drop other control chars, keep escapes).
 */
export function repairVideoPsalmJson(raw) {
  let fileContent = String(raw ?? '').replace(/^\uFEFF/, '')
  let processed = ''
  let insideQuotes = false
  const it = fileContent[Symbol.iterator]()
  let step = it.next()
  const next = () => { const n = it.next(); return n.done ? '' : n.value }
  while (!step.done) {
    let c = step.value
    if (c === '"') insideQuotes = !insideQuotes
    if (c === '\n') {
      processed += insideQuotes ? '\\n' : c
    } else if ((isKeyStart(c)) && !insideQuotes) {
      processed += '"' + c
      c = next()
      while (c && isKeyChar(c)) {
        processed += c
        c = next()
      }
      processed += '"' + c
    } else if (c < ' ' ) {
      processed += ' '
    } else if (c === '\\') {
      processed += c
      processed += next()
    } else {
      processed += c
    }
    step = it.next()
  }
  return processed.trim()
}

function isKeyStart(c) {
  return /[A-Za-z0-9\-]/.test(c)
}
function isKeyChar(c) {
  return /[A-Za-z0-9]/.test(c)
}

export function looksLikeVideoPsalm(raw) {
  const s = String(raw ?? '').replace(/^\uFEFF/, '').trim()
  if (!s) return false
  if (/[{,]\s*"?Songs"?\s*:/.test(s) && /Verses\s*:/.test(s)) return true
  if (s.startsWith('{') && /Abbreviation\s*:/.test(s) && /Songs\s*:/.test(s)) return true
  return false
}

export function looksLikeVideoPsalmPlain(raw) {
  const s = String(raw ?? '').replace(/^\uFEFF/, '')
  if (looksLikeVideoPsalm(s)) return false
  const hasNumberedTitle = /^\s*\d+\.\s+\S/m.test(s)
  const hasVerseTag = /^\s*(?:V|C|P|B|T)\d*\.\s+\S/m.test(s)
  return hasNumberedTitle && hasVerseTag
}

export function parseVideoPsalmJson(raw) {
  const repaired = repairVideoPsalmJson(raw)
  const book = JSON.parse(repaired)
  const list = Array.isArray(book?.Songs) ? book.Songs : Array.isArray(book) ? book : []
  const bookName = book?.Text || ''
  return list.map((song, i) => songFromVp(song, i, bookName)).filter((s) => s.title || hasLyrics(s))
}

function hasLyrics(s) {
  return (s.sections || []).some((sec) => (sec.linesEn || []).some(Boolean) || (sec.linesEs || []).some(Boolean))
}

function songFromVp(song, index, bookName) {
  const verses = Array.isArray(song?.Verses) ? song.Verses : []
  const body = []
  let allText = ''
  let verseNum = 0
  for (const verse of verses) {
    if (!verse || verse.Text == null) continue
    const raw = String(verse.Text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const { header, lines } = splitVerseLabel(raw)
    if (!lines.some((l) => l.trim())) continue
    if (header) body.push(header)
    else {
      verseNum += 1
      body.push('Verse ' + verseNum)
    }
    body.push(...lines)
    allText += '\n' + raw
  }
  const titleRaw = String(song?.Text || '').replace(/\s+/g, ' ').trim()
  const titleKey = titleRaw.match(/\(\s*([A-G][#b♯♭]?(?:m|min)?)\s*\)\s*$/i)
  const parsed = parseSongChunk({
    title: titleRaw || '',
    key: titleKey ? titleKey[1] : '',
    body
  })
  const key = parseKey(parsed.originalKey) || keyFromChords(allText) || ''
  const artist = [song?.Author, song?.Composer && song.Composer !== song.Author ? song.Composer : '']
    .map((x) => String(x || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' / ')
  const notes = noteLines(song, bookName)
  return {
    id: null,
    title: parsed.title || titleRaw || 'Untitled song',
    artist,
    originalKey: key,
    bpm: '',
    sections: parsed.sections,
    notes,
    sourceIndex: index,
    source: 'videopsalm',
    ccli: song?.CCLI != null && String(song.CCLI).trim() ? String(song.CCLI).trim() : '',
    copyright: song?.Copyright ? String(song.Copyright).replace(/\s+/g, ' ').trim() : ''
  }
}

function noteLines(song, bookName) {
  const lines = []
  if (bookName) lines.push('Songbook: ' + String(bookName).replace(/\s+/g, ' ').trim())
  if (song?.Copyright) lines.push('Copyright: ' + String(song.Copyright).replace(/\s+/g, ' ').trim())
  if (song?.CCLI != null && String(song.CCLI).trim()) lines.push('CCLI: ' + String(song.CCLI).trim())
  if (song?.Capo != null && String(song.Capo).trim() !== '') lines.push('Capo: ' + String(song.Capo).trim())
  if (song?.Theme) lines.push('Theme: ' + String(song.Theme).replace(/\s+/g, ' ').trim())
  if (song?.Alias) lines.push('Alias: ' + String(song.Alias).replace(/\s+/g, ' ').trim())
  for (const k of ['Memo1', 'Memo2', 'Memo3']) {
    const v = song?.[k] && String(song[k]).trim()
    if (v) lines.push(v.replace(/\s+/g, ' ').trim())
  }
  if (song?.Reference) lines.push('Reference: ' + String(song.Reference).replace(/\s+/g, ' ').trim())
  return lines.join('\n')
}

function keyFromChords(text) {
  const m = String(text).match(/\[([A-G][#b♯♭]?(?:m|min)?)\]/)
  return m ? parseKey(m[1]) : ''
}

/** First-line verse labels as documented by VideoPsalm (V1, C, C1, Chorus, Verse 2, …). */
export function splitVerseLabel(raw) {
  const lines = String(raw ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  while (lines.length && !lines[0].trim()) lines.shift()
  if (!lines.length) return { header: '', lines: [] }
  const parsed = parseVpSectionLabel(lines[0].trim())
  if (parsed) return { header: parsed, lines: lines.slice(1) }
  return { header: '', lines }
}

export function parseVpSectionLabel(line) {
  const s = String(line || '').trim()
  if (!s || s.length > 40) return null
  let m = s.match(/^(V|C|P|B|T|I|O|S|N|R)(?:\s*(\d+))?\s*\.?$/i)
  if (m) {
    const type = LETTER_TYPES[m[1].toLowerCase()] || 'verse'
    const num = m[2] ? ` ${m[2]}` : ''
    return `${PRETTY[type] || 'Verse'}${num}`
  }
  m = s.match(/^(verse|verso|estrofa|chorus|coro|refrain|estribillo|pre[-\s]?chorus|pre[-\s]?coro|prechorus|precoro|bridge|puente|tag|intro|outro|ending|instrumental|slide|other)\s*(\d+)?\s*\.?$/i)
  if (m) {
    const key = m[1].toLowerCase().replace(/\s+/g, '-')
    const type = WORD_TYPES[key] || WORD_TYPES[key.replace(/-/g, '')] || 'verse'
    const num = m[2] ? ` ${m[2]}` : ''
    return `${PRETTY[type] || 'Verse'}${num}`
  }
  return null
}

/** Official VideoPsalm “text formatted” songs (see their import-text blog). */
export function parseVideoPsalmPlain(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const chunks = text.split(/\n(?:\s*\n){2,}/)
  const songs = []
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((l) => l.trimEnd())
    while (lines.length && !lines[0].trim()) lines.shift()
    if (!lines.length) continue
    const titleLine = lines[0].replace(/^\s*\d+\.\s*/, '').trim()
    if (!titleLine) continue
    let i = 1
    let artist = ''
    let copyright = ''
    if (i < lines.length && /^(written by|copyright|©|autor|author)\b/i.test(lines[i].trim())) {
      artist = lines[i].replace(/^(written by|autor|author)\s*/i, '').trim()
      i++
    }
    while (i < lines.length && !lines[i].trim()) i++
    const body = []
    for (; i < lines.length; i++) {
      const line = lines[i]
      const copy = line.match(/^©\s*(.*)$/)
      if (copy) {
        copyright = copy[1].trim() || '©'
        continue
      }
      const tag = line.match(/^(V|C|P|B|T|I|O|S|N|R)(?:\s*(\d+))?\.\s*(.*)$/i)
      if (tag) {
        const header = parseVpSectionLabel(`${tag[1]}${tag[2] || ''}.`)
        if (body.length) body.push('')
        if (header) body.push(header)
        if (tag[3]) body.push(tag[3])
        continue
      }
      body.push(line)
    }
    const parsed = parseSongChunk({ title: titleLine, key: '', body })
    const notes = []
    if (copyright) notes.push('Copyright: ' + copyright)
    songs.push({
      id: null,
      title: parsed.title || titleLine,
      artist,
      originalKey: parseKey(parsed.originalKey) || keyFromChords(body.join('\n')) || '',
      bpm: '',
      sections: parsed.sections,
      notes: notes.join('\n'),
      sourceIndex: songs.length,
      source: 'videopsalm-text',
      copyright,
      ccli: ''
    })
  }
  return songs.filter((s) => s.title && hasLyrics(s))
}

export function parseVideoPsalm(raw) {
  if (looksLikeVideoPsalm(raw)) return parseVideoPsalmJson(raw)
  if (looksLikeVideoPsalmPlain(raw)) return parseVideoPsalmPlain(raw)
  return []
}

export function parseImportedSongs(raw) {
  try {
    if (looksLikeVideoPsalm(raw)) {
      const songs = parseVideoPsalmJson(raw)
      if (songs.length) return songs
    }
  } catch (err) {
    // Fall through to other parsers; the caller may surface this for .json files.
    if (looksLikeVideoPsalm(raw)) throw err
  }
  if (looksLikeVideoPsalmPlain(raw)) return parseVideoPsalmPlain(raw)
  return null
}
