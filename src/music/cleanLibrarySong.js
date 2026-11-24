/** Clean imported library songs: labels, spacing, titles, artists, and EN/ES split. */

import { cleanupTitle, foldTitle, langGuess, splitBilingualTitle } from './foldTitle.js'
import { detectLang, labelForType } from './parseLyrics.js'

const TYPE_FROM = {
  verse: 'verse',
  verso: 'verse',
  estrofa: 'verse',
  chorus: 'chorus',
  chorous: 'chorus',
  coro: 'chorus',
  hook: 'chorus',
  bridge: 'bridge',
  puente: 'bridge',
  prechorus: 'prechorus',
  precoro: 'prechorus',
  tag: 'tag',
  vamp: 'tag',
  intro: 'intro',
  comienzo: 'intro',
  outro: 'outro',
  ending: 'outro',
  coda: 'outro',
  final: 'outro',
  instrumental: 'instrumental',
  interlude: 'instrumental',
  unaccompanied: 'tag'
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10 }

const HEADER_NAME =
  'verse|verso|estrofa|chorus|chorous|coro|bridge|puente|pre[\\s-]?chorus|pre[\\s-]?chorous|pre[\\s-]?coro|prechorus|precoro|tag|intro|outro|ending|instrumental|interlude|vamp|hook|coda|final|unaccompanied'

const HEADER_CORE = new RegExp(
  `^(${HEADER_NAME})(?:\\s*([IVXLC]+|\\d+))?(?:\\s*[x×]\\s*(\\d+)|\\s*(\\d+)\\s*[x×])?$`,
  'i'
)

const STUCK_HEADER = new RegExp(
  `^(${HEADER_NAME})(?:\\s*([IVXLC]+|\\d+))?(?=[A-ZÁÉÍÓÚÑÜ“"‘'])`,
  'i'
)

const HEADER_WITH_NOTES = new RegExp(
  `^(${HEADER_NAME})(?:\\s*([IVXLC]+|\\d+))?\\s*[\\(\\[]\\s*([^)\\]]+)[\\)\\]]\\s*$`,
  'i'
)

