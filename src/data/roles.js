/** Service roles, team members, schedule helpers. Old services without these fields still load. */

export const DATA_VERSION = 2

export const DEFAULT_INSTRUMENTS = ['Piano', 'Bass', 'Drums']

export const SUBTITLE_SUGGESTIONS = [
  'Missionary Sunday',
  'Culto Jóvenes',
  'Congreso de Jóvenes',
  'Culto General',
  'Semana de Alabanza',
  'Culto de Amigos'
]

export const SERVICE_TYPES = ['sunday', 'thursday', 'event', 'service']

const WEEKDAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']
const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export function parseDateParts(iso) {
  if (!iso) return null
  const [y, m, d] = String(iso).split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d, date: new Date(y, m - 1, d) }
}

export function scheduleHeader(iso) {
  const p = parseDateParts(iso)
  if (!p) return ''
  const day = WEEKDAYS_ES[p.date.getDay()]
  const mon = MONTHS_ES[p.m - 1]
  const dd = String(p.d).padStart(2, '0')
  return `${day} ${mon} ${dd}`
}

export function monthLabel(ym, lang = 'en') {
  const [y, m] = String(ym).split('-').map(Number)
  const date = new Date(y, (m || 1) - 1, 1)
  return date.toLocaleDateString(lang === 'es' ? 'es-CA' : 'en-CA', { month: 'long', year: 'numeric' }).toUpperCase()
}

