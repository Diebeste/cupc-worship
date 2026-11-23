#!/usr/bin/env node
/**
 * Restore the CUPC song library from a timestamped backup.
 *
 *   node scripts/restore-library-backup.mjs --list
 *   node scripts/restore-library-backup.mjs --file backups/library-songs.20261123-081723.json
 *
 * To also restore the Supabase `songs` table, pass credentials at runtime
 * (never commit keys) and a songs dump:
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ… \
 *   node scripts/restore-library-backup.mjs \
 *     --file backups/library-songs.20261123-081723.json \
 *     --supabase backups/supabase-songs.20261123-081723.json
 *
 * The Supabase restore updates rows by id for the dumped team only, and
 * writes back the backed-up created_at / updated_at values.
 */
import { copyFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BACKUPS = join(ROOT, 'backups')
const DEST = join(ROOT, 'src/data/library-songs.json')

function arg(name, fallback = '') {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : fallback
}

function listBackups() {
  const files = readdirSync(BACKUPS).filter((f) => f.endsWith('.json') && !f.startsWith('.'))
  for (const f of files.sort()) {
    const p = join(BACKUPS, f)
    try {
      const data = JSON.parse(readFileSync(p, 'utf8'))
      const count = Array.isArray(data) ? data.length : data.songs?.length || data.count || '?'
      console.log(`  ${f}  (${count} songs)`)
    } catch {
      console.log(`  ${f}  (unreadable)`)
    }
  }
}

if (process.argv.includes('--list') || (!arg('--file') && !arg('--supabase'))) {
  console.log('Backups in', BACKUPS)
  listBackups()
  if (!process.argv.includes('--list') && !arg('--file')) {
    console.log('\nPass --file <backup.json> to restore src/data/library-songs.json')
  }
  process.exit(0)
}

const file = resolve(ROOT, arg('--file'))
if (arg('--file')) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  const songs = Array.isArray(data) ? data : data.songs
  if (!Array.isArray(songs) || !songs.length) {
    console.error('Backup does not look like a song array:', file)
    process.exit(1)
  }
  copyFileSync(file, file + '.restore-src')
  const payload = Array.isArray(data) ? JSON.stringify(data, null, 2) + '\n' : JSON.stringify(songs, null, 2) + '\n'
  const { writeFileSync } = await import('node:fs')
  writeFileSync(DEST, payload)
  console.log(`Restored ${songs.length} songs to ${DEST} from ${file}`)
}

const sbFile = arg('--supabase')
if (sbFile) {
  const url = process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  if (!url || !key) {
    console.error('Supabase restore needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.')
    process.exit(1)
  }
  const { createClient } = await import('@supabase/supabase-js')
  const dump = JSON.parse(readFileSync(resolve(ROOT, sbFile), 'utf8'))
  const songs = dump.songs || dump
  const teamId = dump.team_id || songs[0]?.team_id
  if (!teamId) {
    console.error('Dump is missing team_id')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  for (let i = 0; i < songs.length; i += 25) {
    const slice = songs.slice(i, i + 25).map((s) => ({
      id: s.id,
      team_id: s.team_id || teamId,
      title: s.title,
      artist: s.artist || '',
      original_key: s.original_key ?? s.originalKey ?? '',
      bpm: s.bpm || '',
      notes: s.notes || '',
      sections: s.sections || [],
      created_at: s.created_at,
      updated_at: s.updated_at
    }))
    const { error } = await sb.from('songs').upsert(slice)
    if (error) {
      console.error('Supabase restore failed at', i, error.message)
      process.exit(1)
    }
    console.log(`  songs: ${Math.min(i + slice.length, songs.length)}/${songs.length}`)
  }
  console.log('Supabase songs table restored for team', teamId)
}
