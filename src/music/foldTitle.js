/** Shared title normalization for library merge and runtime seed updates. */

const SOLFEGE = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' }

const KEY_TAIL = /(\s*[\(\[]\s*(?:[A-G][#b♯♭]?(?:m|min|maj)?|DO|RE|MI|FA|SOL|LA|SI)(?:\s*[-–\/]\s*[A-G][#b♯♭]?)?\s*[\)\]])\s*$/i
const KEY_WORDS_TAIL = /(?:,\s*|\s+[-–]\s+|\s+)(?:([A-G][#b♯♭]?)\s*(major|minor|mayor|menor)|((?:do|re|mi|fa|sol|la|si)\s+mayor)|((?:do|re|mi|fa|sol|la|si)\s+menor)|la mayor|re menor|FA|SOL)\s*$/i
const TRAILING_KEY = /\s+([A-G][#b♯♭]?m?|DO|RE|MI|FA|SOL|LA|SI)\s*$/i

const ES_WORDS = /\b(el|la|los|las|de|del|que|y|en|un|una|por|con|mi|tu|su|te|me|al|se|es|no|yo|tú|ti|señor|dios|jesús|cristo|amor|gloria|digno|santo|nombre|vida|hoy|para|como|eres|todo|ante|sin|tus|porque|cuando|más|este|esta|sea|solo|sólo|imparable|presencia|pies|cadena)\b/gi
const EN_WORDS = /\b(the|and|you|your|to|of|in|my|me|is|it|for|with|that|this|are|we|our|i|how|lord|jesus|christ|love|glory|holy|name|heart|come|give|there|when|from|will|not|but|one|him|his|us|have|can|oh|all|so|at|feet|believe)\b/gi

export function foldTitle(s) {
  let t = String(s || '')
    .replace(/^\s*\d+[).:-]\s*/, '')
    .replace(KEY_TAIL, '')
    .replace(KEY_WORDS_TAIL, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/\b(major|minor|mayor|menor|sostenido|bemol)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an|el|la|los|las|de|del|y|and|of)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return t
}

export function slugTitle(s) {
  const f = foldTitle(s) || 'untitled'
  return f.replace(/\s+/g, '-').slice(0, 80)
}

export function parseKeyToken(raw) {
  if (raw == null || raw === '') return ''
  let s = String(raw).trim().replace(/♯/g, '#').replace(/♭/g, 'b')
  const sol = s.match(/^(do|re|mi|fa|sol|la|si)\b/i)
  if (sol) {
    const note = SOLFEGE[sol[1].toLowerCase()]
    const minor = /menor|minor|\bm\b/i.test(s)
    return note + (minor ? 'm' : '')
  }
  const m = s.match(/^([A-Ga-g])(#|b)?\s*(m|min|minor|menor|maj|major|mayor)?/)
  if (!m) {
    const words = s.toLowerCase().replace(/\s+/g, ' ')
    const named = {
      'la mayor': 'A', 'la menor': 'Am',
      're menor': 'Dm', 're mayor': 'D',
      'mi menor': 'Em', 'mi mayor': 'E',
      'fa mayor': 'F', 'fa menor': 'Fm',
      'sol mayor': 'G', 'sol menor': 'Gm',
      'do mayor': 'C', 'do menor': 'Cm',
      'si menor': 'Bm', 'si mayor': 'B'
    }
    return named[words] || ''
  }
  const note = m[1].toUpperCase() + (m[2] || '')
  const q = (m[3] || '').toLowerCase()
  const minor = q === 'm' || q === 'min' || q === 'minor' || q === 'menor'
  return note + (minor ? 'm' : '')
}

export function extractKeyFromText(s) {
  const line = String(s || '').trim()
  let m = line.match(/[\(\[]\s*([A-G][#b♯♭]?(?:m|min)?|DO|RE|MI|FA|SOL|LA|SI)(?:\s*[-–\/]\s*([A-G][#b♯♭]?|DO|RE|MI|FA|SOL|LA|SI))?\s*[\)\]]/i)
  if (m) return parseKeyToken(m[1])
  m = line.match(/,\s*([A-G][#b♯♭]?)\s*(major|minor|mayor|menor)\s*$/i)
  if (m) return parseKeyToken(m[1] + ' ' + m[2])
  m = line.match(/[-–,]\s*([A-G][#b♯♭]?)\s*(major|minor|mayor|menor)\s*$/i)
  if (m) return parseKeyToken(m[1] + ' ' + m[2])
  m = line.match(/\b((?:do|re|mi|fa|sol|la|si)\s+(?:mayor|menor)|la mayor|re menor)\s*$/i)
  if (m) return parseKeyToken(m[1])
  m = line.match(/\s+([A-G][#b♯♭]?m?|FA|SOL|DO|RE|MI|LA|SI)\s*$/i)
  if (m && String(s).length <= 80) return parseKeyToken(m[1])
  m = line.match(/\s+([A-G][#b♯♭]?m?)\)\s*$/)
  if (m) return parseKeyToken(m[1])
  return ''
}

export function langGuess(s) {
  const t = String(s || '')
  const es = (t.match(ES_WORDS) || []).length + (/[áéíóúñüÁÉÍÓÚÑÜ]/.test(t) ? 2 : 0)
  const en = (t.match(EN_WORDS) || []).length
  if (es >= en + 1 && es > 0) return 'es'
  if (en >= es + 1 && en > 0) return 'en'
  return ''
}

export function splitBilingualTitle(title) {
  const s = String(title || '').replace(/\s+/g, ' ').trim()
  const parts = s.split(/\s*[\/_|]+\s*/)
  if (parts.length === 2 && parts[0].length > 2 && parts[1].length > 2) {
    const l0 = langGuess(parts[0])
    const l1 = langGuess(parts[1])
    if (l0 && l1 && l0 !== l1) return parts.map((p) => p.trim())
  }
  const comma = s.split(/\s*,\s*/)
  if (comma.length === 2 && comma[0].length > 3 && comma[1].length > 3 && !/major|minor|mayor|menor/i.test(comma[1])) {
    const l0 = langGuess(comma[0])
    const l1 = langGuess(comma[1])
    if (l0 && l1 && l0 !== l1) return comma.map((p) => p.trim())
  }
  return [s]
}

export function cleanupTitle(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim()
  t = t.replace(/^["“”]+|["“”]+$/g, '')
  t = t.replace(/^\/+/, '').trim()
  t = t.replace(/^::TITLE::\s*/i, '')
  t = t.replace(/^[-—–]+\s*/, '')
  t = t.replace(KEY_TAIL, '')
  t = t.replace(KEY_WORDS_TAIL, '')
  t = t.replace(TRAILING_KEY, (m, k) => (parseKeyToken(k) ? '' : m))
  t = t.replace(/\s+[A-G][#b♯♭]?m?\s*\)\s*$/i, '')
  t = t.replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim()
  return t
}

export function isJunkTitle(title) {
  const s = cleanupTitle(title)
  if (!s || s.length < 3) return true
  const n = s.replace(/[.,;:]+$/, '').trim()
  const pat = new RegExp(
    [
      '^(?:\\[\\s*)?(?:bridge|chorus|verse|pre-?chorus|tag|intro|outro|coro|verso|puente|estrofa)(?:\\s*\\d+)?\\s*\\]?$',
      '^(?:\\(\\s*)?(?:coro|verso|puente|bridge|brandon|chorus)\\s*\\)?$',
      '^(?:-*)\\s*(?:verse|verso|estrofa|chorus|coro|bridge|song|sing)\\s*\\d*\\s*-*$',
      '^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\\s*[&+]\\s*(?:domingo|sunday|jueves))?$',
      '^(?:jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{2,4})?$',
      '^(?:january|february|march|april|june|july|august|september|october|november|december|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\\s+\\d',
      '^(?:x\\s+)?(?:march|april|may|june|july|agosto|septiembre)\\s+\\d',
      '^(?:songs?|canciones)\\b',
      '^(?:youth service|j[oó]venes|jueves ac[uú]stico|semana de alabanza|sin instrumentos|untitled document.*|documento sin t[ií]tulo.*)$',
      '^(?:ladies.*missionary|missionary\\s+(?:april|march|august|may|service)|vigilia\\b.*|third service|second service.*|first service|general agosto|friday\\b.*songs|kids)$',
      '^\\d{1,2}[_./-]\\d{1,2}(?:[_./-]\\d{2,4})?$',
      '^(?:may)\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s*,?\\s*\\d{2,4})?$'
    ].join('|'),
    'i'
  )
  return pat.test(n)
}