export function shiftMonth(ym, delta) {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(y, (m || 1) - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function defaultInstruments(players = {}) {
  return DEFAULT_INSTRUMENTS.map((name) => ({ name, player: players[name] || '' }))
}

export function normalizeService(svc) {
  if (!svc) return svc
  const out = { ...svc }
  if (out.type === 'adhoc') out.type = 'service'
  out.leader = out.leader || ''
  out.voices = Array.isArray(out.voices) ? out.voices : []
  out.ujier = out.ujier || ''
  out.subtitle = out.subtitle || ''
  out.schedulePin = out.schedulePin || ''
  if (!Array.isArray(out.instruments)) out.instruments = defaultInstruments()
  else {
    const have = new Set(out.instruments.map((i) => (i.name || '').toLowerCase()))
    const merged = [...out.instruments]
    for (const name of DEFAULT_INSTRUMENTS) {
      if (!have.has(name.toLowerCase())) merged.push({ name, player: '' })
    }
    // keep default order first, then custom
    const defaults = DEFAULT_INSTRUMENTS.map((name) =>
      merged.find((i) => (i.name || '').toLowerCase() === name.toLowerCase()) || { name, player: '' }
    )
    const custom = merged.filter((i) => !DEFAULT_INSTRUMENTS.some((d) => d.toLowerCase() === (i.name || '').toLowerCase()))
    out.instruments = [...defaults, ...custom].map((i) => ({ name: i.name || '', player: i.player || '' }))
  }
  return out
}

export function cardTheme(svc) {
  const sub = fold(svc?.subtitle || '')
  if (sub.includes('missionary')) return { bg: '#f7b6c2', accent: '#c23a6a', ink: '#2a1220' }
  if (sub.includes('congreso')) return { bg: '#e8c8f4', accent: '#7a3fa0', ink: '#2a1230' }
  if (sub.includes('culto jovenes') || sub.includes('culto joven')) return { bg: '#f3b4ea', accent: '#c44bb3', ink: '#2a1230' }
  if (sub.includes('semana')) return { bg: '#f8e8a0', accent: '#c4a020', ink: '#2a2410' }
  if (sub.includes('amigos')) return { bg: '#f6edc2', accent: '#c4a04a', ink: '#2a2410' }
  if (sub.includes('culto general')) return { bg: '#d8d8de', accent: '#5c5c66', ink: '#1c1c22' }
  if (svc?.type === 'sunday') return { bg: '#f7b6c2', accent: '#c23a6a', ink: '#2a1220' }
  if (svc?.type === 'thursday') return { bg: '#e8c8f4', accent: '#7a3fa0', ink: '#2a1230' }
  if (svc?.type === 'event') return { bg: '#f8e8a0', accent: '#c4a020', ink: '#2a2410' }
  return { bg: '#d6e0f5', accent: '#4b6ab7', ink: '#182848' }
}

function fold(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

export function displayRole(value) {
  if (value == null) return ''
  const v = String(value).trim()
  return v
}

export function formatVoices(voices) {
  return (voices || []).map((v) => String(v).trim()).filter((v) => v !== '')
}

export function formatInstrumentsLine(instruments) {
  return (instruments || [])
    .map((i) => {
      const name = (i.name || '').trim()
      if (!name) return ''
      const player = (i.player || '').trim()
      return player ? `${name}: ${player}` : `${name}:`
    })
    .filter(Boolean)
}

export function rolesTextLines(svc) {
  const lines = []
  const leader = displayRole(svc.leader)
  lines.push(`Leader: ${leader || ''}`)
  const voices = formatVoices(svc.voices)
  if (voices.length) {
    lines.push('Voices:')
    for (const v of voices) lines.push(`  • ${v}`)
  } else {
    lines.push('Voices:')
  }
  lines.push('Instruments:')
  const inst = formatInstrumentsLine(svc.instruments)
  if (inst.length) for (const l of inst) lines.push(`  • ${l}`)
  lines.push(`Ujier: ${displayRole(svc.ujier) || ''}`)
  return lines
}

export function collectNamesFromServices(services) {
  const names = new Set()
  for (const s of services || []) {
    if (s.leader) names.add(s.leader)
    if (s.ujier) names.add(s.ujier)
    for (const v of s.voices || []) if (v && v !== '?') names.add(v)
    for (const i of s.instruments || []) if (i.player) names.add(i.player)
  }
  return [...names]
}

export function rememberName(members, name) {
  const n = String(name || '').trim()
  if (!n || n === '?') return members
  const exists = members.some((m) => m.name.toLowerCase() === n.toLowerCase())
  if (exists) return members
  return [...members, { id: `member-${n.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`, name: n }]
}

export function rememberMany(members, names) {
  let next = members
  for (const n of names || []) next = rememberName(next, n)
  return next
}

export function membersFromService(svc) {
  return [svc.leader, svc.ujier, ...(svc.voices || []), ...(svc.instruments || []).map((i) => i.player)]
}

export function servicesForMonth(services, ym) {
  return (services || []).filter((s) => {
    if (s.schedulePin === ym) return true
    if (s.date && String(s.date).startsWith(ym)) return true
    return false
  }).sort((a, b) => {
    // Pinned-only (other month date) last, otherwise by date then name
    const aPin = a.schedulePin === ym && !(a.date && String(a.date).startsWith(ym))
    const bPin = b.schedulePin === ym && !(b.date && String(b.date).startsWith(ym))
    if (aPin !== bPin) return aPin ? 1 : -1
    return String(a.date || '').localeCompare(String(b.date || '')) || String(a.name || '').localeCompare(String(b.name || ''))
  })
}

export const SEED_MEMBERS = [
  'Brandon', 'Anamaria', 'Alejandra', 'Wilfredo', 'Juan', 'Kathy', 'Daniel', 'Esteban', 'Sebastian'
].map((name) => ({ id: `member-${name.toLowerCase()}`, name }))

export const SEED_SCHEDULE_META = {
  '2026-11': {
    practiceNotes: 'Practice: Nov 14, Sundays at 8AM',
    banner: 'Worship Week Nov 19-22'
  }
}

function inst(piano, bass, drums, extra = []) {
  return [
    { name: 'Piano', player: piano },
    { name: 'Bass', player: bass },
    { name: 'Drums', player: drums },
    ...extra
  ]
}

/** November 2026 schedule cards, names copied exactly from the team’s sheet. */
export const NOVEMBER_2026_ROLES = {
  'service-2026-11-01': {
    id: 'service-2026-11-01',
    name: 'DOMINGO NOV 01',
    date: '2026-11-01',
    type: 'sunday',
    subtitle: 'MISSIONARY SUNDAY',
    leader: 'BRANDON',
    voices: ['Anamaria', 'Alejandra'],
    instruments: inst('Wilfredo', '', 'Juan'),
    ujier: 'Juan',
    notes: '',
    items: []
  },
  'service-2026-11-05': {
    id: 'service-2026-11-05',
    name: 'JUEVES NOV 05',
    date: '2026-11-05',
    type: 'thursday',
    subtitle: 'CULTO JOVENES',
    leader: 'JUAN',
    voices: ['Kathy'],
    instruments: inst('Daniel', '', 'Brandon'),
    ujier: 'Alejandra',
    notes: '',
    items: []
  },
  'service-2026-11-08': {
    id: 'service-2026-11-08',
    name: 'DOMINGO NOV 08',
    date: '2026-11-08',
    type: 'sunday',
    subtitle: 'CONGRESO DE JOVENES',
    leader: 'WILFREDO',
    voices: ['?'],
    instruments: inst('', '', ''),
    ujier: '',
    notes: '',
    items: []
  },
  'service-2026-11-12': {
    id: 'service-2026-11-12',
    name: 'JUEVES NOV 12',
    date: '2026-11-12',
    type: 'thursday',
    subtitle: 'CULTO GENERAL',
    leader: 'KATHY',
    voices: ['Alejandra'],
    instruments: inst('Daniel', '', 'Juan'),
    ujier: '',
    notes: '',
    items: []
  },
  'service-15-11': {
    // merge into existing typical-service seed
    date: '2026-11-15',
    type: 'sunday',
    subtitle: 'CULTO GENERAL',
    leader: 'BRANDON',
    voices: ['Kathy', 'Anamaria'],
    instruments: inst('Daniel', '', 'Juan'),
    ujier: '',
    schedulePin: ''
  },
  'service-semana-jueves': {
    date: '2026-11-19',
    type: 'event',
    subtitle: 'SEMANA DE ALABANZA',
    leader: 'WILFREDO',
    voices: ['Kathy', 'Alejandra', 'Brandon', 'Anamaria'],
    instruments: inst('Daniel', '', 'Juan'),
    ujier: '',
    schedulePin: ''
  },
  'service-2026-11-22': {
    id: 'service-2026-11-22',
    name: 'DOMINGO NOV 22',
    date: '2026-11-22',
    type: 'sunday',
    subtitle: 'SEMANA DE ALABANZA',
    leader: 'DANIEL',
    voices: ['kathy', 'Alejandra', 'Brandon', 'Anamaria'],
    instruments: inst('Esteban', 'Wilfredo', 'Juan', [{ name: 'Electric Guitar', player: 'Sebastian' }]),
    ujier: 'Wilfredo',
    notes: '',
    items: []
  },
  'service-2026-11-26': {
    id: 'service-2026-11-26',
    name: 'JUEVES NOV 26',
    date: '2026-11-26',
    type: 'thursday',
    subtitle: 'CULTO GENERAL',
    leader: 'ALEJANDRA',
    voices: ['Juan', 'Kathy'],
    instruments: inst('Wilfredo', '', ''),
    ujier: 'Brandon',
    notes: '',
    items: []
  },
  'service-2026-03-29': {
    id: 'service-2026-03-29',
    name: 'DOMINGO MAR 29',
    date: '2026-03-29',
    type: 'sunday',
    subtitle: 'CULTO DE AMIGOS',
    leader: 'ANAMARIA',
    voices: ['Kathy', 'Alejandra'],
    instruments: inst('Wilfredo', '', 'Juan'),
    ujier: 'Daniel',
    notes: 'Shown on the November 2026 schedule sheet as “DOMINGO MAR 29”. Date kept as 29 March 2026 (likely a typo on the sheet for Nov 29).',
    schedulePin: '2026-11',
    items: []
  }
}

export function novemberServices() {
  return [
    NOVEMBER_2026_ROLES['service-2026-11-01'],
    NOVEMBER_2026_ROLES['service-2026-11-05'],
    NOVEMBER_2026_ROLES['service-2026-11-08'],
    NOVEMBER_2026_ROLES['service-2026-11-12'],
    NOVEMBER_2026_ROLES['service-2026-11-22'],
    NOVEMBER_2026_ROLES['service-2026-11-26'],
    NOVEMBER_2026_ROLES['service-2026-03-29']
  ].map(normalizeService)
}

export function applyNovemberMerge(service) {
  const patch = NOVEMBER_2026_ROLES[service.id]
  if (!patch) return normalizeService(service)
  const next = normalizeService({ ...service, ...patch, items: service.items || patch.items || [], name: service.name || patch.name, notes: service.notes || patch.notes || '' })
  return next
}

export function migrateLocalData({ services, members, scheduleMeta }) {
  let nextServices = (services || []).map((s) => applyNovemberMerge(normalizeService(s)))
  const have = new Set(nextServices.map((s) => s.id))
  for (const extra of novemberServices()) {
    if (!have.has(extra.id)) nextServices.push(normalizeService(extra))
  }
  let nextMembers = members && members.length ? members : [...SEED_MEMBERS]
  nextMembers = rememberMany(nextMembers, collectNamesFromServices(nextServices))
  const nextMeta = { ...SEED_SCHEDULE_META, ...(scheduleMeta || {}) }
  if (!nextMeta['2026-11']) nextMeta['2026-11'] = { ...SEED_SCHEDULE_META['2026-11'] }
  else {
    if (!nextMeta['2026-11'].practiceNotes) nextMeta['2026-11'].practiceNotes = SEED_SCHEDULE_META['2026-11'].practiceNotes
    if (!nextMeta['2026-11'].banner) nextMeta['2026-11'].banner = SEED_SCHEDULE_META['2026-11'].banner
  }
  return { services: nextServices, members: nextMembers, scheduleMeta: nextMeta }
}
