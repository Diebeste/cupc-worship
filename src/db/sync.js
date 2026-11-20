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


let joinInFlight = null
let createInFlight = null
let authWatch = null

export function isAuthCallbackUrl(url = (typeof location !== 'undefined' ? location.href : '')) {
  try {
    const u = new URL(url, 'https://example.invalid')
    const blob = `${u.hash || ''}?${u.search || ''}`
    return /access_token=|refresh_token=|type=magiclink|type=signup|error_description=/.test(blob) || u.searchParams.has('code')
  } catch {
    return false
  }
}

export function formatSyncError(err) {
  const msg = String(err?.message || err?.error_description || err || '')
  const lower = msg.toLowerCase()
  if (err?.code === 'not_signed_in' || /not_signed_in|auth session missing|not signed in|jwt expired|invalid jwt|invalid token/.test(lower)) {
    return 'needSignIn'
  }
  if (/anonymous sign-ins? (are )?disabled|signups? not allowed|unable to sign in anonymously|anonymous provider/i.test(lower)) return 'anonSignInOff'
  if (/permission denied|42501|not authorized|unauthorized|401|403/.test(lower)) return 'needSignIn'
  if (/unknown join code/.test(lower)) return 'unknownJoinCode'
  if (/unknown editor code/.test(lower)) return 'unknownEditorCode'
  if (/only a team admin|cannot remove|cannot be removed|join a team first/.test(lower)) return 'adminOnly'
  if (/failed to fetch|network|load failed|offline|timeout/.test(lower)) return 'syncNetwork'
  return 'joinFailed'
}

export async function ensureSession(settings, { timeoutMs } = {}) {
  const sb = await getClient(settings)
  if (!sb) return null
  const existing = (await sb.auth.getSession()).data.session || null
  if (existing) return existing
  const wait = timeoutMs ?? (isAuthCallbackUrl() ? 8000 : 1500)
  return await new Promise((resolve) => {
    let done = false
    const finish = (session) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { sub?.unsubscribe?.() } catch { /* ignore */ }
      resolve(session || null)
    }
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) finish(session)
    })
    const sub = data?.subscription
    const timer = setTimeout(async () => {
      const late = (await sb.auth.getSession()).data.session || null
      finish(late)
    }, wait)
  })
}

export function watchAuth(settings, handler) {
  const start = async () => {
    const sb = await getClient(settings)
    if (!sb) return () => {}
    if (authWatch) {
      try { authWatch.unsubscribe() } catch { /* ignore */ }
      authWatch = null
    }
    const { data } = sb.auth.onAuthStateChange((event, session) => { handler(event, session) })
    authWatch = data?.subscription || null
    return () => { try { authWatch?.unsubscribe() } catch { /* ignore */ } }
  }
  return start()
}

export async function sendMagicLink(settings, email, redirectTo) {
  const sb = await getClient(settings)
  if (!sb) throw new Error('Supabase is not configured')
  const addr = String(email || '').trim()
  if (!addr) throw new Error('needSignIn')
  const session = (await sb.auth.getSession()).data.session
  // Already signed in (including anonymously): attach email so this login can be used on another device.
  if (session) {
    const { error } = await sb.auth.updateUser({ email: addr }, { emailRedirectTo: redirectTo })
    if (error) throw error
    return { linked: true }
  }
  const { error } = await sb.auth.signInWithOtp({
    email: addr,
    options: { emailRedirectTo: redirectTo }
  })
  if (error) throw error
  return { linked: false }
}

export async function signOut(settings) {
  const sb = await getClient(settings)
  if (sb) await sb.auth.signOut()
}

async function readOwnProfile(sb, session) {
  if (!sb || !session?.user?.id) return null
  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
  if (error) return null
  return data || null
}

function alreadyMemberPayload(profile, session) {
  return {
    alreadyMember: true,
    team_id: profile.team_id,
    role: profile.role || 'member',
    can_edit: !!(profile.can_edit || profile.role === 'admin'),
    team_name: 'CUPC Mississauga Worship',
    session
  }
}

export async function joinTeam(settings, joinCode, displayName, editorCode) {
  if (joinInFlight) return joinInFlight
  joinInFlight = (async () => {
    const sb = await getClient(settings)
    if (!sb) throw new Error('Supabase is not configured')
    let session = (await sb.auth.getSession()).data.session || null
    if (!session && isAuthCallbackUrl()) {
      session = await ensureSession(settings, { timeoutMs: 8000 })
    }
    if (!session) {
      const { data, error } = await sb.auth.signInAnonymously({
        options: { data: { display_name: displayName || '' } }
      })
      if (error) throw error
      session = data.session || (await sb.auth.getSession()).data.session || null
    }
    if (!session) {
      const err = new Error('not_signed_in')
      err.code = 'not_signed_in'
      throw err
    }
    const profile = await readOwnProfile(sb, session)
    const editor = String(editorCode || '').trim()
    if (profile?.team_id && !editor) return alreadyMemberPayload(profile, session)
    if (profile?.team_id && editor) {
      const { data, error } = await sb.rpc('claim_editor_code', { p_editor_code: editor })
      if (error) throw error
      return { ...data, session }
    }
    const { data, error } = await sb.rpc('join_team_with_code', {
      p_code: String(joinCode || '').trim(),
      p_display_name: displayName || null,
      p_editor_code: editor || null
    })
    if (error) throw error
    return { ...data, session }
  })()
  try {
    return await joinInFlight
  } finally {
    joinInFlight = null
  }
}

