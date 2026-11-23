import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { foldTitle, splitBilingualTitle, isJunkTitle, cleanupTitle } from '../../src/music/foldTitle.js'
import { buildSeedSongs, mergeSeedSongs, isPristineSeed, SONG_LIBRARY_VERSION, librarySongs } from '../../src/data/seedLibrary.js'
import { SEED_SONGS, stampedSeed } from '../../src/data/seed.js'

describe('foldTitle', () => {
  it('normalizes keys, diacritics and articles', () => {
    assert.equal(foldTitle('Más de ti (F)'), 'mas ti')
    assert.equal(foldTitle('Por el poder de tu amor'), foldTitle('Por el poder tu amor'))
    assert.equal(foldTitle('Entra en la presencia (G)'), 'entra en presencia')
    assert.equal(isJunkTitle('Songs Sunday'), true)
    assert.equal(isJunkTitle('Vigilia día viernes'), true)
    assert.equal(isJunkTitle('Al estar ante ti'), false)
    assert.equal(cleanupTitle('Worthy of it all F'), 'Worthy of it all')
  })
  it('splits only EN/ES bilingual titles', () => {
    const pair = splitBilingualTitle('At your feet / A tus pies')
    assert.deepEqual(pair, ['At your feet', 'A tus pies'])
    assert.deepEqual(splitBilingualTitle('Dios de lo imposible / Entra en la presencia'), ['Dios de lo imposible / Entra en la presencia'])
  })
})

describe('library seed', () => {
  it('keeps reserved song IDs and packages a substantial library', () => {
    const seed = stampedSeed()
    const ids = seed.songs.map((s) => s.id)
    for (const id of SEED_SONGS.map((s) => s.id)) {
      assert.ok(ids.includes(id), 'missing reserved id ' + id)
    }
    assert.equal(ids.length, new Set(ids).size)
    assert.ok(seed.songs.length >= 200, 'expected 200+ songs, got ' + seed.songs.length)
    assert.equal(SONG_LIBRARY_VERSION, 3)
    const atFeet = seed.songs.find((s) => s.id === 'song-at-your-feet')
    assert.equal(atFeet.originalKey, 'G#')
    assert.ok(atFeet.sections.some((s) => (s.linesEn || []).some(Boolean)))
    assert.ok(atFeet.sections.some((s) => (s.linesEs || []).some(Boolean)))
    const cristo = seed.songs.find((s) => s.id === 'song-cristo-yo-te-amo')
    assert.equal(cristo.title, 'Cristo yo te amo')
  })

  it('does not overwrite user-edited songs and does not duplicate titles', () => {
    const curated = buildSeedSongs(SEED_SONGS, librarySongs)
    const existing = [
      { id: 'song-cristo-yo-te-amo', title: 'Cristo yo te amo', userEdited: true, seeded: true, createdAt: '2026-11-15T00:00:00.000Z', updatedAt: '2026-11-20T00:00:00.000Z', sections: [{ type: 'verse', linesEn: ['edited'], linesEs: [] }] },
      { id: 'user-1', title: 'Way maker', createdAt: '2026-11-18T00:00:00.000Z', updatedAt: '2026-11-18T00:00:00.000Z', sections: [] }
    ]
    const merged = mergeSeedSongs(existing, curated)
    const cristo = merged.find((s) => s.id === 'song-cristo-yo-te-amo')
    assert.deepEqual(cristo.sections[0].linesEn, ['edited'])
    assert.equal(merged.filter((s) => foldTitle(s.title) === foldTitle('Way maker')).length, 1)
    assert.ok(merged.length > 100)
    assert.equal(isPristineSeed({ seeded: true, createdAt: 'a', updatedAt: 'a' }), true)
    assert.equal(isPristineSeed({ seeded: true, createdAt: 'a', updatedAt: 'b' }), false)
  })
})
