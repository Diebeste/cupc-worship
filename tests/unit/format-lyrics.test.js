import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mergeChordOverLyric,
  injectChords,
  preprocessPastedText,
  formatSongsFromText,
  formatEditorLyrics,
  formatImportedSongs,
  stripFormatMeta,
  formatSummary,
  previewPlain
} from '../../src/music/formatLyrics.js'
import { cleanSong } from '../../src/music/cleanLibrarySong.js'

const EN_ONLY = `HOW GREAT IS OUR GOD (C)

Verse 1
The splendor of the King
Clothed in majesty
Let all the earth rejoice

Chorus
How great is our God
Sing with me how great is our God
`

const ES_ONLY = `Cristo yo te amo (F)

Cristo, yo te amo
Cristo, yo te amo
No hay nadie como Tú
Jesús

Coro
Te alabamos
Señor
`

const BILINGUAL = `Build My Life (A)

Verse 1
Worthy of ev’ry song we could ever sing
Worthy of all the praise we could ever bring

Chorus
Holy there is no one like You
There is none beside You

-----

Estrofa 1
Digno de recibir toda adoración
Digno de recibir hoy esta canción

Coro
Santo, como Tú no hay nadie
Dios incomparable
`

const CHORD_OVER = `Holy Holy Holy (E)

     G                C
Holy holy holy, Lord God Almighty
    G              D
All Thy works shall praise Thy name
`

const MESSY = `  \n\n\tverse 1\n\nThe   splendor   of   the   King\n\n\n---\n\n\nClothed in majesty\n\nChorus 2X\nHow great is our God\n\n  `

const CCLI = `How Great Is Our God
CCLI Song # 4348399
Chris Tomlin | Ed Cash | Jesse Reeves
© 2004 sixsteps Music
Key: C

Verse 1
The splendor of the King
Clothed in majesty

Chorus
How great is our God
Sing with me
`

function linesOf(song, lang) {
  const field = lang === 'en' ? 'linesEn' : 'linesEs'
  return (song.sections || []).flatMap((s) => s[field] || []).filter((l) => String(l || '').trim())
}

function labelsOf(song) {
  return (song.sections || []).map((s) => s.label || '').filter(Boolean)
}

describe('chord-over-lyric merge', () => {
  it('injects ChordPro markers at chord columns', () => {
    const out = injectChords('G          C', 'Holy holy holy')
    assert.match(out, /^\[G\]/)
    assert.match(out, /\[C\]/)
    assert.match(out, /Holy/)
    assert.equal(out.includes('Holy'), true)
  })

  it('merges a chords-above-lyrics pair into one line', () => {
    const text = mergeChordOverLyric('     G                C\nHoly holy holy, Lord God Almighty\n')
    const line = text.trim()
    assert.match(line, /\[G\]/)
    assert.match(line, /\[C\]/)
    const words = line.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim()
    assert.match(words, /Holy holy holy, Lord God Almighty/)
    assert.equal(line.includes('\n'), false)
  })
})

