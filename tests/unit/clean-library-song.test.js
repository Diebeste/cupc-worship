import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseLooseHeader,
  unstickRunonLine,
  compactStanzas,
  isLyricFragmentArtist,
  cleanSongTitle,
  titleCasePhrase,
  detectLineLang,
  cleanSong,
  cleanLibrary
} from '../../src/music/cleanLibrarySong.js'

describe('parseLooseHeader', () => {
  it('normalizes English, Spanish and numbered labels', () => {
    assert.deepEqual(parseLooseHeader('(Chorus)'), { type: 'chorus', label: 'Chorus', notes: '' })
    assert.deepEqual(parseLooseHeader('(CORO)'), { type: 'chorus', label: 'Chorus', notes: '' })
    assert.deepEqual(parseLooseHeader('[Chorus 1]'), { type: 'chorus', label: 'Chorus 1', notes: '' })
    assert.deepEqual(parseLooseHeader('Verse I'), { type: 'verse', label: 'Verse 1', notes: '' })
    assert.deepEqual(parseLooseHeader('Verse II'), { type: 'verse', label: 'Verse 2', notes: '' })
    assert.deepEqual(parseLooseHeader('Pre-Chorus'), { type: 'prechorus', label: 'Pre-Chorus', notes: '' })
    assert.deepEqual(parseLooseHeader('Pre-Coro'), { type: 'prechorus', label: 'Pre-Chorus', notes: '' })
    assert.deepEqual(parseLooseHeader('Puente'), { type: 'bridge', label: 'Bridge', notes: '' })
    assert.deepEqual(parseLooseHeader('Chorus 2X'), { type: 'chorus', label: 'Chorus', notes: 'x2' })
    assert.deepEqual(parseLooseHeader('Chorus X2'), { type: 'chorus', label: 'Chorus', notes: 'x2' })
    assert.deepEqual(parseLooseHeader('Coro (unísono)'), { type: 'chorus', label: 'Chorus', notes: 'unísono' })
    assert.deepEqual(parseLooseHeader('Coro(armonía)'), { type: 'chorus', label: 'Chorus', notes: 'armonía' })
    assert.deepEqual(parseLooseHeader('Verse]'), { type: 'verse', label: 'Verse', notes: '' })
    assert.equal(parseLooseHeader('Verse 1Worthy of ev’ry song').type, 'verse')
    assert.equal(parseLooseHeader('Verse 1Worthy of ev’ry song').label, 'Verse 1')
    assert.match(parseLooseHeader('Verse 1Worthy of ev’ry song').stuckLyrics, /Worthy/)
    assert.equal(parseLooseHeader('Above all powers'), null)
  })
})

describe('unstickRunonLine and compactStanzas', () => {
  it('splits camel-concatenated English lines and drops junk markers', () => {
    const parts = unstickRunonLine(
      "Worthy of ev’ry song we could ever singWorthy of all the praise we could ever bringWorthy of ev’ry breath we could ever breatheWe live for You"
    )
    assert.deepEqual(parts, [
      'Worthy of ev’ry song we could ever sing',
      'Worthy of all the praise we could ever bring',
      'Worthy of ev’ry breath we could ever breathe',
      'We live for You'
    ])
    assert.deepEqual(unstickRunonLine("'Cause I know there is peace"), ["'Cause I know there is peace"])
    assert.deepEqual(compactStanzas(['Hello', '', '', '---', '', 'World', '---/']), ['Hello', '', 'World'])
    assert.deepEqual(compactStanzas(['Hello', '', '', 'World']), ['Hello', '', 'World'])
    assert.deepEqual(compactStanzas(['Hello', '', 'World']), ['Hello', '', 'World'])
    assert.deepEqual(compactStanzas(['A', '', 'B', '', 'C', '', '', 'D', '', 'E']), ['A', 'B', 'C', '', 'D', 'E'])
  })
})