export async function createTeam(settings, name, joinCode) {
  if (createInFlight) return createInFlight
  createInFlight = (async () => {
    const sb = await getClient(settings)
    if (!sb) throw new Error('Supabase is not configured')
    const session = await ensureSession(settings)
    if (!session) {
      const err = new Error('not_signed_in')
      err.code = 'not_signed_in'
      throw err
    }
    const profile = await readOwnProfile(sb, session)
    if (profile?.team_id) return alreadyMemberPayload(profile, session)
    const { data, error } = await sb.rpc('create_team', {
      p_name: name || 'CUPC Mississauga Worship',
      p_code: joinCode
    })
    if (error) throw error
    return data
  })()
  try {
    return await createInFlight
  } finally {
    createInFlight = null
  }
}


async function rpcOrThrow(settings, name, args = {}) {
  const sb = await getClient(settings)
  if (!sb) throw new Error('Supabase is not configured')
  const session = await ensureSession(settings, { timeoutMs: 400 })
  if (!session) {
    const err = new Error('not_signed_in')
    err.code = 'not_signed_in'
    throw err
  }
  const { data, error } = await sb.rpc(name, args)
  if (error) throw error
  return data
}

export async function loadAdminState(settings) {
  return rpcOrThrow(settings, 'team_admin_state')
}

export async function listTeamMembers(settings) {
  const data = await rpcOrThrow(settings, 'list_team_members')
  return Array.isArray(data) ? data : (data || [])
}

export async function rotateEditorCode(settings) {
  return rpcOrThrow(settings, 'rotate_editor_code')
}

export async function rotateJoinCode(settings) {
  return rpcOrThrow(settings, 'rotate_join_code')
}

export async function removeTeamMember(settings, userId) {
  return rpcOrThrow(settings, 'remove_team_member', { p_user_id: userId })
}

export async function pullAll(settings) {
  const sb = await getClient(settings)
  if (!sb) return null
  const session = await getSession(settings)
  if (!session) return { needsAuth: true }

  const [songs, services, profile, members, scheduleMeta] = await Promise.all([
    sb.from('songs').select('*').order('updated_at', { ascending: false }),
    sb.from('services').select('*').order('updated_at', { ascending: false }),
    sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
    sb.from('members').select('*').order('name'),
    sb.from('schedule_meta').select('*')
  ])
  if (songs.error) throw songs.error
  if (services.error) throw services.error
  const membersList = members.error ? [] : (members.data || []).map((r) => ({ id: r.id, name: r.name, teamId: r.team_id }))
  const meta = {}
  if (!scheduleMeta.error) {
    for (const r of scheduleMeta.data || []) {
      meta[r.month] = { practiceNotes: r.practice_notes || '', banner: r.banner || '' }
    }
  }
  return {
    songs: (songs.data || []).map(fromRemoteSong),
    services: (services.data || []).map(fromRemoteService),
    members: membersList,
    scheduleMeta: meta,
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
    voices: service.voices || [],
    instruments: service.instruments || [],
    ujier: service.ujier || '',
    subtitle: service.subtitle || '',
    schedule_pin: service.schedulePin || '',
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
    voices: row.voices || [],
    instruments: row.instruments || [],
    ujier: row.ujier || '',
    subtitle: row.subtitle || '',
    schedulePin: row.schedule_pin || '',
    notes: row.notes || '',
    items: row.items || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export async function pushMember(settings, member) {
  const sb = await getClient(settings)
  if (!sb) return
  const { error } = await sb.from('members').upsert({
    id: member.id,
    team_id: settings.teamId || member.teamId || null,
    name: member.name
  })
  if (error) throw error
}

export async function pushScheduleMeta(settings, month, meta) {
  const sb = await getClient(settings)
  if (!sb) return
  const id = `${settings.teamId || 'team'}-${month}`
  const { error } = await sb.from('schedule_meta').upsert({
    id,
    team_id: settings.teamId || null,
    month,
    practice_notes: meta.practiceNotes || '',
    banner: meta.banner || '',
    updated_at: new Date().toISOString()
  })
  if (error) throw error
}