const JUNK_LINE =
  /^(?:[-_—–−=.─―‐*~]{1,}|---+\/?|\.{3,}|\/*\s*$|offering\s*[🎶🎵]*\s*:?)$/i

const PERFORMANCE_NOTE =
  /^(?:\(?\s*(?:armon[ií]as?(?:\s+\w+)?|un[ií]sono|harmony|unison|brandon)\s*\)?)$/i

const LYRIC_ARTIST =
  /^(?:the power of (?:the name of jesus|your love|his word)|his stripes i am healed|your blood, i have a way)$/i

const SMALL_EN = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with', 'over', 'oh'])
const SMALL_ES = new Set(['a', 'al', 'de', 'del', 'el', 'la', 'las', 'los', 'y', 'o', 'u', 'e', 'en', 'con', 'por', 'para', 'un', 'una', 'que', 'te', 'me', 'se', 'lo', 'le', 'les', 'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'nos', 'os', 'como', 'si', 'ni', 'ya', 'muy', 'tan', 'oh', 'al'])

const ES_HINTS =
  /\b(el|la|los|las|de|del|que|y|en|un|una|por|con|mi|tu|su|te|me|al|se|es|no|yo|tú|ti|señor|dios|jesús|cristo|amor|coraz[oó]n|gloria|alabanza|digno|santo|nombre|vida|hoy|para|como|eres|todo|ante|sin|tus|sus|porque|cuando|d[oó]nde|c[oó]mo|m[aá]s|tambi[eé]n|este|esta|eres|somos|tienes|tiene|poder|rey|cruz|sangre|gracia|cielo|tierra|siempre|nunca|ahora|aqui|aqu[ií]|se[nñ]or|a[uú]n|tambi[eé]n|sobre|todo|nada|nadie|lugar|pies|mano|manos|coraz[oó]n|esp[ií]ritu|alabamos|adoramos|gracias|santo|digno)\b/gi
const EN_HINTS =
  /\b(the|and|you|your|to|of|in|my|me|is|it|for|with|that|this|are|be|we|our|i|how|lord|jesus|christ|love|glory|holy|name|heart|come|give|there|when|from|will|not|but|one|without|him|his|her|us|was|have|has|been|can|can't|cannot|oh|all|so|at|feet|above|worthy|every|ever|build|life|open|eyes)\b/gi

export function detectLineLang(text) {
  const t = String(text || '')
  if (!t.trim()) return 'unknown'
  const es = (t.match(ES_HINTS) || []).length + (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(t) ? 2 : 0)
  const en = (t.match(EN_HINTS) || []).length
  if (es >= en + 2 && es > 0) return 'es'
  if (en >= es + 2 && en > 0) return 'en'
  if (es > en) return 'es'
  if (en > es) return 'en'
  const guessed = langGuess(t) || detectLang(t)
  return guessed === 'es' || guessed === 'en' ? guessed : 'unknown'
}

function romanOrNum(raw) {
  if (!raw) return ''
  const s = String(raw).trim().toLowerCase()
  if (/^\d+$/.test(s)) return String(parseInt(s, 10))
  if (ROMAN[s]) return String(ROMAN[s])
  return ''
}

function typeFromName(name) {
  const n = String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^pre[\s-]?/, 'pre')
  if (n.startsWith('prechorus') || n.startsWith('precoro')) return 'prechorus'
  const key = Object.keys(TYPE_FROM).find((k) => n === k || n.startsWith(k))
  return key ? TYPE_FROM[key] : 'other'
}

function prettyLabel(type, num, times) {
  const base = labelForType(type) || 'Verse'
  const n = num ? ` ${num}` : ''
  const label = (base + n).trim()
  const notes = times ? `x${times}` : ''
  return { type, label, notes }
}

export function parseLooseHeader(line) {
  const raw = String(line || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
  if (!raw) return null

  const loneNum = raw.match(/^(?:[\(\[]\s*)?([IVXLC]{1,4}|\d{1,2})(?:\s*[\)\].:])?$/)
  if (loneNum && romanOrNum(loneNum[1]) && !/^[xX]$/.test(loneNum[1])) {
    const num = romanOrNum(loneNum[1])
    if (num && Number(num) >= 1 && Number(num) <= 8) return { type: 'verse', label: 'Verse ' + num, notes: '' }
  }

  let core = raw.replace(/^[\(\[\/\s]+/, '').replace(/[\)\]\/\s]+$/, '').trim()

  const complete = core.match(HEADER_CORE)
  if (complete && core === complete[0]) {
    return headerFromParts(complete[1], complete[2], complete[3] || complete[4], '')
  }
  const completeX = core.match(new RegExp(`^(${HEADER_NAME})(?:\\s*([IVXLC]+|\\d+))?\\s*(?:x\\s*(\\d+)|(\\d+)\\s*x)$`, 'i'))
  if (completeX && core === completeX[0]) {
    return headerFromParts(completeX[1], completeX[2], completeX[3] || completeX[4], '')
  }

  const stuck = raw.match(STUCK_HEADER)
  if (stuck) {
    const parsed = headerFromParts(stuck[1], stuck[2], '', '')
    if (parsed) return { ...parsed, stuckLyrics: raw.slice(stuck[0].length) }
  }

  const unwrapped = (raw.startsWith('(') && raw.endsWith(')')) || (raw.startsWith('[') && raw.endsWith(']'))
    ? raw.slice(1, -1).trim()
    : raw
  const noteMatch = raw.match(HEADER_WITH_NOTES) || core.match(HEADER_WITH_NOTES) || unwrapped.match(HEADER_WITH_NOTES)
  if (noteMatch) {
    const parsed = headerFromParts(noteMatch[1], noteMatch[2], '', noteMatch[3])
    if (parsed) return parsed
  }

  const times = core.match(HEADER_CORE)
  if (times) return headerFromParts(times[1], times[2], times[3] || times[4], '')

  // "Chorus 2X" / "Chorus X2" after stripping brackets
  const x2 = core.match(new RegExp(`^(${HEADER_NAME})(?:\\s*([IVXLC]+|\\d+))?\\s*(?:x\\s*(\\d+)|(\\d+)\\s*x)$`, 'i'))
  if (x2) return headerFromParts(x2[1], x2[2], x2[3] || x2[4], '')

  return null
}

function headerFromParts(name, numRaw, timesRaw, extraNotes) {
  const type = typeFromName(name)
  if (!type || type === 'other') return null
  const num = romanOrNum(numRaw)
  const times = timesRaw ? String(parseInt(timesRaw, 10)) : ''
  const { label, notes } = prettyLabel(type, num, times)
  const more = String(extraNotes || '').trim()
  return { type, label, notes: [notes, more].filter(Boolean).join(' · ') }
}

export function isJunkLine(line) {
  const s = String(line || '').replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').trim()
  if (!s) return false
  return JUNK_LINE.test(s)
}

export function isPerformanceNote(line) {
  const s = String(line || '').trim()
  return !!s && PERFORMANCE_NOTE.test(s)
}

export function tidyLyricLine(line) {
  return String(line || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '')
    .replace(/[●•▪︎⬆️⬇️↗️➡️↑↓➡︎⬆︎⬇︎↗]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function unstickRunonLine(line) {
  const s = tidyLyricLine(line)
  if (!s) return []
  if (/\[[A-G]/.test(s) && !STUCK_HEADER.test(s) && !/^\[(verse|chorus|bridge|coro|verso|puente)/i.test(s)) {
    return [s]
  }
  const boundaries = [...s.matchAll(/(?<=[\p{Ll}`,;:ñáéíóúü])(?=[\p{Lu}ÁÉÍÓÚÑÜ])/gu)]
  if (!boundaries.length) return [s]
  if (s.length < 40 && boundaries.length < 2) return [s]
  const parts = []
  let last = 0
  for (const m of boundaries) {
    const i = m.index
    const chunk = s.slice(last, i).trim()
    if (chunk) parts.push(chunk)
    last = i
  }
  const tail = s.slice(last).trim()
  if (tail) parts.push(tail)
  return parts.length ? parts : [s]
}

export function compactStanzas(lines) {
  const arr = lines || []
  const blankish = arr.filter((l) => !String(l || '').trim() || isJunkLine(l)).length
  const blankHeavy = arr.length > 0 && blankish / arr.length >= 0.35
  const need = blankHeavy ? 2 : 1
  const out = []
  let emptyRun = 0
  const flush = () => {
    if (out.length && emptyRun >= need) out.push('')
    emptyRun = 0
  }
  for (const raw of lines || []) {
    if (!String(raw || '').trim() || isJunkLine(raw)) {
      emptyRun += 1
      continue
    }
    const pieces = unstickRunonLine(raw)
    for (const piece of pieces) {
      if (!piece) {
        emptyRun += 1
        continue
      }
      flush()
      out.push(piece)
    }
  }
  return out
}

export function isLyricFragmentArtist(artist, song) {
  const a = String(artist || '').trim()
  if (!a) return false
  if (LYRIC_ARTIST.test(a)) return true
  const fold = foldTitle(a)
  if (!fold) return true
  const blob = [
    song?.title,
    ...((song?.sections || []).flatMap((s) => [...(s.linesEn || []), ...(s.linesEs || [])]))
  ]
    .filter(Boolean)
    .map((l) => foldTitle(l))
    .join(' \n ')
  if (fold.length >= 8 && blob.includes(fold)) return true
  if (/^(the|his|her|your|my|their)\s+/i.test(a) && a.split(/\s+/).length >= 4) return true
  return false
}

function smallWordsFor(lang) {
  if (lang === 'es') return SMALL_ES
  if (lang === 'en') return SMALL_EN
  return new Set([...SMALL_EN, ...SMALL_ES])
}

const SACRED_NAMES = {
  señor: 'Señor', senor: 'Señor', dios: 'Dios', 'jesús': 'Jesús', jesus: 'Jesus',
  cristo: 'Cristo', jesucristo: 'Jesucristo', 'jehová': 'Jehová', jehova: 'Jehova',
  'espíritu': 'Espíritu', espiritu: 'Espiritu'
}

export function sentenceCasePhrase(s) {
  const text = String(s || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  let t = text.toLocaleLowerCase('es')
  t = t.replace(/^[^\p{L}]*\p{L}/u, (ch) => ch.toLocaleUpperCase('es'))
  t = t.replace(/(?<![\p{L}])(señor|senor|dios|jesús|jesus|cristo|jesucristo|jehová|jehova|espíritu|espiritu)(?![\p{L}])/giu, (w) => {
    return SACRED_NAMES[w.toLocaleLowerCase('es')] || w
  })
  return t
}

export function titleCasePhrase(s, lang) {
  const text = String(s || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  if (lang === 'es') return sentenceCasePhrase(text)
  const small = smallWordsFor(lang)
  const tokens = text.split(/(\s+|\/)/)
  const words = tokens.filter((t) => /\S/.test(t) && t !== '/')
  let wi = 0
  return tokens
    .map((tok) => {
      if (!/\S/.test(tok) || tok === '/') return tok
      const raw = tok
      const isFirst = wi === 0
      const isLast = wi === words.length - 1
      wi += 1
      if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(raw) && /[a-z]/.test(raw) && /[A-Z]/.test(raw) && !isAllCaps(text)) {
        return raw
      }
      const lower = raw.toLocaleLowerCase('es')
      const bare = lower.replace(/^[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]+/, '').replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ']+$/, '')
      if (bare === 'i') return raw.replace(/i/i, 'I')
      if (!isFirst && !isLast && small.has(bare)) {
        return lower
      }
      return lower.replace(/^[a-zA-Záéíóúñü]/, (ch) => ch.toLocaleUpperCase('es'))
    })
    .join('')
}


function isAllCaps(s) {
  const letters = String(s || '').replace(/[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/g, '')
  return letters.length >= 3 && letters === letters.toLocaleUpperCase('es') && /[A-ZÁÉÍÓÚÑÜ]/.test(letters)
}

function tidyTitlePart(part) {
  let t = cleanupTitle(String(part || '').replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, ''))
  t = t.replace(/\s*[\(\[]\s*[A-G][#b♯♭]?m?\s*[\)\]]\s*\??\s*$/i, '').trim()
  t = t.replace(/\s*\(\s*[A-G][#b♯♭]?\s*\)\s*\?\s*$/i, '').trim()
  t = t.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim()
  return t
}


function titleLang(s) {
  const g = langGuess(s)
  if (g === 'en' || g === 'es') return g
  const d = detectLineLang(s)
  if (d === 'en' || d === 'es') return d
  if (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(s) || /\b(cristo|dios|señor|jesús|jehová|alabanza|corazón)\b/i.test(s)) return 'es'
  return ''
}

export function cleanSongTitle(title) {
  const flags = []
  let raw = String(title || '').replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim()
  raw = raw.replace(/\s*\/\s*/g, ' / ')
  const slashParts = raw.split(/\s*\/\s*/).map(tidyTitlePart).filter(Boolean)
  if (slashParts.length >= 3) {
    flags.push('title has 3 or more parts; possible medley')
  }
  if (slashParts.length === 2) {
    const l0 = titleLang(slashParts[0])
    const l1 = titleLang(slashParts[1])
    const sameLang = l0 && l1 && l0 === l1
    const nearDup = foldTitle(slashParts[0]) && foldTitle(slashParts[0]) === foldTitle(slashParts[1])
    const contained =
      foldTitle(slashParts[0]).includes(foldTitle(slashParts[1])) ||
      foldTitle(slashParts[1]).includes(foldTitle(slashParts[0]))
    if (nearDup || (contained && Math.min(slashParts[0].length, slashParts[1].length) < 28)) {
      const keep = slashParts[0].length >= slashParts[1].length ? slashParts[0] : slashParts[1]
      const lang = titleLang(keep) || l0 || l1 || 'es'
      return { title: isAllCaps(keep) || isAllCaps(raw) ? titleCasePhrase(keep, lang) : keep, flags }
    }
    if (sameLang && !contained) {
      flags.push('title has two same-language parts; possible two songs')
    }
    const c0 = isAllCaps(slashParts[0]) || isAllCaps(raw) ? titleCasePhrase(slashParts[0], l0 || titleLang(slashParts[0]) || '') : slashParts[0]
    const c1 = isAllCaps(slashParts[1]) || isAllCaps(raw) ? titleCasePhrase(slashParts[1], l1 || titleLang(slashParts[1]) || '') : slashParts[1]
    return { title: `${c0} / ${c1}`, flags }
  }
  const bilingual = splitBilingualTitle(raw)
  const one = tidyTitlePart(bilingual[0] || raw)
  const lang = titleLang(one) || ''
  const titled = isAllCaps(one) || isAllCaps(raw) ? titleCasePhrase(one, lang) : one
  return { title: titled || raw, flags }
}