describe('preprocessPastedText', () => {
  it('strips CCLI and copyright into notes and writers into artist', () => {
    const { text, meta } = preprocessPastedText(CCLI)
    assert.equal(text.includes('CCLI Song'), false)
    assert.equal(text.includes('© 2004'), false)
    assert.equal(text.includes('Chris Tomlin'), false)
    assert.match(text, /The splendor of the King/)
    assert.match(meta.artist, /Chris Tomlin/)
    assert.match(meta.notes, /CCLI Song # 4348399/)
    assert.match(meta.notes, /© 2004/)
    assert.equal(meta.originalKey, 'C')
  })

  it('expands SongSelect short headers like [V1] and [C]', () => {
    const { text } = preprocessPastedText('[V1]\nThe splendor of the King\n[C]\nHow great is our God\n')
    assert.match(text, /Verse 1/)
    assert.match(text, /Chorus/)
    assert.equal(text.includes('[V1]'), false)
  })

  it('leaves JSON songbooks untouched', () => {
    const raw = '{ "songs": [ { "Text": "Hosanna" } ] }'
    const { text, meta } = preprocessPastedText(raw)
    assert.equal(text, raw)
    assert.equal(meta.notes, '')
  })
})

describe('formatSongsFromText', () => {
  it('formats English-only lyrics with standard section labels', () => {
    const { songs } = formatSongsFromText(EN_ONLY)
    assert.equal(songs.length, 1)
    const song = songs[0]
    assert.equal(song.originalKey, 'C')
    assert.match(song.title, /How Great Is Our God/i)
    const labels = labelsOf(song)
    assert.ok(labels.includes('Verse 1') || labels.includes('Verse'))
    assert.ok(labels.includes('Chorus'))
    const en = linesOf(song, 'en').join('\n')
    const es = linesOf(song, 'es').join('\n')
    assert.match(en, /The splendor of the King/)
    assert.match(en, /How great is our God/)
    assert.equal(es, '')
    assert.ok((song.sections || []).every((s) => s.type === 'verse' || s.type === 'chorus'))
  })

  it('formats Spanish-only lyrics into the Spanish box without translating', () => {
    const { songs } = formatSongsFromText(ES_ONLY)
    assert.equal(songs.length, 1)
    const song = songs[0]
    const es = linesOf(song, 'es').join('\n')
    const en = linesOf(song, 'en').join('\n')
    assert.match(es, /Cristo, yo te amo/)
    assert.match(es, /No hay nadie como Tú/)
    assert.equal(en, '')
    assert.ok(labelsOf(song).includes('Chorus') || song.sections.some((s) => s.type === 'chorus'))
    assert.equal(es.includes('I love you'), false)
  })

  it('splits a bilingual paste into EN and ES fields', () => {
    const { songs } = formatSongsFromText(BILINGUAL)
    assert.equal(songs.length, 1)
    const song = songs[0]
    const en = linesOf(song, 'en').join('\n')
    const es = linesOf(song, 'es').join('\n')
    assert.match(en, /Worthy of ev’ry song/)
    assert.match(en, /Holy there is no one like You/)
    assert.match(es, /Digno de recibir toda adoración/)
    assert.match(es, /Santo, como Tú no hay nadie/)
    assert.equal(en.includes('Digno de recibir'), false)
    assert.equal(es.includes('Worthy of'), false)
    assert.ok(song.sections.some((s) => (s.linesEn || []).some(Boolean) && (s.linesEs || []).some(Boolean)))
  })

  it('turns chord-over-lyric text into ChordPro and keeps the words', () => {
    const { songs } = formatSongsFromText(CHORD_OVER)
    const en = linesOf(songs[0], 'en').join('\n')
    assert.match(en, /\[G\]/)
    assert.match(en, /\[C\]/)
    const words = en.replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ')
    assert.match(words, /Holy holy holy/)
    assert.match(words, /All Thy works shall praise Thy name/)
  })

  it('compacts messy whitespace and normalizes Chorus 2X notes', () => {
    const { songs } = formatSongsFromText(MESSY)
    const song = songs[0]
    const en = (song.sections || []).flatMap((s) => s.linesEn || [])
    assert.ok(!en.some((l) => /^\s+$/.test(l)))
    assert.ok(!en.includes('---'))
    assert.match(en.filter(Boolean).join('\n'), /The\s+splendor\s+of\s+the\s+King/)
    const chorus = song.sections.find((s) => s.type === 'chorus')
    assert.ok(chorus)
    assert.match(String(chorus.notes || ''), /x2/)
  })

  it('is idempotent on already-cleaned library-style songs', () => {
    const first = formatSongsFromText(BILINGUAL).songs[0]
    const again = formatImportedSongs([stripFormatMeta(first)])[0]
    assert.deepEqual(again.sections, first.sections)
    assert.equal(again.title, first.title)
    assert.equal(again._formatted, false)
  })

  it('marks a bilingual paste as reformatted and a library-style paste as unchanged', () => {
    const { songs } = formatSongsFromText(BILINGUAL)
    assert.equal(songs[0]._formatted, true)
    assert.equal(formatSummary(songs).formatted, 1)
    const again = formatSongsFromText(previewPlain(songs[0])).songs[0]
    assert.equal(again._formatted, false)
    assert.equal(formatSummary([again]).formatted, 0)
  })

  it('does not invent a translation', () => {
    const { songs } = formatSongsFromText(ES_ONLY)
    const blob = JSON.stringify(songs[0].sections)
    assert.equal(/how i love you|jesus how/i.test(blob), false)
  })
})

describe('formatEditorLyrics and imports', () => {
  it('formats typed EN and ES boxes into paired sections', () => {
    const { song } = formatEditorLyrics({
      title: 'Build my life',
      originalKey: 'A',
      esText: 'Coro\nSanto, como Tú no hay nadie\nDios incomparable\n',
      enText: 'Chorus\nHoly there is no one like You\nThere is none beside You\n'
    })
    assert.ok(song.sections.some((s) => s.type === 'chorus'))
    assert.match(linesOf(song, 'es').join('\n'), /Santo, como Tú no hay nadie/)
    assert.match(linesOf(song, 'en').join('\n'), /Holy there is no one like You/)
  })

  it('formatImportedSongs marks reformatted songs and stripFormatMeta drops internals', () => {
    const raw = {
      title: 'HOW GREAT IS OUR GOD',
      originalKey: 'C',
      artist: '',
      sections: [{ type: 'verse', label: 'verse 1', notes: '', linesEn: ['The splendor of the King', '', '', 'Clothed in majesty'], linesEs: [] }]
    }
    const [out] = formatImportedSongs([raw])
    assert.equal(out._formatted, true)
    assert.equal(formatSummary([out]).formatted, 1)
    const saved = stripFormatMeta(out)
    assert.equal(saved._formatted, undefined)
    assert.equal(saved._formatFlags, undefined)
    assert.match(saved.title, /How Great Is Our God|HOW GREAT/)
    const cleaned = cleanSong(raw).song
    assert.deepEqual(saved.sections, cleaned.sections)
  })
})
