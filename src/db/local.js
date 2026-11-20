import { BUILTIN_SUPABASE } from '../data/supabase-config.js'
/** IndexedDB cache — source of truth in local/demo mode, cache when synced. */

const DB_NAME = 'cupc-worship'
const DB_VERSION = 1

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('services')) {
        db.createObjectStore('services', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(store, mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const st = tx.objectStore(store)
    const result = fn(st)
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getAll(store) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function putOne(store, value) {
  return withStore(store, 'readwrite', (st) => st.put(value))
}

export async function putMany(store, values) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    const st = tx.objectStore(store)
    for (const v of values) st.put(v)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function deleteOne(store, id) {
  return withStore(store, 'readwrite', (st) => st.delete(id))
}

export async function getMeta(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly')
    const req = tx.objectStore('meta').get(key)
    req.onsuccess = () => resolve(req.result ? req.result.value : undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function setMeta(key, value) {
  return withStore('meta', 'readwrite', (st) => st.put({ key, value }))
}

export async function clearAll() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['songs', 'services', 'meta'], 'readwrite')
    tx.objectStore('songs').clear()
    tx.objectStore('services').clear()
    tx.objectStore('meta').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export function nowIso() {
  return new Date().toISOString()
}

export function uid(prefix = 'id') {
  return `${prefix}-${crypto.randomUUID()}`
}

export function defaultSettings() {
  return {
    uiLang: 'en',
    lyricLang: 'both',
    theme: 'system',
    layout: 'stack',
    showChords: true,
    displayName: '',
    supabaseUrl: BUILTIN_SUPABASE.url || '',
    supabaseAnonKey: BUILTIN_SUPABASE.anonKey || '',
    joinCode: BUILTIN_SUPABASE.joinCode || '',
    role: 'admin',
    userEmail: '',
    userId: '',
    teamId: '',
    lastSync: null
  }
}

export async function exportBackup({ songs, services, settings, members, scheduleMeta }) {
  return {
    version: 2,
    exportedAt: nowIso(),
    app: 'cupc-worship',
    settings: { ...settings, supabaseAnonKey: settings.supabaseAnonKey ? '[redacted — re-enter in Settings]' : '' },
    songs,
    services,
    members: members || [],
    scheduleMeta: scheduleMeta || {}
  }
}