function stanzaGroups(lines) {
  const groups = []
  let cur = []
  for (const ln of lines || []) {
    if (!String(ln || '').trim()) {
      if (cur.length) {
        groups.push(cur)
        cur = []
      }
    } else cur.push(ln)
  }
  if (cur.length) groups.push(cur)
  return groups
}


function extractMinimalSections(prepared) {
  const out = []
  for (const sec of prepared) {
    const enSecs = extractFromLines(sec.linesEn, [], 'en')
    const esSecs = extractFromLines(sec.linesEs, [], 'es')
    // Keep each language in its original field; pair extracted headers in order
    const n = Math.max(enSecs.length, esSecs.length, 1)
    for (let i = 0; i < n; i++) {
      const en = enSecs[i]
      const es = esSecs[i]
      const type = (en && en.type !== 'verse' ? en.type : null) || (es && es.type !== 'verse' ? es.type : null) || sec.type || 'verse'
      const label = (en && en.label) || (es && es.label) || normalizeExistingLabel(sec.label, type)
      const notes = [i === 0 ? sec.notes : '', en?.notes, es?.notes].filter(Boolean).join(' · ')
      out.push({
        type,
        label,
        notes,
        linesEn: en ? compactStanzas(en.lines) : [],
        linesEs: es ? compactStanzas(es.lines) : []
      })
    }
  }
  return out
}

