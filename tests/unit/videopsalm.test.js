import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import {
  looksLikeVideoPsalm,
  looksLikeVideoPsalmPlain,
  parseVideoPsalmJson,
  parseVideoPsalmPlain,
  parseVideoPsalm,
  repairVideoPsalmJson,
  splitVerseLabel
} from '../../src/music/videopsalm.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const examples = join(root, 'public/examples')
const read = (name) => readFileSync(join(examples, name))

test('repairs official OpenLP fixture: BOM, unquoted keys, Capo, CCLI', () => {
  const buf = read('videopsalm-as-safe-a-stronghold.json')
  assert.equal(buf[0], 0xef)
  const raw = buf.toString('utf8')
  assert.equal(raw.charCodeAt(0), 0xfeff)
  assert.equal(looksLikeVideoPsalm(raw), true)
  const songs = parseVideoPsalmJson(raw)
  assert.equal(songs.length, 1)
  const s = songs[0]
  assert.equal(s.title, 'A Safe Stronghold Our God is Still')
  assert.equal(s.artist, 'Martin Luther / Unknown')
  assert.equal(s.ccli, '12345')
  assert.match(s.notes, /Copyright: Public Domain/)
  assert.match(s.notes, /CCLI: 12345/)
  assert.match(s.notes, /Capo: -1/)
  assert.match(s.notes, /Songbook: SongBook1/)
  assert.equal(s.sections.length, 4)
  const text = s.sections.flatMap((sec) => [...(sec.linesEn || []), ...(sec.linesEs || [])]).join('\n')
  assert.match(text, /As safe a stronghold our God is still/)
  assert.match(text, /The city of God remaineth/)
  // Repair must produce valid JSON with quoted keys
  const parsed = JSON.parse(repairVideoPsalmJson(raw))
  assert.equal(parsed.Abbreviation, 'SB1')
  assert.equal(parsed.Songs[0].Capo, '-1')
})

test('parses official fixture with escaped quotes and backslashes', () => {
  const raw = read('videopsalm-as-safe-a-stronghold2.json').toString('utf8')
  const songs = parseVideoPsalmJson(raw)
  assert.equal(songs.length, 1)
  const text = songs[0].sections.flatMap((sec) => [...(sec.linesEn || []), ...(sec.linesEs || [])]).join('\n')
  assert.match(text, /With "force" of arms/)
  assert.match(text, /But for us fights \\ the proper Man/)
})

test('parses Spanish accents, first-line verse tags, and ChordPro key', () => {
  const raw = read('videopsalm-cupc-test.json').toString('utf8')
  const songs = parseVideoPsalm(raw)
  assert.equal(songs.length, 2)
  const es = songs.find((s) => s.title === 'Dios es fiel')
  assert.ok(es)
  assert.equal(es.artist, 'Equipo CUPC')
  assert.equal(es.originalKey, 'G')
  assert.equal(es.ccli, '0000000')
  assert.match(es.copyright, /Iglesia CUPC Mississauga/)
  const types = es.sections.map((s) => s.type)
  assert.ok(types.includes('verse'))
  assert.ok(types.includes('chorus'))
  assert.ok(types.includes('bridge'))
  const esText = es.sections.flatMap((sec) => sec.linesEs || []).join('\n')
  assert.match(esText, /Dios es fiel en cada/)
  assert.match(esText, /amanecer/)
  assert.match(esText, /fidelidad/)
  const en = songs.find((s) => s.title.startsWith('Morning Light'))
  assert.ok(en)
  assert.equal(en.originalKey, 'D')
  assert.ok(en.sections.some((s) => s.type === 'chorus'))
  const enText = en.sections.flatMap((sec) => sec.linesEn || []).join('\n')
  assert.match(enText, /We lift our/)
})

test('parses official VideoPsalm plain-text format (V1. / C. / ©)', () => {
  const raw = read('videopsalm-plain.txt').toString('utf8')
  assert.equal(looksLikeVideoPsalmPlain(raw), true)
  const songs = parseVideoPsalmPlain(raw)
  assert.equal(songs.length, 2)
  assert.equal(songs[0].title, 'A Mighty Fortress')
  assert.match(songs[0].artist, /Martin Luther/)
  assert.match(songs[0].notes, /Public Domain/)
  assert.ok(songs[0].sections.some((s) => s.type === 'chorus'))
  assert.equal(songs[1].title, 'Canto con alegría')
  const es = songs[1].sections.flatMap((s) => s.linesEs || []).join('\n')
  assert.match(es, /alegría/)
  assert.match(es, /fidelidad/)
})

test('splitVerseLabel understands documented VideoPsalm tags', () => {
  assert.equal(splitVerseLabel('V1.\nHello').header, 'Verse 1')
  assert.equal(splitVerseLabel('C.\nThe Name').header, 'Chorus')
  assert.equal(splitVerseLabel('Bridge\nIn the trial').header, 'Bridge')
  assert.equal(splitVerseLabel('Just a lyric').header, '')
})

test('ordinary lyrics are not treated as a VideoPsalm songbook', () => {
  assert.equal(looksLikeVideoPsalm('Song (G)\n\n[G]We sing'), false)
  assert.equal(looksLikeVideoPsalmPlain('Song (G)\n\n[G]We sing'), false)
})