describe('titles and artists', () => {
  it('title-cases all-caps titles and drops duplicate same-language parts', () => {
    assert.equal(cleanSongTitle('ABRE MIS OJOS OH CRISTO / Abre mis ojos').title, 'Abre mis ojos oh Cristo')
    assert.equal(cleanSongTitle('BLESSED BE THE NAME').title, 'Blessed Be the Name')
    assert.equal(cleanSongTitle('FAMOUS FOR (I BELIEVE)').title, 'Famous for (I Believe)')
    assert.equal(cleanSongTitle('At your feet / A tus pies').title, 'At your feet / A tus pies')
    assert.ok(cleanSongTitle('Cadenas romper / break every chain / There is power in the name of Jesus').flags.some((f) => /medley/.test(f)))
    assert.ok(cleanSongTitle('Anhelo conocerte mas / Lo único que quiero es adorarte').flags.some((f) => /two songs/.test(f)))
  })
  it('detects lyric-fragment artists', () => {
    assert.equal(
      isLyricFragmentArtist('the power of the name of Jesus', {
        title: 'Revelation song',
        sections: [{ linesEn: ['There is power in the name of Jesus'], linesEs: [] }]
      }),
      true
    )
    assert.equal(isLyricFragmentArtist('Hillsong Worship', { title: 'Hosanna', sections: [] }), false)
  })
  it('title-cases Spanish small words', () => {
    assert.equal(titleCasePhrase('EL DIOS QUE ADORAMOS', 'es'), 'El Dios que adoramos')
    assert.equal(titleCasePhrase('ERES SENOR', 'es'), 'Eres Señor')
    assert.equal(titleCasePhrase('ES JESUCRISTO, JEHOVÁ LA ROCA', 'es'), 'Es Jesucristo, Jehová la roca')
  })
})

describe('detectLineLang', () => {
  it('classifies English and Spanish lyric lines', () => {
    assert.equal(detectLineLang('Above all powers, above all kings'), 'en')
    assert.equal(detectLineLang('Sobre todo poder y rey'), 'es')
    assert.equal(detectLineLang('Digno de recibir toda adoración'), 'es')
  })
})

