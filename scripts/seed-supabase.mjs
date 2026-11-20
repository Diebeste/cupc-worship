#!/usr/bin/env node
/**
 * Upsert the built-in library (songs, services, members, November schedule)
 * into a Supabase project. Pass credentials at runtime — never commit keys.
 *
 *   SUPABASE_URL=https://xxxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ… \
 *   TEAM_JOIN_CODE=CUPC-ALABANZA \
 *   node scripts/seed-supabase.mjs
 *
 * Prefer the service_role key for this script (it bypasses RLS). The app itself
 * must only ever ship the anon/publishable key.
 */
import { createClient } from '@supabase/supabase-js'
import { stampedSeed } from '../src/data/seed.js'
import { BUILTIN_SUPABASE } from '../src/data/supabase-config.js'

const url = process.env.SUPABASE_URL || BUILTIN_SUPABASE.url
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
const joinCode = (process.env.TEAM_JOIN_CODE || BUILTIN_SUPABASE.joinCode || 'CUPC-ALABANZA').toUpperCase()
const teamName = process.env.TEAM_NAME || BUILTIN_SUPABASE.teamName || 'CUPC Mississauga Worship'

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).')
  console.error('Do not put keys in the repo. Pass them as environment variables.')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const seed = stampedSeed()

function toSong(song, teamId) {
  return {
    id: song.id,
    team_id: teamId,
    title: song.title,
    artist: song.artist || '',
    original_key: song.originalKey || '',
    bpm: song.bpm || '',
    notes: song.notes || '',
    sections: song.sections || [],
    created_at: song.createdAt || new Date().toISOString(),
    updated_at: song.updatedAt || new Date().toISOString()
  }
}

function toService(svc, teamId) {
  return {
    id: svc.id,
    team_id: teamId,
    name: svc.name || '',
    date: svc.date || null,
    type: svc.type || 'service',
    leader: svc.leader || '',
    notes: svc.notes || '',
    items: svc.items || [],
    voices: svc.voices || [],
    instruments: svc.instruments || [],
    ujier: svc.ujier || '',
    subtitle: svc.subtitle || '',
    schedule_pin: svc.schedulePin || svc.schedule_pin || '',
    created_at: svc.createdAt || new Date().toISOString(),
    updated_at: svc.updatedAt || new Date().toISOString()
  }
}

async function upsertChunk(table, rows, chunk = 40) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const { error } = await sb.from(table).upsert(slice)
    if (error) throw new Error(`${table} upsert failed at ${i}: ${error.message}`)
    console.log(`  ${table}: ${Math.min(i + slice.length, rows.length)}/${rows.length}`)
  }
}

const teamIdEnv = process.env.TEAM_ID || ''
let teamId = teamIdEnv
if (!teamId) {
  const found = await sb.from('teams').select('id, name, join_code').eq('join_code', joinCode).maybeSingle()
  if (found.error) throw found.error
  if (found.data) teamId = found.data.id
  else {
    const created = await sb.from('teams').insert({ name: teamName, join_code: joinCode }).select('id').single()
    if (created.error) throw created.error
    teamId = created.data.id
  }
}
console.log('Team', teamId, 'code', joinCode)

await upsertChunk('songs', seed.songs.map((s) => toSong(s, teamId)))
await upsertChunk('services', seed.services.map((s) => toService(s, teamId)))
await upsertChunk('members', (seed.members || []).map((m) => ({
  id: m.id,
  team_id: teamId,
  name: m.name,
  created_at: m.createdAt || new Date().toISOString()
})))

const metaRows = Object.entries(seed.scheduleMeta || {}).map(([month, meta]) => ({
  id: `sched-${month}`,
  team_id: teamId,
  month,
  practice_notes: meta.practiceNotes || meta.practice_notes || '',
  banner: meta.banner || '',
  updated_at: new Date().toISOString()
}))
if (metaRows.length) await upsertChunk('schedule_meta', metaRows)

console.log(JSON.stringify({
  teamId,
  joinCode,
  songs: seed.songs.length,
  services: seed.services.length,
  members: (seed.members || []).length,
  scheduleMeta: metaRows.length
}))