function extractFromLines(lines, flags, field) {
  const compact = compactStanzas(lines)
  const sections = []
  let current = { type: 'verse', label: '', notes: '', lines: [] }
  let started = false
  const push = () => {
    const body = compactStanzas(current.lines)
    if (body.length || current.notes || current.label) {
      sections.push({ type: current.type, label: current.label, notes: current.notes, lines: body })
    }
    current = { type: 'verse', label: '', notes: '', lines: [] }
  }
  for (const ln of compact) {
    if (isPerformanceNote(ln)) {
      current.notes = [current.notes, tidyLyricLine(ln).replace(/^\(|\)$/g, '')].filter(Boolean).join(' · ')
      continue
    }
    const header = parseLooseHeader(ln)
    if (header && !header.stuckLyrics) {
      if (started || current.lines.some(Boolean)) push()
      current = { type: header.type, label: header.label, notes: header.notes, lines: [] }
      started = true
      continue
    }
    if (header && header.stuckLyrics) {
      if (started || current.lines.some(Boolean)) push()
      current = { type: header.type, label: header.label, notes: header.notes, lines: [] }
      started = true
      for (const piece of unstickRunonLine(header.stuckLyrics)) current.lines.push(piece)
      continue
    }
    current.lines.push(ln)
    started = true
  }
  push()
  if (!sections.length) return [{ type: 'verse', label: '', notes: '', lines: [] }]
  return sections
}

function langOfLines(lines) {
  const text = (lines || []).filter(Boolean).join(' ')
  if (!text.trim()) return 'empty'
  return detectLineLang(text)
}

function mixedLangCounts(lines) {
  let en = 0
  let es = 0
  for (const ln of lines || []) {
    if (!String(ln || '').trim()) continue
    if (parseLooseHeader(ln) || isJunkLine(ln) || isPerformanceNote(ln)) continue
    const lang = detectLineLang(ln)
    if (lang === 'en') en += 1
    if (lang === 'es') es += 1
  }
  return { en, es }
}

