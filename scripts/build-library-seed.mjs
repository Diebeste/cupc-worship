#!/usr/bin/env node
/** Walk import-zip/, extract songs, dedupe, write src/data/library-songs.json + report. */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import mammoth from 'mammoth'
import { parseSongsFromText } from '../src/music/parseLyrics.js'
import { parseKey } from '../src/music/transpose.js'
import { foldTitle, slugTitle, parseKeyToken, extractKeyFromText, splitBilingualTitle, cleanupTitle, isJunkTitle, langGuess } from '../src/music/foldTitle.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ZIP = join(ROOT, 'import-zip')
const OUT = join(ROOT, 'src/data/library-songs.json')
const REPORT = join(ROOT, 'src/data/library-report.json')

const FOLDER_KEY = {
  'c - do': 'C', 'd - re': 'D', 'e - mi': 'E', 'f - fa': 'F',
  'g - sol': 'G', 'a - la': 'A', 'b - si': 'B'
}

const RESERVED_TITLES = {
  'cristo yo te amo': 'song-cristo-yo-te-amo',
  'entra en presencia': 'song-entra-en-la-presencia',
  'dios imparable': 'song-dios-imparable',
  'mas ti': 'song-mas-de-ti',
  'i give you glory': 'song-i-give-you-glory',
  'give you glory': 'song-i-give-you-glory',
  'al estar ante ti': 'song-al-estar-ante-ti',
  'por poder tu amor': 'song-por-el-poder-de-tu-amor',
  'at your feet': 'song-at-your-feet',
  'tus pies': 'song-at-your-feet',
  'solo ti sea gloria': 'song-solo-a-ti-sea-la-gloria',
  'dios rompio cadenas': 'song-dios-rompio-cadenas',
  'believe for it': 'song-believe-for-it',
  'hermoso momento': 'song-hermoso-momento'
}

const JUNK_TITLE = new RegExp(
  [
    '^(?:\\[\\s*)?(?:bridge|chorus|verse|pre-?chorus|tag|intro|outro|coro|verso|puente)\\s*\\]?$',
    '^(?:\\(\\s*)?(?:coro|verso|puente|bridge|brandon|chorus)\\s*\\)?$',
    '^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\\s*\\(\\d+\\))?$',
    '^(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{2,4})?$',
    '^(?:january|february|march|april|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+\\d',
    '^(?:songs?|canciones)\\b',
    '^(?:youth service|j[oó]venes|jueves ac[uú]stico|semana de alabanza|sin instrumentos|untitled document.*|documento sin t[ií]tulo.*)$',
    '^(?:ladies.*missionary|missionary\\s+(?:april|march|august|may|service)|vigilia\\b|third service|general agosto|friday\\b.*songs|kids)$',
    '^\\d{1,2}[_./-]\\d{1,2}(?:[_./-]\\d{2,4})?$'
  ].join('|'),
  'i'
)

const DATEISH_FILE = /(?:\b(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|sunday|monday|thursday|friday|saturday|domingo|jueves|viernes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|songs?|canciones|youth|jovenes|missionary|vigilia|semana|service|setlist|untitled|documento|general|kids|ladies|friday|tercer)\b|\d{1,2}[_./-]\d{1,2})/i

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function folderKey(rel) {
  const lower = rel.replace(/\\/g, '/').toLowerCase()
  for (const [frag, key] of Object.entries(FOLDER_KEY)) {
    if (lower.includes('/' + frag + '/')) return key
  }
  return ''
}

function cleanFilename(file) {
  return String(file || '').replace(/\.[^.]+$/, '').replace(/^\s*[)\-_]+/, '').trim()
}

function isJunkTitleLocal(title) {
  return isJunkTitle(title)
}

function isSingleSongPath(rel) {
  const n = rel.replace(/\\/g, '/')
  if (/ENGLISH SONGS|Canciones St Catherine/i.test(n)) return false
  return /By Key Soprano\//i.test(n) || /ORDENAR\/(slow songs|Fast songs|Songs\(canciones\))\//i.test(n)
}

