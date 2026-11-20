/** Optional Supabase sync. The app runs fully offline until URL + anon key are saved. */

let client = null
let currentConfig = { url: '', key: '' }

export function isConfigured(settings) {
  return !!(settings?.supabaseUrl && settings?.supabaseAnonKey)
}

export async function getClient(settings) {
  if (!isConfigured(settings)) {
    client = null
    currentConfig = { url: '', key: '' }
    return null
  }
  if (client && currentConfig.url === settings.supabaseUrl && currentConfig.key === settings.supabaseAnonKey) {
    return client
  }
  const { createClient } = await import('@supabase/supabase-js')
  client = createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  })
  currentConfig = { url: settings.supabaseUrl, key: settings.supabaseAnonKey }
  return client
}

export async function getSession(settings) {
  const sb = await getClient(settings)
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session || null
}

export async function sendMagicLink(settings, email, redirectTo) {
  const sb = await getClient(settings)
  if (!sb) throw new Error('Supabase is not configured')
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  })
  if (error) throw error
}

export async function signOut(settings) {
  const sb = await getClient(settings)
  if (sb) await sb.auth.signOut()
}

export async function joinTeam(settings, joinCode, displayName) {
  const sb = await getClient(settings)
  if (!sb) throw new Error('Supabase is not configured')
  const code = String(joinCode || '').trim()
  const { data, error } = await sb.rpc('join_team_with_code', {
    p_code: code,
    p_display_name: displayName || null
  })
  if (error) throw error
  return data
}


export async function createTeam(settings, name, joinCode) {
  const sb = await getClient(settings)
  if (!sb) throw new Error('Supabase is not configured')
  const { data, error } = await sb.rpc('create_team', {
    p_name: name || 'CUPC Mississauga Worship',
    p_code: joinCode
  })
  if (error) throw error
  return data
}

export async function pullAll(settings) {
  const sb = await getClient(settings)
  if (!sb) return null
  const session = await getSession(settings)
  if (!session) return { needsAuth: true }

  const [songs, services, profile] = await Promise.all([
    sb.from('songs').select('*').order('updated_at', { ascending: false }),
    sb.from('services').select('*').order('updated_at', { ascending: false }),
    sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
  ])
  if (songs.error) throw songs.error
  if (services.error) throw services.error
  return {
    songs: (songs.data || []).map(fromRemoteSong),
    services: (services.data || []).map(fromRemoteService),
    profile: profile.data || null,
    session
  }
}

export async function pushSong(settings, song) {
  const sb = await getClient(settings)
  if (!sb) return
  const { error } = await sb.from('songs').upsert(toRemoteSong(song, settings))
  if (error) throw error
}

export async function pushService(settings, service) {
  const sb = await getClient(settings)
  if (!sb) return
  const { error } = await sb.from('services').upsert(toRemoteService(service, settings))
  if (error) throw error
}

export async function removeSongRemote(settings, id) {
  const sb = await getClient(settings)
  if (!sb) return
  const { error } = await sb.from('songs').delete().eq('id', id)
  if (error) throw error
}

export async function removeServiceRemote(settings, id) {
  const sb = await getClient(settings)
  if (!sb) return
  const { error } = await sb.from('services').delete().eq('id', id)
  if (error) throw error
}

function toRemoteSong(song, settings) {
  return {
    id: song.id,
    team_id: settings.teamId || song.teamId || null,
    title: song.title,
    artist: song.artist || '',
    original_key: song.originalKey || '',
    bpm: song.bpm || '',
    notes: song.notes || '',
    sections: song.sections || [],
    updated_at: song.updatedAt || new Date().toISOString()
  }
}

function fromRemoteSong(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    title: row.title,
    artist: row.artist || '',
    originalKey: row.original_key || '',
    bpm: row.bpm || '',
    notes: row.notes || '',
    sections: row.sections || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toRemoteService(service, settings) {
  return {
    id: service.id,
    team_id: settings.teamId || service.teamId || null,
    name: service.name,
    date: service.date || null,
    type: service.type || 'sunday',
    leader: service.leader || '',
    notes: service.notes || '',
    items: service.items || [],
    updated_at: service.updatedAt || new Date().toISOString()
  }
}

function fromRemoteService(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    date: row.date,
    type: row.type,
    leader: row.leader || '',
    notes: row.notes || '',
    items: row.items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
