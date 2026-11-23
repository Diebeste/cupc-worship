/** Merge the imported library into the built-in seed and into existing IndexedDB installs. */

import { foldTitle } from '../music/foldTitle.js'
import librarySongs from './library-songs.json' with { type: 'json' }

/** Bump when the packaged library changes so existing installs merge new songs. */
export const SONG_LIBRARY_VERSION = 2

export { librarySongs }

function aliasesOf(song) {
  return [song.title, ...(song.aliases || [])].map(foldTitle).filter(Boolean)
}

export function isPristineSeed(song) {
  if (!song) return false
  if (song.userEdited) return false
  if (song.seeded && song.updatedAt && song.createdAt && song.updatedAt !== song.createdAt) return false
  return !!song.seeded
}

/**
 * Overlay the 12 curated songs (stable IDs used by services) onto the imported library.
 */
export function buildSeedSongs(curated, library = librarySongs) {
  const byId = new Map((library || []).map((s) => [s.id, { ...s }]))
  const byFold = new Map()
  for (const s of byId.values()) {
    for (const k of aliasesOf(s)) if (!byFold.has(k)) byFold.set(k, s)
  }
  for (const c of curated || []) {
    const existing = byId.get(c.id) || byFold.get(foldTitle(c.title))
    const merged = existing
      ? {
          ...existing,
          ...c,
          originalKey: c.originalKey || existing.originalKey || '',
          artist: c.artist || existing.artist || '',
          bpm: c.bpm || existing.bpm || '',
          notes: c.notes || existing.notes || '',
          sections: (c.sections && c.sections.length ? c.sections : existing.sections) || [],
          aliases: [...new Set([...(existing.aliases || []), ...(c.aliases || []), existing.title, c.title])],
          id: c.id,
          seeded: true
        }
      : { ...c, seeded: true }
    byId.set(c.id, merged)
    if (existing && existing.id !== c.id) byId.delete(existing.id)
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'es'))
}

/**
 * Add new seed songs and update pristine seeded songs. Never overwrite user edits
 * or user-created songs with the same normalized title, and never duplicate them.
 */
export function mergeSeedSongs(existing, seedSongs) {
  const out = [...(existing || [])]
  const byId = new Map(out.map((s) => [s.id, s]))
  const byFold = new Map()
  for (const s of out) {
    for (const k of aliasesOf(s)) if (!byFold.has(k)) byFold.set(k, s)
  }
  for (const seed of seedSongs || []) {
    const local = byId.get(seed.id) || aliasesOf(seed).map((k) => byFold.get(k)).find(Boolean)
    if (!local) {
      out.push(seed)
      byId.set(seed.id, seed)
      for (const k of aliasesOf(seed)) if (!byFold.has(k)) byFold.set(k, seed)
      continue
    }
    if (isPristineSeed(local)) {
      const merged = {
        ...seed,
        id: local.id,
        createdAt: local.createdAt || seed.createdAt,
        updatedAt: local.createdAt || seed.createdAt,
        seeded: true,
        userEdited: false
      }
      const i = out.findIndex((s) => s.id === local.id)
      out[i] = merged
      byId.set(local.id, merged)
    }
    // else leave the user's copy alone
  }
  return out
}

export function stampSongs(songs, ts = '2026-11-15T00:00:00.000Z') {
  return songs.map((s) => ({
    ...s,
    createdAt: s.createdAt || ts,
    updatedAt: s.updatedAt || ts,
    seeded: true
  }))
}
