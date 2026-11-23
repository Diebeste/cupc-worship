#!/usr/bin/env node
/** Dry-run or apply the library cleaner. Never writes secrets. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanLibrary, songLangFlags } from '../src/music/cleanLibrarySong.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src/data/library-songs.json')
const REVIEW = join(ROOT, 'backups/review')
const apply = process.argv.includes('--apply')

const songs = JSON.parse(readFileSync(SRC, 'utf8'))
const result = cleanLibrary(songs)

mkdirSync(REVIEW, { recursive: true })

function preview(song, n = 12) {
  const lines = []
  for (const [i, sec] of (song.sections || []).entries()) {
    lines.push(`  [${i}] ${sec.type}${sec.label ? ' ' + sec.label : ''}${sec.notes ? ' — ' + sec.notes : ''}`)
    const en = (sec.linesEn || []).filter((l, idx, arr) => l || (idx > 0 && arr[idx - 1]))
    const es = (sec.linesEs || []).filter((l, idx, arr) => l || (idx > 0 && arr[idx - 1]))
    if (en.some(Boolean)) lines.push('    EN: ' + en.slice(0, n).map((l) => l || '¶').join(' / ') + (en.length > n ? ' …' : ''))
    if (es.some(Boolean)) lines.push('    ES: ' + es.slice(0, n).map((l) => l || '¶').join(' / ') + (es.length > n ? ' …' : ''))
  }
  return lines.join('\n')
}

function lineCount(song) {
  let en = 0, es = 0
  for (const s of song.sections || []) {
    en += (s.linesEn || []).filter(Boolean).length
    es += (s.linesEs || []).filter(Boolean).length
  }
  return { en, es, total: en + es }
}

const diffs = []
const beforeById = new Map(songs.map((s) => [s.id, s]))
for (const after of result.songs) {
  const before = beforeById.get(after.id)
  const b = lineCount(before)
  const a = lineCount(after)
  const bl = songLangFlags(before.sections)
  const al = songLangFlags(after.sections)
  const changed =
    before.title !== after.title ||
    (before.artist || '') !== (after.artist || '') ||
    JSON.stringify(before.sections) !== JSON.stringify(after.sections)
  diffs.push({
    id: after.id,
    titleBefore: before.title,
    titleAfter: after.title,
    artistBefore: before.artist || '',
    artistAfter: after.artist || '',
    sectionsBefore: (before.sections || []).length,
    sectionsAfter: (after.sections || []).length,
    linesBefore: b,
    linesAfter: a,
    lostLines: b.total - a.total,
    langBefore: bl.bilingual ? 'both' : bl.en ? 'en' : bl.es ? 'es' : 'none',
    langAfter: al.bilingual ? 'both' : al.en ? 'en' : al.es ? 'es' : 'none',
    changed
  })
}

writeFileSync(join(REVIEW, 'cleaned-library-songs.json'), JSON.stringify(result.songs, null, 2) + '\n')
writeFileSync(join(REVIEW, 'flagged-songs.json'), JSON.stringify(result.flagged, null, 2) + '\n')
writeFileSync(join(REVIEW, 'stats.json'), JSON.stringify({ ...result.stats, changed: diffs.filter((d) => d.changed).length, lostMany: diffs.filter((d) => d.lostLines >= 8) }, null, 2) + '\n')

const report = []
report.push(`# Library clean review`)
report.push(`Checked: ${result.stats.checked}`)
report.push(`Changed: ${diffs.filter((d) => d.changed).length}`)
report.push(`Flagged: ${result.flagged.length}`)
report.push(`Unchanged: ${diffs.filter((d) => !d.changed).length}`)
report.push(`Bilingual after: ${result.stats.bilingual}`)
report.push(`Newly bilingual (split): ${result.stats.splitBilingual}`)
report.push('')
report.push('## Flagged songs')
for (const f of result.flagged) {
  report.push(`\n### ${f.id}`)
  report.push(`Title: ${f.originalTitle} → ${f.title}`)
  report.push(`Action: ${f.action}`)
  report.push(`Reasons:`)
  for (const r of f.reasons) report.push(`- ${r}`)
}
report.push('\n## Songs that lost 8+ lyric lines (often appended leftovers)')
for (const d of diffs.filter((x) => x.lostLines >= 8).sort((a, b) => b.lostLines - a.lostLines)) {
  report.push(`- ${d.id}  lost ${d.lostLines}  (${d.linesBefore.total} → ${d.linesAfter.total})  ${d.titleAfter}`)
}
report.push('\n## Title changes')
for (const d of diffs.filter((x) => x.titleBefore !== x.titleAfter)) {
  report.push(`- ${d.id}: ${JSON.stringify(d.titleBefore)} → ${JSON.stringify(d.titleAfter)}`)
}
report.push('\n## Language changes')
for (const d of diffs.filter((x) => x.langBefore !== x.langAfter)) {
  report.push(`- ${d.id}: ${d.langBefore} → ${d.langAfter}  (${d.titleAfter})`)
}

writeFileSync(join(REVIEW, 'REVIEW.md'), report.join('\n') + '\n')

// Compact per-song before/after for manual review
const reviews = result.songs.map((after) => {
  const before = beforeById.get(after.id)
  const flag = result.flagged.find((f) => f.id === after.id)
  return {
    id: after.id,
    changed: JSON.stringify(before) !== JSON.stringify(after),
    flag,
    titleBefore: before.title,
    titleAfter: after.title,
    before: preview(before, 20),
    after: preview(after, 20),
    lines: { before: lineCount(before), after: lineCount(after) }
  }
})
writeFileSync(join(REVIEW, 'per-song-review.json'), JSON.stringify(reviews, null, 2) + '\n')

if (apply) {
  writeFileSync(SRC, JSON.stringify(result.songs, null, 2) + '\n')
  console.log('Applied cleaned library to', SRC)
}

console.log(JSON.stringify({ ...result.stats, changed: diffs.filter((d) => d.changed).length, flagged: result.flagged.length, lostMany: diffs.filter((d) => d.lostLines >= 8).length, applied: apply }, null, 2))
console.log('Wrote review to', REVIEW)
