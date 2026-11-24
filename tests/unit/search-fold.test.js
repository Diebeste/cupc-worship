import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { foldSearch } from '../../src/music/foldTitle.js'
import { songMatchesQuery, searchHaystack, songToPlainText } from '../../src/music/parseLyrics.js'

const senorSong = {
  title: 'ERES SENOR',
  artist: '',
  originalKey: '',
  notes: '',
  sections: [{ linesEs: ['Eres Señor de la tierra'], linesEn: [] }]
}

const accentSong = {
  title: 'El Señor está en este lugar / The Lord is here',
  artist: '',
  originalKey: 'Dm',
  notes: '',
  sections: [{ linesEs: ['El Señor está en este lugar'], linesEn: ['The Lord is here'] }]
}

describe('foldSearch', () => {
  it('strips Spanish diacritics and punctuation but keeps words', () => {
    assert.equal(foldSearch('Señor está'), 'senor esta')
    assert.equal(foldSearch('SENOR'), foldSearch('Señor'))
    assert.equal(foldSearch('  Más  de  ti  '), 'mas de ti')
  })
})

describe('songMatchesQuery', () => {
  it('matches accented queries to unaccented titles and lyrics', () => {
    assert.equal(songMatchesQuery(senorSong, 'señor'), true)
    assert.equal(songMatchesQuery(senorSong, 'SENOR'), true)
    assert.equal(songMatchesQuery(accentSong, 'senor esta'), true)
    assert.equal(songMatchesQuery(accentSong, 'Señor está'), true)
  })

  it('does not match unrelated queries', () => {
    assert.equal(songMatchesQuery(senorSong, 'zzzqqq'), false)
    assert.equal(songMatchesQuery(accentSong, ''), true)
  })

  it('searches titles, lyrics, and keys in the haystack', () => {
    assert.match(searchHaystack(accentSong), /señor está/i)
    assert.equal(songMatchesQuery(accentSong, 'dm'), true)
  })
})

describe('songToPlainText', () => {
  it('keeps [ES]/[EN] tags when stripping chords', () => {
    const song = {
      title: 'Example',
      originalKey: 'G',
      sections: [{
        type: 'verse',
        label: 'Verse',
        linesEs: ['[G]Santo, [C]santo'],
        linesEn: ['[G]Holy, [C]holy']
      }]
    }
    const text = songToPlainText(song, { lang: 'both', chords: false })
    assert.match(text, /\[ES\]/)
    assert.match(text, /\[EN\]/)
    assert.equal(text.includes('[G]'), false)
    assert.equal(text.includes('[C]'), false)
    assert.match(text, /Santo, santo/)
    assert.match(text, /Holy, holy/)
  })
})
