/** Musical key / chord transposition and capo helpers. */

const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

const ALIASES = {
  'C#': 'C#',
  Db: 'C#',
  'D#': 'D#',
  Eb: 'D#',
  'F#': 'F#',
  Gb: 'F#',
  'G#': 'G#',
  Ab: 'G#',
  'A#': 'A#',
  Bb: 'A#',
  'B#': 'C',
  Cb: 'B',
  'E#': 'F',
  Fb: 'E',
  'DO': 'C',
  'RE': 'D',
  'MI': 'E',
  'FA': 'F',
  'SOL': 'G',
  'LA': 'A',
  'SI': 'B'
}

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm', 'Dbm', 'Gm'])

const CHORD_TOKEN = /\[([^\]]+)\]|(\b[A-G](?:#|b|♯|♭)?(?:m|min|maj|M|dim|aug|sus|add)?(?:\d+)?(?:\/[A-G](?:#|b|♯|♭)?)?\b)/g

export const KEYS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B']

export const COMMON_KEYS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'Ab', 'A', 'Bb', 'B']

export const ALL_SONG_KEYS = COMMON_KEYS.flatMap((k) => [k, k + 'm'])


function normalizeNote(note) {
  if (!note) return null
  let n = String(note).trim().replace('♯', '#').replace('♭', 'b')
  const m = n.match(/^([A-Ga-g])(#|b)?/)
  if (!m) return null
  const root = m[1].toUpperCase() + (m[2] || '')
  if (SHARPS.includes(root) || FLATS.includes(root)) return root
  return ALIASES[root] || null
}

export function parseKey(raw) {
  if (!raw) return ''
  const s = String(raw).trim()
  const solfege = { DO: 'C', RE: 'D', MI: 'E', FA: 'F', SOL: 'G', LA: 'A', SI: 'B' }
  const upper = s.toUpperCase()
  if (solfege[upper]) return solfege[upper]
  const m = s.match(/^([A-Ga-g])(#|b|♯|♭)?(m|min)?/)
  if (!m) return s
  const note = normalizeNote(m[1] + (m[2] || '').replace('♯', '#').replace('♭', 'b'))
  const minor = m[3] ? 'm' : ''
  return (note || s) + minor
}

export function noteIndex(note) {
  const n = normalizeNote(note)
  if (!n) return null
  const sharp = ALIASES[n] || n
  const i = SHARPS.indexOf(sharp)
  return i >= 0 ? i : null
}

export function preferFlatsFor(key) {
  const k = parseKey(key)
  return FLAT_KEYS.has(k) || /b/.test(k)
}

export function transposeNote(note, semitones, useFlats) {
  const i = noteIndex(note)
  if (i == null) return note
  const scale = useFlats ? FLATS : SHARPS
  return scale[(i + semitones + 120) % 12]
}

export function stepsBetween(fromKey, toKey) {
  const a = noteIndex(parseKey(fromKey))
  const b = noteIndex(parseKey(toKey))
  if (a == null || b == null) return 0
  return (b - a + 12) % 12
}

/** Transpose a single chord symbol such as "G", "F#m7", "C/E". */
export function transposeChord(chord, semitones, useFlats) {
  if (!chord || !semitones) return chord
  const m = String(chord)
    .trim()
    .match(/^([A-G](?:#|b|♯|♭)?)([^/]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/)
  if (!m) return chord
  const root = transposeNote(m[1], semitones, useFlats)
  const bass = m[3] ? '/' + transposeNote(m[3], semitones, useFlats) : ''
  return root + (m[2] || '') + bass
}

export function transposeText(text, semitones, useFlats) {
  if (!text || !semitones) return text
  return String(text).replace(CHORD_TOKEN, (all, pro, bare) => {
    const src = pro || bare
    const out = src
      .split(/\s+/)
      .map((c) => transposeChord(c, semitones, useFlats))
      .join(' ')
    return pro ? `[${out}]` : out
  })
}

export function capoSuggestion(playKey, soundKey) {
  const play = parseKey(playKey)
  const sound = parseKey(soundKey)
  const steps = stepsBetween(play, sound)
  if (!play || !sound) return { capo: 0, shapes: play || sound, text: '' }
  if (steps === 0) return { capo: 0, shapes: play, text: '' }
  return {
    capo: steps,
    shapes: play,
    text: `Capo ${steps} · play ${play} shapes`
  }
}

/** Given a song's original key and a target sounding key, return steps, chords helper, capo if staying in original shapes. */
export function transposePlan(originalKey, targetKey, { preferOriginalShapes = true } = {}) {
  const from = parseKey(originalKey) || 'C'
  const to = parseKey(targetKey) || from
  const steps = stepsBetween(from, to)
  const useFlats = preferFlatsFor(to)
  const capo = preferOriginalShapes ? capoSuggestion(from, to) : capoSuggestion(to, to)
  return { from, to, steps, useFlats, capo }
}

export function displayKey(key) {
  return parseKey(key) || key || '—'
}

export function transposeSections(sections, semitones, useFlats) {
  if (!semitones) return (sections || []).map((s) => ({ ...s, linesEn: [...(s.linesEn || [])], linesEs: [...(s.linesEs || [])] }))
  return (sections || []).map((s) => ({
    ...s,
    linesEn: (s.linesEn || []).map((line) => transposeText(line, semitones, useFlats)),
    linesEs: (s.linesEs || []).map((line) => transposeText(line, semitones, useFlats))
  }))
}