describe('cleanSong splitter', () => {
  it('splits Above All, drops the Offering leftover, and keeps languages in the right fields', () => {
    const src = {
      id: 'song-above-all',
      title: 'Above all',
      artist: '',
      originalKey: 'F',
      sections: [
        {
          type: 'verse',
          label: '',
          notes: '',
          linesEn: ['Above all powers', '', 'Above all kings', '', '', '(Chorus)', 'Crucified', '', 'Laid behind the stone', '', 'Above all'],
          linesEs: [
            'Sobre todo poder y rey Sobre toda humanidad y ley',
            '',
            'En la cruz moriste por amor',
            '',
            'Offering 🎶 :',
            '',
            'Give and it will come back to you',
            'Da y se te devolvera'
          ]
        }
      ]
    }
    const { song, flags } = cleanSong(src, { library: [src] })
    assert.equal(song.sections.length, 2)
    assert.equal(song.sections[0].type, 'verse')
    assert.equal(song.sections[1].type, 'chorus')
    assert.ok(song.sections[0].linesEn.join(' ').includes('Above all powers'))
    assert.ok(song.sections.some((s) => s.linesEs.some((l) => /Sobre todo/.test(l))))
    const all = song.sections.map((s) => [...(s.linesEn||[]), ...(s.linesEs||[])].join('\n')).join('\n')
    assert.match(all, /Give and it will come back/)
    assert.ok(flags.some((f) => /extra song/.test(f)))
    const enOnly = song.sections.flatMap((s) => s.linesEn).join('\n')
    const esOnly = song.sections.flatMap((s) => s.linesEs).join('\n')
    assert.ok(!/Sobre todo/.test(enOnly))
    assert.ok(!/Above all powers/.test(esOnly))
  })

  it('unsticks Build My Life English sections and pairs them with Spanish stanzas', () => {
    const src = {
      id: 'song-construire-mi-vida-build-my-life',
      title: 'Construiré mi vida / Build my life',
      artist: '',
      sections: [
        {
          type: 'verse',
          label: '',
          notes: '',
          linesEn: [
            'Construiré mi vida / Build my life [D#]',
            'Verse 1Worthy of ev’ry song we could ever singWorthy of all the praise we could ever bringWe live for You',
            '',
            'Verse 2Jesus the name above ev’ry other nameWe live for You',
            'ChorusHoly there is no one like You',
            'BridgeI will build my life upon Your love'
          ],
          linesEs: [
            'Digno de recibir toda adoración',
            'Vivo por ti',
            '',
            'Cristo Jesús, no hay otro nombre igual',
            'Vivo por ti, vivo por ti',
            '',
            'Santo, como Tú no hay nadie',
            'Y llevar tu amor al mundo',
            '',
            'Construiré mi vida en tu amor, ahí estoy seguro',
            'Y no seré movido'
          ]
        }
      ]
    }
    const { song } = cleanSong(src, { library: [src] })
    const types = song.sections.map((s) => s.type)
    assert.ok(types.includes('chorus'))
    assert.ok(types.includes('bridge'))
    assert.ok(types.includes('verse'))
    const enJoin = song.sections.flatMap((s) => s.linesEn).join('\n')
    const esJoin = song.sections.flatMap((s) => s.linesEs).join('\n')
    assert.ok(!/Verse 1Worthy/.test(enJoin))
    assert.match(enJoin, /Worthy of ev’ry song/)
    assert.ok(!/Digno de recibir/.test(enJoin))
    assert.match(esJoin, /Digno de recibir/)
    assert.ok(!/Holy there is no one/.test(esJoin))
    const chorus = song.sections.find((s) => s.type === 'chorus')
    assert.ok(chorus, 'expected a chorus section')
    assert.ok(chorus.linesEs.some((l) => /Santo, como T[úu]/.test(l)), 'chorus should have Spanish lyrics')
    const bridge = song.sections.find((s) => s.type === 'bridge')
    assert.ok(bridge.linesEs.some((l) => /Construir[eé] mi vida en tu amor/.test(l)))
  })

  it('moves Spanish out of the English field in Agnus Dei', () => {
    const src = {
      id: 'song-agnus-dei',
      title: 'Agnus Dei',
      sections: [
        {
          type: 'verse',
          label: '',
          notes: '',
          linesEn: [
            'Santo, Santo, El Señor Dios poderoso',
            'Digno Eres Tu, Digno eres tu',
            '',
            'Verse]',
            'Hallelujah, hallelujah',
            'For the Lord God Almighty reigns',
            '[Chorus 1]',
            'Holy, Holy',
            'Are You Lord God, Almighty'
          ],
          linesEs: ['//Aleluya//', 'el Señor Dios poderoso es', 'Digno eres tu']
        }
      ]
    }
    const { song } = cleanSong(src, { library: [src] })
    const en = song.sections.flatMap((s) => s.linesEn).join('\n')
    const es = song.sections.flatMap((s) => s.linesEs).join('\n')
    assert.match(en, /Hallelujah/)
    assert.match(en, /Holy, Holy/)
    assert.ok(!/Santo, Santo/.test(en))
    assert.match(es, /Santo, Santo/)
    assert.ok(song.sections.some((s) => s.type === 'chorus'))
  })

  it('clears a fragment artist and leaves a well-structured bilingual song intact', () => {
    const src = {
      id: 'song-at-your-feet',
      title: 'At your feet / A tus pies',
      artist: 'his stripes i am healed',
      sections: [
        { type: 'verse', label: 'Verse 1', notes: '', linesEn: ['At your feet, that\'s where'], linesEs: ['A Tus pies, arde mi corazón'] },
        { type: 'chorus', label: 'Chorus', notes: '', linesEn: ['There is no place that\'s higher'], linesEs: ['No hay lugar más alto, más grande'] }
      ]
    }
    const { song } = cleanSong(src, { library: [src] })
    assert.equal(song.artist, '')
    assert.equal(song.title, 'At your feet / A tus pies')
    assert.equal(song.sections.length, 2)
    assert.equal(song.sections[1].label, 'Chorus')
    assert.deepEqual(song.sections[0].linesEn, ['At your feet, that\'s where'])
    assert.deepEqual(song.sections[0].linesEs, ['A Tus pies, arde mi corazón'])
  })

  it('does not invent a translation for a Spanish-only song', () => {
    const src = {
      id: 'song-es-only',
      title: 'DIOS TE EXALTO',
      artist: '',
      sections: [{ type: 'verse', label: '', notes: '', linesEn: [], linesEs: ['Dios te exaltamos', 'Tu nombre es santo'] }]
    }
    const { song } = cleanSong(src, { library: [src] })
    assert.equal(song.title, 'Dios te exalto')
    assert.ok(song.sections.every((s) => !(s.linesEn || []).some(Boolean)))
    assert.ok(song.sections.some((s) => s.linesEs.includes('Dios te exaltamos')))
  })
})

describe('cleanLibrary', () => {
  it('returns cleaned songs and a flagged list', () => {
    const { songs, flagged, stats } = cleanLibrary([
      {
        id: 'a',
        title: 'Cadenas romper / break every chain / There is power in the name of Jesus',
        artist: '',
        sections: [{ type: 'verse', label: '', notes: '', linesEn: ['There is power in the name of Jesus'], linesEs: ['Hay poder en el nombre de Jesús'] }]
      }
    ])
    assert.equal(stats.checked, 1)
    assert.equal(songs[0].id, 'a')
    assert.ok(flagged.some((f) => f.id === 'a' && f.reasons.some((r) => /medley/.test(r))))
  })
})