function preprocess(text) {
  let t = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\f/g, '\n')
  t = t.replace(/\u00a0/g, ' ')
  t = t.replace(/[—–‒]{2,}-*/g, '---')
  t = t.replace(/-{5,}/g, '---')
  t = t.replace(/^[.]{6,}$/gm, '---')
  // Unstick "Title (F)Everyone" / "Title [D#]Lyrics"
  t = t.replace(/([)\]])\s*(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, '$1\n')
  // "Title (F/FA)" or "(FA- F)"
  t = t.replace(/[\(\[]\s*([A-G][#b♯♭]?)(?:m|min)?\s*[\/\-–]\s*(?:[A-G][#b♯♭]?|DO|RE|MI|FA|SOL|LA|SI)\s*[\)\]]/gi, (_, n) => `(${n.toUpperCase()})`)
  // "Title (la mayor)" / "(re menor)"
  t = t.replace(/[\(\[]\s*((?:do|re|mi|fa|sol|la|si)\s+(?:mayor|menor)|la mayor|re menor)\s*[\)\]]/gi, (_, w) => {
    const k = parseKeyToken(w)
    return k ? `(${k})` : `(${w})`
  })
  // "Way maker, C major" / "Great and almighty, D minor" / "Title - D minor"
  t = t.replace(/^(.{3,80}?)(?:,\s*|\s+[-–]\s+)([A-G][#b♯♭]?)\s*(major|minor|mayor|menor)\s*$/gim, (_, title, note, q) => {
    const minor = /min|menor/i.test(q)
    return `${title.trim()} (${note.toUpperCase()}${minor ? 'm' : ''})`
  })
  // Trailing solfege already handled by parser; trailing Latin key "Worthy of it all F"
  t = t.replace(/^(.{3,70}?)\s+([A-G](?:#|b|♯|♭)?m?)\s*$/gm, (m, title, key) => {
    if (/\(.*\)\s*$/.test(title)) return m
    if (title.split(/\s+/).length > 10) return m
    return `${title} (${key})`
  })
  // Numbered collection headings: 1) Title
  t = t.replace(/^(\d+)[).]\s+(.{3,80})$/gm, '::TITLE:: $2')
  // Drop leading junk title lines (dates / setlist names)
  const lines = t.split('\n')
  while (lines.length && (!lines[0].trim() || isJunkTitle(lines[0].trim().replace(/^::TITLE::\s*/, '')))) {
    lines.shift()
  }
  return lines.join('\n')
}

function lineCount(sections) {
  let n = 0
  for (const s of sections || []) {
    n += (s.linesEn || []).filter(Boolean).length
    n += (s.linesEs || []).filter(Boolean).length
  }
  return n
}

function langFlags(sections) {
  const en = (sections || []).some((s) => (s.linesEn || []).some(Boolean))
  const es = (sections || []).some((s) => (s.linesEs || []).some(Boolean))
  return { en, es, bilingual: en && es, lang: en && es ? 'bilingual' : en ? 'EN' : es ? 'ES' : 'none' }
}

function scoreSong(s, bonus = 0) {
  const { bilingual } = langFlags(s.sections)
  const lines = Math.min(lineCount(s.sections), 80)
  return lines + (bilingual ? 80 : 0) + (s.originalKey ? 8 : 0) + (s.artist ? 3 : 0) + Math.min((s.sections || []).length, 12) * 3 + bonus
}

function preferredTitle(a, b) {
  const titles = [a.title, b.title].filter((t) => t && !isJunkTitle(t))
  const slash = titles.find((t) => /\/|_/.test(t))
  if (slash) return slash.replace(/\s+_\s+/g, ' / ')
  const mixed = titles.find((t) => /[áéíóúñüÁÉÍÓÚÑÜ]/.test(t) && /[A-Za-z]/.test(t) && /\//.test(t))
  if (mixed) return mixed
  // Prefer the shorter, cleaner title-case heading over a glued line
  titles.sort((x, y) => x.length - y.length)
  return titles[0] || a.title || b.title
}

function mergeSections(a, b) {
  const sa = a || []
  const sb = b || []
  if (!sa.length) return sb
  if (!sb.length) return sa
  // Prefer the better-sectioned (more typed sections, not one huge blob)
  const typed = (secs) => (secs || []).filter((s) => s.type && s.type !== 'verse' && s.type !== 'other').length
  if (Math.abs(sa.length - sb.length) > 2) {
    if (typed(sa) !== typed(sb)) return typed(sa) >= typed(sb) ? sa : sb
    return sa.length >= 2 && sa.length <= 12 && sb.length === 1 ? sa
      : sb.length >= 2 && sb.length <= 12 && sa.length === 1 ? sb
      : (lineCount(sa) >= lineCount(sb) ? sa : sb)
  }
  const n = Math.max(sa.length, sb.length)
  const out = []
  for (let i = 0; i < n; i++) {
    const x = sa[i] || {}
    const y = sb[i] || {}
    const en = ((x.linesEn || []).filter(Boolean).length >= (y.linesEn || []).filter(Boolean).length) ? (x.linesEn || y.linesEn || []) : (y.linesEn || [])
    const es = ((x.linesEs || []).filter(Boolean).length >= (y.linesEs || []).filter(Boolean).length) ? (x.linesEs || y.linesEs || []) : (y.linesEs || [])
    out.push({
      type: (x.type && x.type !== 'verse' ? x.type : y.type) || 'verse',
      label: x.label || y.label || '',
      notes: [x.notes, y.notes].filter(Boolean).join(' · '),
      linesEn: en,
      linesEs: es
    })
  }
  return out
}

function mergeTwo(a, b) {
  const curated = (a._bonus || 0) >= 200 ? a : (b._bonus || 0) >= 200 ? b : null
  const other = curated === a ? b : curated === b ? a : null
  if (curated && other) {
    return {
      ...curated,
      title: curated.title,
      artist: curated.artist || other.artist || '',
      originalKey: curated.originalKey || other.originalKey || '',
      bpm: curated.bpm || other.bpm || '',
      notes: curated.notes || other.notes || '',
      sections: curated.sections,
      aliases: [...new Set([...(curated.aliases || []), ...(other.aliases || []), curated.title, other.title].filter((t) => t && !isJunkTitle(t)))],
      sources: [...new Set([...(curated.sources || []), ...(other.sources || [])])],
      _bonus: Math.max(a._bonus || 0, b._bonus || 0)
    }
  }
  const primary = scoreSong(a, a._bonus || 0) >= scoreSong(b, b._bonus || 0) ? a : b
  const secondary = primary === a ? b : a
  const notes = [primary.notes, secondary.notes].filter(Boolean)
  const uniqNotes = [...new Set(notes)]
  return {
    ...primary,
    title: preferredTitle(a, b) || primary.title,
    artist: primary.artist || secondary.artist || '',
    originalKey: primary.originalKey || secondary.originalKey || '',
    bpm: primary.bpm || secondary.bpm || '',
    notes: uniqNotes.join('\n'),
    sections: mergeSections(a.sections, b.sections),
    aliases: [...new Set([...(a.aliases || []), ...(b.aliases || []), a.title, b.title].filter((t) => t && !isJunkTitle(t)))],
    sources: [...new Set([...(a.sources || []), ...(b.sources || [])])],
    _bonus: Math.max(a._bonus || 0, b._bonus || 0)
  }
}

function extractMeta(text) {
  const artist = (String(text).match(/^(?:written by|autor|author|by)\s*[:.]?\s*(.+)$/im) || [])[1] || ''
  const copyright = (String(text).match(/©\s*(.+)/) || [])[1] || ''
  const ccli = (String(text).match(/CCLI\s*(?:#|No\.?|song\s*)?\s*([0-9]{5,})/i) || [])[1] || ''
  return { artist: artist.trim().slice(0, 80), copyright: copyright.trim().slice(0, 160), ccli: ccli.trim() }
}

function isUseful(song, { allowLong = false } = {}) {
  const n = lineCount(song.sections)
  if (isJunkTitle(song.title)) return false
  if (n < 4) return false
  if (!allowLong && n > 140) return false
  const f = foldTitle(song.title)
  if (!f || f.length < 3) return false
  return true
}

function aliasesFor(title, filenameTitle) {
  const out = []
  for (const t of [title, filenameTitle]) {
    if (!t || isJunkTitle(t) || DATEISH_FILE.test(t)) continue
    out.push(...splitBilingualTitle(t))
  }
  return [...new Set(out.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean))]
}

function decorate(song, extras = {}) {
  const fileTitle = extras.filenameTitle && !DATEISH_FILE.test(extras.filenameTitle) && !isJunkTitle(extras.filenameTitle)
    ? extras.filenameTitle.replace(/\s*[\(\[][^\])]*[\)\]]\s*$/, '').trim()
    : ''
  const title = song.title && !isJunkTitle(song.title) ? cleanupTitle(song.title) : cleanupTitle(fileTitle || song.title)
  const key = parseKey(song.originalKey) || parseKeyToken(song.originalKey) || extras.key || extractKeyFromText(fileTitle) || extractKeyFromText(title) || ''
  const meta = extractMeta((song.sections || []).flatMap((s) => [...(s.linesEn || []), ...(s.linesEs || []), s.notes || '']).join('\n'))
  const notes = []
  if (song.notes) notes.push(song.notes)
  if (meta.copyright) notes.push('Copyright: ' + meta.copyright)
  if (meta.ccli) notes.push('CCLI: ' + meta.ccli)
  let finalTitle = title
  if (fileTitle && foldTitle(fileTitle) !== foldTitle(title) && !isJunkTitle(fileTitle)) {
    const parts = splitBilingualTitle(fileTitle)
    const other = parts.find((p) => foldTitle(p) !== foldTitle(title))
    if (other && !new RegExp(other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(title)) {
      finalTitle = `${fileTitle} / ${title}`.replace(/\s+\/\s+/, ' / ')
      // Avoid "A / A" duplication if file already contains both
      if (parts.some((p) => foldTitle(p) === foldTitle(title))) finalTitle = fileTitle.includes('/') ? fileTitle.replace(/\s+_\s+/g, ' / ') : `${fileTitle} / ${title}`
    }
  }
  return {
    title: finalTitle.replace(/\s+_\s+/g, ' / ').replace(/\s+/g, ' ').trim(),
    artist: song.artist || meta.artist || '',
    originalKey: key,
    bpm: song.bpm || '',
    notes: [...new Set(notes.filter(Boolean))].join('\n'),
    sections: song.sections,
    aliases: aliasesFor(finalTitle, fileTitle),
    sources: extras.source ? [extras.source] : (song.sources || []),
    _bonus: extras.bonus || 0
  }
}

async function extractFile(abs, rel) {
  const ext = extname(abs).toLowerCase()
  const fname = cleanFilename(abs.split('/').pop())
  const fileTitle = fname.replace(/\s*[\(\[][^\])]*[\)\]]\s*$/, '').trim()
  const fKey = extractKeyFromText(fname) || folderKey(rel)
  const single = isSingleSongPath(rel)

  let text = ''
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: abs })
    text = value || ''
  } else if (ext === '.pdf') {
    text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', abs, '-'], { encoding: 'utf8' })
  } else if (ext === '.txt' || ext === '.json' || ext === '.md') {
    text = readFileSync(abs, 'utf8')
  } else {
    return { songs: [], skipped: { file: rel, reason: 'non-song file type ' + ext } }
  }

  const pre = preprocess(text)
  let songs = parseSongsFromText(pre).map((s) => decorate(s, { filenameTitle: single ? fileTitle : '', key: fKey, source: rel }))

  if (single) {
    if (!songs.length) {
      songs = parseSongsFromText('::TITLE:: ' + (fileTitle || 'Untitled') + (fKey ? ` (${fKey})` : '') + '\n' + pre)
        .map((s) => decorate(s, { filenameTitle: fileTitle, key: fKey, source: rel }))
    }
    // One physical file in By Key / ORDENAR is one song: if the splitter over-sliced, rejoin
    if (songs.length > 3) {
      const one = parseSongsFromText('::TITLE:: ' + (fileTitle || songs[0].title) + (fKey ? ` (${fKey})` : '') + '\n' + pre)
      if (one[0]) songs = [decorate(one[0], { filenameTitle: fileTitle, key: fKey, source: rel })]
    } else if (songs.length === 1) {
      if (!songs[0].originalKey && fKey) songs[0].originalKey = fKey
    }
    songs = songs.filter((s) => isUseful(s, { allowLong: true }))
  } else {
    songs = songs.filter((s) => isUseful(s, { allowLong: false }))
  }
  return { songs, skipped: null }
}

function reservedIdFor(song) {
  const keys = [foldTitle(song.title), ...(song.aliases || []).map(foldTitle)].filter(Boolean)
  for (const k of keys) {
    if (RESERVED_TITLES[k]) return RESERVED_TITLES[k]
  }
  // Prefix match only for reserved folds that are 3+ words, so "tus pies" does not
  // steal "A tus pies, arde mi corazón".
  for (const [fold, id] of Object.entries(RESERVED_TITLES)) {
    if (fold.split(' ').length < 3) continue
    if (keys.some((k) => k.startsWith(fold + ' '))) return id
  }
  return ''
}

function clusterKey(song, aliasMap) {
  const keys = [foldTitle(song.title), ...(song.aliases || []).map(foldTitle)].filter(Boolean)
  for (const k of keys) {
    if (aliasMap.has(k)) return aliasMap.get(k)
  }
  const primary = keys[0]
  for (const k of keys) aliasMap.set(k, primary)
  return primary
}

async function main() {
  const files = walk(ZIP).sort()
  const byExt = {}
  const extracted = []
  const skipped = []
  const failed = []
  let rawSongCount = 0

  for (const abs of files) {
    const rel = relative(ZIP, abs)
    const ext = extname(abs).toLowerCase() || '[no ext]'
    byExt[ext] = (byExt[ext] || 0) + 1
    if (['.jpg', '.jpeg', '.png', '.gif', '.mp3', '.mp4', '.mov', '.wav', '.webp'].includes(ext)) {
      skipped.push({ file: rel, reason: 'media / background' })
      continue
    }
    try {
      const { songs, skipped: sk } = await extractFile(abs, rel)
      if (sk) skipped.push(sk)
      rawSongCount += songs.length
      extracted.push(...songs)
    } catch (err) {
      failed.push({ file: rel, reason: err.message || String(err) })
    }
  }

  try {
    const { SEED_SONGS } = await import('../src/data/seed.js')
    for (const s of SEED_SONGS) {
      extracted.push(decorate({ ...s }, { filenameTitle: s.title, key: s.originalKey, source: 'curated-seed', bonus: 200 }))
      rawSongCount++
    }
  } catch (e) {
    console.warn('Could not load existing seed', e.message)
  }

  for (const song of extracted) {
    song.title = cleanupTitle(song.title)
    song.aliases = (song.aliases || []).map(cleanupTitle).filter((a) => a && !isJunkTitle(a))
  }

  const aliasMap = new Map()
  const clusters = new Map()
  for (const song of extracted) {
    const k = clusterKey(song, aliasMap)
    if (!clusters.has(k)) clusters.set(k, song)
    else clusters.set(k, mergeTwo(clusters.get(k), song))
  }

  // Same-language "Song A / Song B" titles are two songs, not a bilingual pair.
  for (const [k, song] of [...clusters.entries()]) {
    const parts = String(song.title || '').split(/\s*\/\s*/)
    if (parts.length !== 2) continue
    const l0 = langGuess(parts[0])
    const l1 = langGuess(parts[1])
    if (l0 && l1 && l0 === l1) {
      const foldB = foldTitle(parts[1])
      const otherKey = [...aliasMap.entries()].find(([fk, pk]) => fk === foldB && pk !== k)?.[1]
      if (otherKey || RESERVED_TITLES[foldB] || [...clusters.values()].some((s) => s !== song && foldTitle(s.title) === foldB)) {
        song.title = cleanupTitle(parts[0])
        song.aliases = (song.aliases || []).filter((a) => foldTitle(a) !== foldB)
      }
    }
  }

  // Merge longer variants into a shorter existing title ("Entra en la presencia del señor…")
  const mergeInto = (fromKey, toKey) => {
    if (fromKey === toKey || !clusters.has(fromKey) || !clusters.has(toKey)) return
    clusters.set(toKey, mergeTwo(clusters.get(toKey), clusters.get(fromKey)))
    clusters.delete(fromKey)
    for (const [fk, pk] of [...aliasMap.entries()]) {
      if (pk === fromKey) aliasMap.set(fk, toKey)
    }
  }
  for (const [k, song] of [...clusters.entries()]) {
    const fold = foldTitle(song.title)
    // "lyrics / OFFICIAL TITLE"
    const parts = String(song.title || '').split(/\s*\/\s*/)
    if (parts.length >= 2) {
      const last = foldTitle(parts[parts.length - 1])
      const host = [...clusters.entries()].find(([ok, s]) => s !== song && foldTitle(s.title) === last)
      if (host) mergeInto(k, host[0])
    }
    for (const [ok, other] of [...clusters.entries()]) {
      if (ok === k || !clusters.has(k)) continue
      const of = foldTitle(other.title)
      if (fold.startsWith(of + ' ') && of.split(' ').length >= 3) mergeInto(k, ok)
    }
  }

  const EXTRA_JUNK = /^(first|second|third)\s+(service|serice|devocional|devotional)|^(part|version|song|sing)\s*\d+|^m[aá]s lento$|^slow\b|^nombre$|^letra\b|^[-—–\s]*$/i
  for (const [k, song] of [...clusters.entries()]) {
    if (isJunkTitle(song.title) || EXTRA_JUNK.test(cleanupTitle(song.title))) clusters.delete(k)
  }

  const usedIds = new Map()
  const library = [...clusters.values()]
    .filter((s) => isUseful(s, { allowLong: true }))
    .sort((a, b) => (b._bonus || 0) - (a._bonus || 0) || a.title.localeCompare(b.title, 'es'))
    .map((s) => {
      let id = reservedIdFor(s)
      if (!id) id = 'song-' + slugTitle(s.title)
      const fold = foldTitle(s.title)
      let i = 2
      while (usedIds.has(id)) {
        id = 'song-' + slugTitle(s.title) + '-' + i
        i++
      }
      usedIds.set(id, fold)
      return {
        id,
        title: s.title,
        artist: s.artist || '',
        originalKey: s.originalKey || '',
        bpm: s.bpm || '',
        notes: s.notes || '',
        sections: s.sections,
        aliases: [...new Set((s.aliases || []).filter((a) => foldTitle(a) && foldTitle(a) !== foldTitle(s.title) && !isJunkTitle(a)))],
        seeded: true
      }
    })

  const langs = { EN: 0, ES: 0, bilingual: 0, none: 0 }
  const missingKeys = []
  for (const s of library) {
    const { lang } = langFlags(s.sections)
    langs[lang] = (langs[lang] || 0) + 1
    if (!s.originalKey) missingKeys.push(s.title)
  }

  const report = {
    inventory: { files: files.length, byExt, skipped: skipped.length, failed: failed.length },
    skipped,
    failed,
    rawSongCount,
    uniqueSongs: library.length,
    duplicatesMerged: rawSongCount - library.length,
    languages: langs,
    missingKeys,
    missingKeyCount: missingKeys.length,
    reservedIdsKept: library.filter((s) => Object.values(RESERVED_TITLES).includes(s.id)).map((s) => s.id).sort()
  }

  mkdirSync(dirname(OUT), { recursive: true })
  library.sort((a, b) => a.title.localeCompare(b.title, 'es'))
  writeFileSync(OUT, JSON.stringify(library, null, 2) + '\n')
  writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({
    files: files.length,
    byExt,
    uniqueSongs: library.length,
    rawSongCount,
    duplicatesMerged: report.duplicatesMerged,
    languages: langs,
    missingKeyCount: missingKeys.length,
    skipped: skipped.length,
    failed: failed.length,
    reservedIdsKept: report.reservedIdsKept,
    out: relative(ROOT, OUT)
  }, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