function findLangPivot(lines) {
  const meaningful = []
  for (let i = 0; i < (lines || []).length; i++) {
    const ln = lines[i]
    if (!String(ln || '').trim()) continue
    if (parseLooseHeader(ln) || isJunkLine(ln) || isPerformanceNote(ln)) continue
    const lang = detectLineLang(ln)
    if (lang === 'en' || lang === 'es') meaningful.push({ i, lang })
  }
  if (meaningful.length < 4) return -1
  for (let i = 2; i < meaningful.length - 2; i++) {
    const before = meaningful.slice(0, i)
    const after = meaningful.slice(i)
    const bEs = before.filter((x) => x.lang === 'es').length
    const bEn = before.filter((x) => x.lang === 'en').length
    const aEs = after.filter((x) => x.lang === 'es').length
    const aEn = after.filter((x) => x.lang === 'en').length
    if (bEs >= Math.max(2, bEn * 2) && aEn >= Math.max(2, aEs * 2)) return rewindPivot(lines, before, after)
    if (bEn >= Math.max(2, bEs * 2) && aEs >= Math.max(2, aEn * 2)) return rewindPivot(lines, before, after)
  }
  return -1
}

function rewindPivot(lines, before, after) {
  const l1 = before[before.length - 1].lang
  let lastL1 = -1
  let headerAfterL1 = -1
  const end = after[0].i
  for (let j = 0; j < end; j++) {
    const ln = lines[j]
    if (!String(ln || '').trim()) continue
    if (isJunkLine(ln) || isPerformanceNote(ln)) continue
    if (parseLooseHeader(ln)) {
      if (lastL1 >= 0) headerAfterL1 = j
      continue
    }
    if (detectLineLang(ln) === l1) {
      lastL1 = j
      headerAfterL1 = -1
    }
  }
  if (headerAfterL1 >= 0) return headerAfterL1
  return lastL1 >= 0 ? lastL1 + 1 : after[0].i
}

function findAppendedIndex(lines, song, otherTitles) {
  const nonempty = []
  for (let i = 0; i < (lines || []).length; i++) {
    if (String(lines[i] || '').trim()) nonempty.push(i)
  }
  if (nonempty.length < 3) return -1
  const own = new Set([foldTitle(song.title), ...((song.aliases || []).map(foldTitle))].filter(Boolean))
  for (let k = 1; k < nonempty.length; k++) {
    const i = nonempty[k]
    const raw = tidyLyricLine(lines[i])
    if (/^offering\b/i.test(raw) || /^offering\s*[🎶🎵]/i.test(raw) || /^\*\s*give and it will come back/i.test(raw)) {
      if (k >= 2) return i
    }
    if (k < 3) continue
    const stripped = tidyTitlePart(raw.replace(/\s*\[[A-G][#b♯♭]?m?\]\s*$/i, ''))
    const fold = foldTitle(stripped)
    if (!fold || fold.length < 8) continue
    if (own.has(fold)) continue
    const looksTitled = /\[[A-G][#b♯♭]?m?\]\s*$/i.test(raw) || /\s\/\s/.test(raw)
    const other = otherTitles.get(fold)
    if (looksTitled && other && !other.has(song.id) && k >= 3) return i
    if (other && !other.has(song.id) && k >= 5) {
      return i
    }
  }
  return -1
}

function emptySec(base = {}) {
  return {
    type: base.type || 'verse',
    label: base.label || '',
    notes: base.notes || '',
    linesEn: [],
    linesEs: []
  }
}

function mergeSectionPair(enSec, esSec) {
  const type =
    (enSec && enSec.type && enSec.type !== 'verse' ? enSec.type : null) ||
    (esSec && esSec.type && esSec.type !== 'verse' ? esSec.type : null) ||
    enSec?.type ||
    esSec?.type ||
    'verse'
  const label = (enSec && enSec.label) || (esSec && esSec.label) || (type !== 'verse' ? labelForType(type) : '')
  const notes = [enSec?.notes, esSec?.notes].filter(Boolean).join(' · ')
  return {
    type,
    label,
    notes,
    linesEn: enSec?.lines ? compactStanzas(enSec.lines) : compactStanzas(enSec?.linesEn || []),
    linesEs: esSec?.lines ? compactStanzas(esSec.lines) : compactStanzas(esSec?.linesEs || [])
  }
}

function pairSectionLists(enList, esList, flags) {
  let en = [...(enList || [])]
  let es = [...(esList || [])]
  if (en.length && es.length && es.length === en.length + 1 && en.length >= 2) {
    const extra = es[es.length - 2]
    es = es.slice(0, -2).concat(es.slice(-1))
    const out = []
    for (let i = 0; i < en.length; i++) out.push(mergeSectionPair(en[i], es[i]))
    // insert the extra Spanish stanza before the last paired section
    const extraSec = mergeSectionPair(null, extra)
    out.splice(out.length - 1, 0, extraSec)
    flags.push('paired last sections together and kept one extra Spanish stanza')
    return out.filter((s) => (s.linesEn && s.linesEn.some(Boolean)) || (s.linesEs && s.linesEs.some(Boolean)) || s.notes)
  }
  if (en.length && es.length && en.length === es.length + 1 && es.length >= 2) {
    const extra = en[en.length - 2]
    en = en.slice(0, -2).concat(en.slice(-1))
    const out = []
    for (let i = 0; i < es.length; i++) out.push(mergeSectionPair(en[i], es[i]))
    const extraSec = mergeSectionPair(extra, null)
    out.splice(out.length - 1, 0, extraSec)
    flags.push('paired last sections together and kept one extra English stanza')
    return out.filter((s) => (s.linesEn && s.linesEn.some(Boolean)) || (s.linesEs && s.linesEs.some(Boolean)) || s.notes)
  }
  const n = Math.max(en.length, es.length)
  if (en.length && es.length && Math.abs(en.length - es.length) >= 3) {
    flags.push(`section counts differ (EN ${en.length}, ES ${es.length}); paired in order`)
  } else if (en.length && es.length && en.length !== es.length) {
    flags.push(`section counts differ slightly (EN ${en.length}, ES ${es.length}); paired in order`)
  }
  const out = []
  for (let i = 0; i < n; i++) out.push(mergeSectionPair(en[i], es[i]))
  return out.filter((s) => (s.linesEn && s.linesEn.some(Boolean)) || (s.linesEs && s.linesEs.some(Boolean)) || s.notes)
}

function splitFieldToLangs(lines, flags, fieldName) {
  const compact = compactStanzas(lines)
  const counts = mixedLangCounts(compact)
  if (counts.en >= 2 && counts.es >= 2) {
    const pivot = findLangPivot(compact)
    if (pivot >= 0) {
      const first = compact.slice(0, pivot)
      const second = compact.slice(pivot)
      const l1 = langOfLines(first)
      const l2 = langOfLines(second)
      if ((l1 === 'en' && l2 === 'es') || (l1 === 'es' && l2 === 'en')) {
        flags.push(`split mixed ${fieldName} field at language change`)
        return l1 === 'en'
          ? { en: extractFromLines(first, flags, 'en'), es: extractFromLines(second, flags, 'es'), mixed: true }
          : { en: extractFromLines(second, flags, 'en'), es: extractFromLines(first, flags, 'es'), mixed: true }
      }
    }
    flags.push(`mixed languages in ${fieldName} field could not be split confidently`)
    return { en: extractFromLines(compact, flags, fieldName), es: [], mixed: true, uncertain: true }
  }
  const lang = langOfLines(compact)
  const secs = extractFromLines(compact, flags, fieldName)
  const side = String(fieldName || '').toLowerCase()
  if (lang === 'es') return { en: [], es: secs, mixed: false }
  if (lang === 'en') return { en: secs, es: [], mixed: false }
  // unknown / empty: keep on the original side ('EN' or 'ES')
  if (side === 'es') return { en: [], es: secs, mixed: false }
  return { en: secs, es: [], mixed: false }
}

function buildOtherTitles(library) {
  const map = new Map()
  for (const s of library || []) {
    const keys = [s.title, ...(s.aliases || [])]
    for (const t of keys) {
      const parts = String(t || '').split(/\s*\/\s*/)
      for (const p of [t, ...parts]) {
        const f = foldTitle(p)
        if (!f || f.length < 8) continue
        if (!map.has(f)) map.set(f, new Set())
        map.get(f).add(s.id)
      }
    }
  }
  return map
}


function looksLikeTitleLine(line, song) {
  const raw = tidyLyricLine(line).replace(/\s*\[[A-G][#b♯♭]?m?\]\s*$/i, '')
  const stripped = tidyTitlePart(raw)
  if (!stripped) return false
  const fold = foldTitle(stripped)
  if (!fold || fold.length < 6) return false
  const titles = [song.title, ...(song.aliases || [])]
  for (const t of titles) {
    if (foldTitle(t) === fold) return true
    for (const part of String(t || '').split(/\s*\/\s*/)) {
      if (foldTitle(part) && foldTitle(part) === fold) return true
    }
  }
  // "Title / Other title (my tribute)[G]" where the left or both match
  const parts = stripped.split(/\s*\/\s*/)
  if (parts.length === 2) {
    const folds = [foldTitle(parts[0]), foldTitle(parts[1])]
    const all = titles.flatMap((t) => [foldTitle(t), ...String(t).split(/\s*\/\s*/).map(foldTitle)])
    if (folds.every((f) => f && all.includes(f))) return true
    if (folds.some((f) => f && all.includes(f)) && /\[[A-G]|\(my tribute\)|\(f#?\)/i.test(line)) return true
  }
  return false
}

function dropLeadingTitleLines(lines, song) {
  const out = [...(lines || [])]
  const first = out.findIndex((l) => String(l || '').trim())
  if (first < 0) return out
  const line = out[first]
  const isHeader = looksLikeTitleLine(line, song) && /\[[A-G][#b♯♭]?m?\]|\(my tribute\)/i.test(line)
  if (isHeader) out.splice(0, first + 1)
  return out
}

export function cleanSong(song, opts = {}) {
  const flags = []
  const changes = []
  const otherTitles = opts.otherTitles || buildOtherTitles(opts.library || [])
  const original = song
  const titleRes = cleanSongTitle(song.title)
  for (const f of titleRes.flags) flags.push(f)
  let title = titleRes.title || song.title
  if (title !== song.title) changes.push('title')

  let artist = song.artist || ''
  if (isLyricFragmentArtist(artist, song)) {
    artist = ''
    changes.push('artist')
    flags.push(`cleared lyric-fragment artist (${song.artist})`)
  }

  const sourceSections = song.sections || []
  let cutNotes = []

  const prepared = sourceSections.map((sec) => {
    const next = {
      ...sec,
      linesEn: dropLeadingTitleLines([...(sec.linesEn || [])], song),
      linesEs: dropLeadingTitleLines([...(sec.linesEs || [])], song)
    }
    for (const field of ['linesEn', 'linesEs']) {
      const cut = findAppendedIndex(next[field], song, otherTitles)
      if (cut >= 0) {
        const leftover = compactStanzas(next[field].slice(cut))
        const head = leftover[0] || '(untitled fragment)'
        flags.push(`possible extra song in ${field === 'linesEn' ? 'EN' : 'ES'} starting at: "${String(head).slice(0, 80)}"; left in place`)
      }
    }
    return next
  })

  const uncertainBefore = flags.some((f) => /could not be split|possible medley|possible two songs/.test(f))

  // If any field is mixed and cannot be split, fall back to minimal cleaning
  let forcedMinimal = flags.some((f) => /possible extra song/.test(f))
  if (forcedMinimal) flags.push('multi-song record: applied section/spacing cleanup only, did not move lines between languages')
  const precheckFlags = []
  for (const sec of prepared) {
    for (const [name, lines] of [['EN', sec.linesEn], ['ES', sec.linesEs]]) {
      const counts = mixedLangCounts(compactStanzas(lines))
      if (counts.en >= 2 && counts.es >= 2 && findLangPivot(compactStanzas(lines)) < 0) {
        precheckFlags.push(`mixed languages in ${name} field could not be split confidently`)
        forcedMinimal = true
      }
    }
  }

  let outSections
  if (forcedMinimal) {
    flags.push(...precheckFlags)
    flags.push('left language fields in place (uncertain mix); applied minimal cleaning only')
    outSections = extractMinimalSections(prepared)
    changes.push('minimal-clean')
  } else {
    const enSecs = []
    const esSecs = []
    for (const sec of prepared) {
      const fromEn = splitFieldToLangs(sec.linesEn, flags, 'EN')
      const fromEs = splitFieldToLangs(sec.linesEs, flags, 'ES')
      if (fromEn.uncertain || fromEs.uncertain) {
        forcedMinimal = true
        break
      }
      const enParts = [...fromEn.en, ...fromEs.en]
      const esParts = [...fromEn.es, ...fromEs.es]
      // If the original section already had a type/label, stamp it on a single-section side
      if (enParts.length === 1 && (sec.label || (sec.type && sec.type !== 'verse'))) {
        enParts[0] = {
          ...enParts[0],
          type: sec.type && sec.type !== 'verse' ? sec.type : enParts[0].type,
          label: normalizeExistingLabel(sec.label, sec.type) || enParts[0].label,
          notes: [sec.notes, enParts[0].notes].filter(Boolean).join(' · ')
        }
      }
      if (esParts.length === 1 && (sec.label || (sec.type && sec.type !== 'verse'))) {
        esParts[0] = {
          ...esParts[0],
          type: sec.type && sec.type !== 'verse' ? sec.type : esParts[0].type,
          label: normalizeExistingLabel(sec.label, sec.type) || esParts[0].label,
          notes: [sec.notes, esParts[0].notes].filter(Boolean).join(' · ')
        }
      }
      // If one side stayed as a single unlabeled blob and the other split into sections,
      // split the blob by stanza to pair
      const aligned = alignByStanzas(enParts, esParts, flags)
      enSecs.push(...aligned.en)
      esSecs.push(...aligned.es)
    }
    if (forcedMinimal) {
      flags.push('left language fields in place (uncertain mix); applied minimal cleaning only')
      outSections = extractMinimalSections(prepared)
      changes.push('minimal-clean')
    } else {
      outSections = pairSectionLists(enSecs, esSecs, flags)
      // Swap if sides look reversed overall
      const enLang = langOfLines(outSections.flatMap((s) => s.linesEn))
      const esLang = langOfLines(outSections.flatMap((s) => s.linesEs))
      if (enLang === 'es' && esLang === 'en') {
        for (const s of outSections) {
          const tmp = s.linesEn
          s.linesEn = s.linesEs
          s.linesEs = tmp
        }
        flags.push('swapped EN/ES fields (languages were reversed)')
        changes.push('swapped-langs')
      } else if (enLang === 'es' && esLang === 'empty') {
        for (const s of outSections) {
          s.linesEs = s.linesEn
          s.linesEn = []
        }
        flags.push('moved Spanish lyrics from the English field to the Spanish field')
        changes.push('moved-es')
      } else if (esLang === 'en' && enLang === 'empty') {
        for (const s of outSections) {
          s.linesEn = s.linesEs
          s.linesEs = []
        }
        flags.push('moved English lyrics from the Spanish field to the English field')
        changes.push('moved-en')
      }
      changes.push('sections')
    }
  }

  // Normalize labels on the way out
  outSections = (outSections || []).map((s) => ({
    type: s.type || 'verse',
    label: normalizeExistingLabel(s.label, s.type),
    notes: s.notes || '',
    linesEn: compactStanzas(s.linesEn || []),
    linesEs: compactStanzas(s.linesEs || [])
  })).filter((s) => s.linesEn.some(Boolean) || s.linesEs.some(Boolean) || s.notes)

  if (!outSections.length) {
    flags.push('cleaner produced no sections; left original in place')
    outSections = (song.sections || []).map((s) => ({
      type: s.type || 'verse',
      label: s.label || '',
      notes: s.notes || '',
      linesEn: s.linesEn || [],
      linesEs: s.linesEs || []
    }))
  }

  let notes = song.notes || ''
  // Don't append removed leftover lyrics into notes (they can be huge / other songs).
  // Flags already record what was removed.

  const cleaned = {
    ...song,
    title,
    artist,
    notes,
    sections: outSections
  }

  const action = flags.some((f) =>
    /could not be split|left language fields|possible medley|possible two songs|produced no sections/.test(f)
  )
    ? 'flagged'
    : changes.length
      ? 'cleaned'
      : 'unchanged'

  return { song: cleaned, flags, changes, action }
}

function alignByStanzas(enParts, esParts, flags) {
  if (enParts.length === esParts.length) return { en: enParts, es: esParts }
  const enGroups = enParts.length === 1 ? stanzaGroups(enParts[0].lines || []) : null
  const esGroups = esParts.length === 1 ? stanzaGroups(esParts[0].lines || []) : null
  const oneEn = enGroups && enGroups.length >= 2 && esParts.length >= 2
  const oneEs = esGroups && esGroups.length >= 2 && enParts.length >= 2
  if (oneEn) {
    const split = enGroups.map((g, i) => ({
      type: esParts[i]?.type || enParts[0].type,
      label: esParts[i]?.label || '',
      notes: i === 0 ? enParts[0].notes : '',
      lines: g
    }))
    flags.push('split English blob by stanza to pair with Spanish sections')
    return { en: split, es: esParts }
  }
  if (oneEs) {
    const split = esGroups.map((g, i) => ({
      type: enParts[i]?.type || esParts[0].type,
      label: enParts[i]?.label || '',
      notes: i === 0 ? esParts[0].notes : '',
      lines: g
    }))
    flags.push('split Spanish blob by stanza to pair with English sections')
    return { en: enParts, es: split }
  }
  return { en: enParts, es: esParts }
}

export function normalizeExistingLabel(label, type) {
  const raw = String(label || '').trim()
  if (!raw) return type && type !== 'verse' ? labelForType(type) : ''
  const parsed = parseLooseHeader(raw)
  if (parsed && !parsed.stuckLyrics) return parsed.label
  // Verse I / Verse II already handled by parseLooseHeader; fallback tidy
  return raw.replace(/\s+/g, ' ')
}

export function cleanLibrary(songs) {
  const otherTitles = buildOtherTitles(songs)
  const cleaned = []
  const flagged = []
  const stats = { checked: songs.length, cleaned: 0, flagged: 0, unchanged: 0, bilingual: 0, splitBilingual: 0 }
  for (const src of songs || []) {
    const res = cleanSong(src, { otherTitles, library: songs })
    const before = langFlags(src.sections)
    const after = langFlags(res.song.sections)
    if (after.bilingual) stats.bilingual += 1
    if (!before.bilingual && after.bilingual) stats.splitBilingual += 1
    if (before.bilingual && after.bilingual) {
      // still count as a bilingual song we organized
    }
    cleaned.push(res.song)
    if (res.action === 'flagged' || res.flags.length) {
      // Only put on the flagged list when we're uncertain or we made a notable judgment call
      const serious = res.flags.filter((f) =>
        /could not be split|left language fields|possible medley|possible two songs|produced no sections|possible extra song|section counts differ \(EN/.test(f)
      )
      if (serious.length || res.action === 'flagged') {
        flagged.push({
          id: src.id,
          title: res.song.title,
          originalTitle: src.title,
          reasons: res.flags,
          action: res.action,
          changes: res.changes
        })
        stats.flagged += 1
      } else if (res.action === 'cleaned' || res.changes.length) {
        stats.cleaned += 1
      } else {
        stats.unchanged += 1
      }
    } else if (res.action === 'cleaned' || res.changes.length) {
      stats.cleaned += 1
    } else {
      stats.unchanged += 1
    }
  }
  // recount cleaned excluding flagged? Keep both: cleaned includes songs we changed that aren't flagged-as-uncertain
  return { songs: cleaned, flagged, stats }
}

function langFlags(sections) {
  const en = (sections || []).some((s) => (s.linesEn || []).some(Boolean))
  const es = (sections || []).some((s) => (s.linesEs || []).some(Boolean))
  return { en, es, bilingual: en && es }
}

export { langFlags as songLangFlags, buildOtherTitles }
