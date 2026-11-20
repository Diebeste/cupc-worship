import './styles.css'
import { h, clear, parseHash, go, copyText } from './dom.js'
import { t as tr } from './i18n.js'
import * as db from './db/local.js'
import * as sync from './db/sync.js'
import { stampedSeed } from './data/seed.js'
import { parseSongsFromText, parseSongChunk, searchHaystack, songToPlainText } from './music/parseLyrics.js'
import { COMMON_KEYS, displayKey, stepsBetween, preferFlatsFor, capoSuggestion } from './music/transpose.js'
import { importFilesToSongs } from './music/importFile.js'
import { serviceWhatsAppText, encodeSharePayload, decodeSharePayload, formatDate, renderSongPlain } from './music/export.js'
import { renderLyrics, planFor, sectionsToPaste } from './views/lyrics.js'

const BASE = import.meta.env.BASE_URL || '/'

const state = {
  ready: false,
  settings: db.defaultSettings(),
  songs: [],
  services: [],
  toast: '',
  online: navigator.onLine,
  importPreview: null,
  stageSize: 28
}

let wakeLock = null
let toastTimer = 0

const t = (key, vars) => tr(state.settings.uiLang || 'en', key, vars)
const songsById = () => Object.fromEntries(state.songs.map((s) => [s.id, s]))
const canEdit = () => !sync.isConfigured(state.settings) || state.settings.role === 'admin' || state.settings.canEdit
const byId = (list, id) => list.find((x) => x.id === id)

function toast(msg) {
  state.toast = msg
  render()
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { state.toast = ''; render() }, 2400)
}

async function persistSettings() {
  await db.setMeta('settings', state.settings)
}

async function saveSong(song, { silent = false } = {}) {
  song.updatedAt = db.nowIso()
  if (!song.createdAt) song.createdAt = song.updatedAt
  const i = state.songs.findIndex((s) => s.id === song.id)
  if (i >= 0) state.songs[i] = song
  else state.songs.unshift(song)
  await db.putOne('songs', song)
  if (sync.isConfigured(state.settings) && canEdit()) {
    try { await sync.pushSong(state.settings, song) } catch (e) { console.warn(e) }
  }
  if (!silent) toast(t('saved'))
  render()
}

async function saveService(service, { silent = false } = {}) {
  service.updatedAt = db.nowIso()
  if (!service.createdAt) service.createdAt = service.updatedAt
  const i = state.services.findIndex((s) => s.id === service.id)
  if (i >= 0) state.services[i] = service
  else state.services.unshift(service)
  await db.putOne('services', service)
  if (sync.isConfigured(state.settings) && canEdit()) {
    try { await sync.pushService(state.settings, service) } catch (e) { console.warn(e) }
  }
  if (!silent) toast(t('saved'))
  render()
}

async function removeSong(id) {
  if (!confirm(t('confirmDelete'))) return
  state.songs = state.songs.filter((s) => s.id !== id)
  for (const svc of state.services) {
    const before = svc.items?.length || 0
    svc.items = (svc.items || []).filter((it) => it.songId !== id)
    if (svc.items.length !== before) await db.putOne('services', svc)
  }
  await db.deleteOne('songs', id)
  if (sync.isConfigured(state.settings)) {
    try { await sync.removeSongRemote(state.settings, id) } catch (e) { console.warn(e) }
  }
  go('/songs')
  toast(t('delete'))
}

async function removeService(id) {
  if (!confirm(t('confirmDelete'))) return
  state.services = state.services.filter((s) => s.id !== id)
  await db.deleteOne('services', id)
  if (sync.isConfigured(state.settings)) {
    try { await sync.removeServiceRemote(state.settings, id) } catch (e) { console.warn(e) }
  }
  go('/services')
}

function applyTheme() {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light', 'theme-system')
  const theme = state.settings.theme || 'system'
  root.classList.add('theme-' + theme)
  if (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) {
    root.classList.add('theme-dark')
  }
}

function navItem(href, ico, label, on) {
  return h('a', { href: '#' + href, class: on ? 'on' : '' },
    h('span', { class: 'ico' }, ico),
    label
  )
}

function shell(content, { stage = false, print = false, title } = {}) {
  const { parts } = parseHash()
  const tab = parts[0] || 'services'
  const app = h('div', { class: 'app-shell' + (stage ? ' is-stage' : '') + (print ? ' is-print' : '') })
  if (!stage && !print) {
    app.append(
      h('header', { class: 'topbar' },
        h('img', { class: 'logo', src: `${BASE}icons/icon-192.png`, alt: 'CUPC' }),
        h('img', { class: 'wordmark', src: `${BASE}logo-wordmark.png`, alt: '' }),
        h('div', { class: 'titles' },
          h('span', { class: 'church' }, t('church')),
          h('h1', {}, title || t('appName'))
        ),
        h('div', { class: 'lang-toggle' },
          h('button', { class: state.settings.uiLang === 'en' ? 'on' : '', type: 'button', onclick: async () => { state.settings.uiLang = 'en'; await persistSettings(); render() } }, 'EN'),
          h('button', { class: state.settings.uiLang === 'es' ? 'on' : '', type: 'button', onclick: async () => { state.settings.uiLang = 'es'; await persistSettings(); render() } }, 'ES')
        )
      )
    )
    if (!sync.isConfigured(state.settings)) {
      app.append(
        h('div', { class: 'banner' },
          t('demoBanner'), ' ',
          h('a', { href: '#/settings' }, t('openSetup'))
        )
      )
    }
  }
  app.append(content)
  if (!stage && !print) {
    app.append(
      h('nav', { class: 'bottom-nav' },
        navItem('/services', '🗓️', t('services'), tab === 'services' || !tab),
        navItem('/songs', '🎵', t('songs'), tab === 'songs'),
        navItem('/import', '📥', t('import'), tab === 'import'),
        navItem('/settings', '⚙️', t('settings'), tab === 'settings')
      )
    )
  }
  if (state.toast) app.append(h('div', { class: 'toast' }, state.toast))
  return app
}

function keyBadge(key, lg) {
  if (!key) return h('span', { class: 'key-badge empty' + (lg ? ' lg' : '') }, '—')
  return h('span', { class: 'key-badge' + (lg ? ' lg' : '') }, displayKey(key))
}

function songSearch(q) {
  const s = (q || '').trim().toLowerCase()
  if (!s) return state.songs.slice().sort((a, b) => a.title.localeCompare(b.title))
  return state.songs.filter((song) => searchHaystack(song).includes(s)).sort((a, b) => a.title.localeCompare(b.title))
}

/* ---------- Pages ---------- */
function pageServices() {
  const q = (parseHash().query.q || '')
  const list = state.services
    .filter((s) => !q || `${s.name} ${s.leader} ${s.notes}`.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, t('services'))),
    h('div', { class: 'fab-row' },
      canEdit() ? h('button', { class: 'btn peach', onclick: () => go('/services/new') }, '+ ' + t('newService')) : null
    ),
    h('input', { class: 'search', placeholder: t('searchServices'), value: q, oninput: (e) => go('/services?q=' + encodeURIComponent(e.target.value), { replace: true }) })
  )
  if (!list.length) page.append(h('div', { class: 'empty' }, t('emptyServices')))
  for (const svc of list) {
    page.append(
      h('div', { class: 'card clickable', onclick: () => go('/services/' + svc.id) },
        h('div', { class: 'row spread' },
          h('div', { class: 'grow' },
            h('h3', { class: 'list-title' }, svc.name),
            h('div', { class: 'meta' }, [formatDate(svc.date) || '—', typeLabel(svc.type), svc.leader].filter(Boolean).join(' · '))
          ),
          h('div', { class: 'meta' }, `${svc.items?.length || 0}`)
        ),
        h('div', { class: 'chips' },
          ...(svc.items || []).slice(0, 6).map((it) => {
            const song = byId(state.songs, it.songId)
            return h('span', { class: 'chip' }, `${song?.title || '—'} ${it.key || song?.originalKey || ''}`.trim())
          })
        )
      )
    )
  }
  return shell(page, { title: t('services') })
}

function typeLabel(type) {
  return ({ sunday: t('typeSunday'), thursday: t('typeThursday'), event: t('typeEvent'), adhoc: t('typeAdhoc') })[type] || type || ''
}

function pageServiceDetail(id) {
  const svc = byId(state.services, id)
  if (!svc) return shell(h('div', { class: 'page' }, 'Not found'))
  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {},
        h('div', { class: 'meta' }, [formatDate(svc.date), typeLabel(svc.type), svc.leader].filter(Boolean).join(' · ')),
        h('h2', {}, svc.name)
      )
    ),
    h('div', { class: 'actions' },
      h('button', { class: 'btn peach', onclick: () => go('/services/' + svc.id + '/stage') }, t('stage')),
      canEdit() ? h('button', { class: 'btn secondary', onclick: () => go('/services/' + svc.id + '/edit') }, t('edit')) : null,
      canEdit() ? h('button', { class: 'btn secondary', onclick: () => duplicateService(svc) }, t('duplicate')) : null,
      h('button', { class: 'btn secondary', onclick: () => go('/services/' + svc.id + '/print') }, t('exportPdf')),
      h('button', { class: 'btn secondary', onclick: () => shareService(svc) }, t('share')),
      h('button', { class: 'btn secondary', onclick: () => copyServiceText(svc) }, t('whatsapp'))
    )
  )
  if (svc.notes) page.append(h('p', { class: 'help' }, svc.notes))
  page.append(h('h3', { style: { margin: '8px 0' } }, t('serviceSongs')))
  if (!svc.items?.length) page.append(h('div', { class: 'empty' }, t('emptySetlist')))
  ;(svc.items || []).forEach((item, idx) => {
    const song = byId(state.songs, item.songId)
    page.append(
      h('div', { class: 'card clickable', onclick: () => song && go('/songs/' + song.id + '?svc=' + svc.id + '&key=' + encodeURIComponent(item.key || '')) },
        h('div', { class: 'row' },
          h('div', { class: 'meta', style: { width: '1.2em' } }, String(idx + 1)),
          keyBadge(item.key || song?.originalKey),
          h('div', { class: 'grow' },
            h('div', { class: 'list-title' }, song?.title || '—'),
            h('div', { class: 'meta' }, [item.lead, item.notes, song?.originalKey && item.key && item.key !== song.originalKey ? `${t('originalKey')} ${song.originalKey}` : ''].filter(Boolean).join(' · '))
          )
        )
      )
    )
  })
  if (canEdit()) {
    page.append(
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: () => openAddSong(svc) }, '+ ' + t('addSong')),
        h('button', { class: 'btn danger', onclick: () => removeService(svc.id) }, t('delete'))
      )
    )
  }
  return shell(page, { title: svc.name })
}

function openAddSong(svc) {
  const overlay = h('div', { class: 'picker', onclick: (e) => { if (e.target === overlay) overlay.remove() } })
  const qBox = h('input', { class: 'search', placeholder: t('searchSongs') })
  const list = h('div')
  const draw = () => {
    clear(list)
    const q = qBox.value
    for (const song of songSearch(q)) {
      list.append(
        h('div', { class: 'card clickable', onclick: async () => {
          svc.items = svc.items || []
          svc.items.push({ songId: song.id, key: song.originalKey || '', lead: '', notes: '' })
          await saveService(svc)
          overlay.remove()
          go('/services/' + svc.id)
        } }, song.title, ' ', h('span', { class: 'chip' }, song.originalKey || '—'))
      )
    }
  }
  qBox.addEventListener('input', draw)
  draw()
  overlay.append(
    h('div', { class: 'sheet' },
      h('h3', {}, t('fromLibrary')),
      qBox, list,
      canEdit() ? h('button', { class: 'btn block', style: { marginTop: '12px' }, onclick: () => { overlay.remove(); go('/songs/new?svc=' + svc.id) } }, t('pasteNew')) : null,
      h('button', { class: 'btn ghost block', onclick: () => overlay.remove() }, t('close'))
    )
  )
  document.getElementById('app').append(overlay)
}

async function duplicateService(svc) {
  const copy = {
    ...structuredClone(svc),
    id: db.uid('service'),
    name: svc.name + ' (copy)',
    date: new Date().toISOString().slice(0, 10),
    createdAt: db.nowIso(),
    updatedAt: db.nowIso()
  }
  await saveService(copy, { silent: true })
  go('/services/' + copy.id + '/edit')
  toast(t('duplicate'))
}

async function shareService(svc) {
  const songs = (svc.items || []).map((it) => byId(state.songs, it.songId)).filter(Boolean)
  const token = encodeSharePayload(svc, songs)
  const url = `${location.origin}${BASE}#/s/${token}`
  if (navigator.share) {
    try { await navigator.share({ title: svc.name, url, text: svc.name }); return } catch {}
  }
  await copyText(url)
  toast(t('linkCopied'))
}

async function copyServiceText(svc) {
  const text = serviceWhatsAppText(svc, songsById(), { lang: state.settings.lyricLang || 'both' })
  await copyText(text)
  toast(t('copied'))
}

function pageServiceEdit(id) {
  const isNew = id === 'new'
  const svc = isNew
    ? { id: db.uid('service'), name: '', date: new Date().toISOString().slice(0, 10), type: 'adhoc', leader: '', notes: '', items: [], createdAt: db.nowIso() }
    : structuredClone(byId(state.services, id) || null)
  if (!svc) return shell(h('div', { class: 'page' }, 'Not found'))
  const name = h('input', { value: svc.name, placeholder: t('untitledService') })
  const date = h('input', { type: 'date', value: svc.date || '' })
  const type = h('select', {},
    ...['sunday', 'thursday', 'event', 'adhoc'].map((v) => h('option', { value: v, selected: svc.type === v }, typeLabel(v)))
  )
  const leader = h('input', { value: svc.leader || '', placeholder: t('leader') })
  const notes = h('textarea', { value: svc.notes || '', style: { minHeight: '80px' } })
  const itemsBox = h('div')

  const redrawItems = () => {
    clear(itemsBox)
    ;(svc.items || []).forEach((item, idx) => {
      const song = byId(state.songs, item.songId)
      const keySel = keySelect(item.key || song?.originalKey || '')
      keySel.addEventListener('change', () => { item.key = keySel.value })
      const lead = h('input', { value: item.lead || '', placeholder: t('lead') })
      lead.addEventListener('input', () => { item.lead = lead.value })
      itemsBox.append(
        h('div', { class: 'card' },
          h('div', { class: 'row spread' },
            h('strong', {}, `${idx + 1}. ${song?.title || '—'}`),
            h('button', { class: 'btn ghost', type: 'button', onclick: () => { svc.items.splice(idx, 1); redrawItems() } }, t('remove'))
          ),
          h('div', { class: 'grid-2', style: { marginTop: '8px' } },
            h('div', { class: 'field' }, h('label', {}, t('overrideKey')), keySel),
            h('div', { class: 'field' }, h('label', {}, t('lead')), lead)
          )
        )
      )
    })
    itemsBox.append(h('button', { class: 'btn secondary', type: 'button', onclick: () => {
      const overlayParent = document.getElementById('app')
      const picker = h('div', { class: 'picker', onclick: (e) => { if (e.target === picker) picker.remove() } })
      const box = h('div')
      for (const song of songSearch('')) {
        box.append(h('div', { class: 'card clickable', onclick: () => {
          svc.items = svc.items || []
          svc.items.push({ songId: song.id, key: song.originalKey || '', lead: '', notes: '' })
          picker.remove()
          redrawItems()
        } }, song.title))
      }
      picker.append(h('div', { class: 'sheet' }, h('h3', {}, t('addSong')), box, h('button', { class: 'btn ghost block', onclick: () => picker.remove() }, t('close'))))
      overlayParent.append(picker)
    } }, '+ ' + t('addSong')))
  }
  redrawItems()

  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, isNew ? t('newService') : t('edit'))),
    h('div', { class: 'field' }, h('label', {}, t('name')), name),
    h('div', { class: 'grid-2' },
      h('div', { class: 'field' }, h('label', {}, t('date')), date),
      h('div', { class: 'field' }, h('label', {}, t('type')), type)
    ),
    h('div', { class: 'field' }, h('label', {}, t('leader')), leader),
    h('div', { class: 'field' }, h('label', {}, t('notes')), notes),
    h('h3', {}, t('serviceSongs')),
    itemsBox,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: async () => {
        svc.name = name.value.trim() || t('untitledService')
        svc.date = date.value
        svc.type = type.value
        svc.leader = leader.value.trim()
        svc.notes = notes.value
        await saveService(svc)
        go('/services/' + svc.id)
      } }, t('save')),
      h('button', { class: 'btn secondary', onclick: () => go(isNew ? '/services' : '/services/' + svc.id) }, t('cancel'))
    )
  )
  return shell(page, { title: isNew ? t('newService') : t('edit') })
}

function keySelect(current) {
  const val = displayKey(current) === '—' ? '' : displayKey(current)
  const opts = [h('option', { value: '' }, '—'), ...COMMON_KEYS.map((k) => h('option', { value: k, selected: k === val }, k))]
  if (val && !COMMON_KEYS.includes(val)) opts.push(h('option', { value: val, selected: true }, val))
  return h('select', {}, ...opts)
}

function pageSongs() {
  const q = parseHash().query.q || ''
  const list = songSearch(q)
  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, t('songs'))),
    h('div', { class: 'fab-row' },
      canEdit() ? h('button', { class: 'btn peach', onclick: () => go('/songs/new') }, '+ ' + t('newSong')) : null,
      canEdit() ? h('button', { class: 'btn secondary', onclick: () => go('/import') }, t('import')) : null
    ),
    h('input', { class: 'search', placeholder: t('searchSongs'), value: q, oninput: (e) => go('/songs?q=' + encodeURIComponent(e.target.value), { replace: true }) })
  )
  if (!list.length) page.append(h('div', { class: 'empty' }, q ? t('noResults') : t('emptySongs')))
  for (const song of list) {
    page.append(
      h('div', { class: 'card clickable', onclick: () => go('/songs/' + song.id) },
        h('div', { class: 'row' },
          keyBadge(song.originalKey),
          h('div', { class: 'grow' },
            h('h3', { class: 'list-title' }, song.title),
            h('div', { class: 'meta' }, [song.artist, song.bpm && `${song.bpm} BPM`].filter(Boolean).join(' · ') || t('key') + ' ' + (song.originalKey || t('unsetKey')))
          )
        )
      )
    )
  }
  return shell(page, { title: t('songs') })
}

function pageSongDetail(id) {
  const song = byId(state.songs, id)
  if (!song) return shell(h('div', { class: 'page' }, 'Not found'))
  const q = parseHash().query
  let target = q.key || song.originalKey || 'C'
  const svc = q.svc ? byId(state.services, q.svc) : null
  const langWrap = { lang: state.settings.lyricLang || 'both' }

  const lyricsHost = h('div')
  const capoEl = h('div', { class: 'help' })
  const keyLabel = h('div', { class: 'row', style: { gap: '12px', margin: '12px 0' } }, keyBadge(target, true), h('div', {}, h('div', { class: 'meta' }, t('targetKey')), h('div', { class: 'list-title', id: 'cur-key' }, displayKey(target))))

  const drawLyrics = () => {
    const from = song.originalKey || target
    const steps = stepsBetween(from, target)
    const useFlats = preferFlatsFor(target)
    const capo = song.originalKey ? capoSuggestion(song.originalKey, target) : { text: '' }
    capoEl.textContent = capo.text ? `${t('capo')}: ${capo.text}` : ''
    keyLabel.querySelector('#cur-key').textContent = displayKey(target)
    keyLabel.replaceChild(keyBadge(target, true), keyLabel.firstChild)
    clear(lyricsHost)
    lyricsHost.append(renderLyrics(song, {
      lang: langWrap.lang,
      layout: state.settings.layout || 'stack',
      showChords: state.settings.showChords !== false,
      steps,
      useFlats
    }))
  }

  const keys = h('div', { class: 'keys' },
    ...COMMON_KEYS.map((k) => {
      const b = h('button', { class: 'key-chip' + (k === displayKey(target) ? ' on' : ''), type: 'button', onclick: () => { target = k; [...keys.children].forEach((c) => c.classList.toggle('on', c.textContent === k)); drawLyrics() } }, k)
      return b
    })
  )

  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' },
      h('div', {},
        song.artist ? h('div', { class: 'meta' }, song.artist) : null,
        h('h2', {}, song.title)
      )
    ),
    svc ? h('div', { class: 'meta' }, svc.name) : null,
    keyLabel,
    h('div', { class: 'transpose-bar' },
      h('button', { class: 'step-btn', type: 'button', onclick: () => shiftKey(-1) }, '−'),
      h('button', { class: 'step-btn', type: 'button', onclick: () => shiftKey(1) }, '+'),
      keys,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { target = song.originalKey || target; [...keys.children].forEach((c) => c.classList.toggle('on', c.textContent === displayKey(target))); drawLyrics() } }, t('resetKey'))
    ),
    capoEl,
    h('div', { class: 'row spread', style: { marginTop: '10px' } },
      h('div', { class: 'seg' },
        ...['es', 'en', 'both'].map((v) => h('button', {
          class: (state.settings.lyricLang || 'both') === v ? 'on' : '',
          type: 'button',
          onclick: async () => {
            state.settings.lyricLang = v
            langWrap.lang = v
            await persistSettings()
            page.querySelectorAll('.seg button').forEach((b, i) => b.classList.toggle('on', ['es', 'en', 'both'][i] === v))
            drawLyrics()
          }
        }, v === 'both' ? t('langBoth') : v === 'en' ? t('langEn') : t('langEs')))
      ),
      h('label', { class: 'meta' },
        h('input', { type: 'checkbox', checked: state.settings.showChords !== false, onchange: async (e) => { state.settings.showChords = e.target.checked; await persistSettings(); drawLyrics() } }),
        ' ', t('showChords')
      )
    ),
    lyricsHost,
    h('div', { class: 'actions' },
      canEdit() ? h('button', { class: 'btn secondary', onclick: () => go('/songs/' + song.id + '/edit') }, t('edit')) : null,
      h('button', { class: 'btn secondary', onclick: async () => {
        const steps = stepsBetween(song.originalKey || target, target)
        await copyText(songToPlainText({ ...song, originalKey: target }, { lang: langWrap.lang, chords: state.settings.showChords !== false }).replace(/\[([^\]]+)\]/g, (m, c) => {
          // already in source key in songToPlainText; use renderSongPlain instead
          return m
        }) && (renderSongPlain(song, { lang: langWrap.lang, steps, useFlats: preferFlatsFor(target) }) + '\n'))
        toast(t('copied'))
      } }, t('copyText')),
      canEdit() ? h('button', { class: 'btn danger', onclick: () => removeSong(song.id) }, t('delete')) : null
    ),
    song.notes ? h('p', { class: 'help' }, song.notes) : null
  )

  function shiftKey(delta) {
    const i = COMMON_KEYS.indexOf(displayKey(target))
    const idx = i < 0 ? 0 : (i + delta + COMMON_KEYS.length) % COMMON_KEYS.length
    target = COMMON_KEYS[idx]
    ;[...keys.children].forEach((c) => c.classList.toggle('on', c.textContent === target))
    drawLyrics()
  }
  drawLyrics()
  return shell(page, { title: song.title })
}

function pageSongEdit(id) {
  const isNew = id === 'new'
  const existing = isNew ? null : byId(state.songs, id)
  if (!isNew && !existing) return shell(h('div', { class: 'page' }, 'Not found'))
  const song = existing ? structuredClone(existing) : {
    id: db.uid('song'), title: '', artist: '', originalKey: '', bpm: '', notes: '', sections: [], createdAt: db.nowIso()
  }
  const title = h('input', { value: song.title, placeholder: t('untitled') })
  const artist = h('input', { value: song.artist || '' })
  const key = keySelect(song.originalKey || '')
  const bpm = h('input', { value: song.bpm || '', inputmode: 'numeric', placeholder: '—' })
  const notes = h('textarea', { value: song.notes || '', style: { minHeight: '70px' } })
  const pasteAll = h('textarea', { placeholder: t('pasteHint'), style: { minHeight: '120px' } })
  const es = h('textarea', { value: sectionsToPaste(song.sections, 'es'), placeholder: t('lyricsEs') })
  const en = h('textarea', { value: sectionsToPaste(song.sections, 'en'), placeholder: t('lyricsEn') })

  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, isNew ? t('newSong') : t('edit'))),
    h('div', { class: 'field' }, h('label', {}, t('title')), title),
    h('div', { class: 'grid-2' },
      h('div', { class: 'field' }, h('label', {}, t('originalKey')), key),
      h('div', { class: 'field' }, h('label', {}, t('bpm')), bpm)
    ),
    h('div', { class: 'field' }, h('label', {}, t('artist')), artist),
    isNew ? h('div', { class: 'field' }, h('label', {}, t('pasteLyrics')), pasteAll, h('div', { class: 'help' }, t('pasteHint'))) : null,
    h('div', { class: 'field' }, h('label', {}, t('lyricsEs')), es),
    h('div', { class: 'field' }, h('label', {}, t('lyricsEn')), en),
    h('div', { class: 'field' }, h('label', {}, t('notes')), notes),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: async () => onSave() }, t('save')),
      h('button', { class: 'btn secondary', onclick: () => go(isNew ? '/songs' : '/songs/' + song.id) }, t('cancel'))
    )
  )

  async function onSave() {
    if (isNew && pasteAll.value.trim() && !es.value.trim() && !en.value.trim()) {
      const parsed = parseSongsFromText(pasteAll.value)
      if (parsed[0]) {
        Object.assign(song, {
          title: title.value.trim() || parsed[0].title,
          originalKey: key.value || parsed[0].originalKey,
          artist: artist.value.trim(),
          bpm: bpm.value.trim(),
          notes: notes.value,
          sections: parsed[0].sections
        })
        // If multiple songs were pasted, import them all
        if (parsed.length > 1) {
          for (const p of parsed) {
            const rec = {
              id: p === parsed[0] ? song.id : db.uid('song'),
              title: p.title,
              artist: '',
              originalKey: p.originalKey,
              bpm: '',
              notes: notes.value,
              sections: p.sections,
              createdAt: db.nowIso(),
              updatedAt: db.nowIso()
            }
            await saveSong(rec, { silent: true })
          }
          toast(t('importN', { n: parsed.length }))
          const svcId = parseHash().query.svc
          if (svcId) {
            const svc = byId(state.services, svcId)
            if (svc) {
              svc.items = svc.items || []
              for (const p of parsed) {
                const rec = state.songs.find((s) => s.title === p.title && s.originalKey === p.originalKey)
                if (rec && !svc.items.some((it) => it.songId === rec.id)) {
                  svc.items.push({ songId: rec.id, key: rec.originalKey || '', lead: '', notes: '' })
                }
              }
              await saveService(svc, { silent: true })
              go('/services/' + svc.id)
              return
            }
          }
          go('/songs')
          return
        }
      }
    } else {
      song.title = title.value.trim() || t('untitled')
      song.artist = artist.value.trim()
      song.originalKey = key.value
      song.bpm = bpm.value.trim()
      song.notes = notes.value
      song.sections = mergeEditorSections(es.value, en.value)
    }
    if (!song.title) song.title = t('untitled')
    await saveSong(song)
    const svcId = parseHash().query.svc
    if (svcId) {
      const svc = byId(state.services, svcId)
      if (svc) {
        svc.items = svc.items || []
        if (!svc.items.some((it) => it.songId === song.id)) {
          svc.items.push({ songId: song.id, key: song.originalKey || '', lead: '', notes: '' })
          await saveService(svc, { silent: true })
        }
        go('/services/' + svc.id)
        return
      }
    }
    go('/songs/' + song.id)
  }

  return shell(page, { title: isNew ? t('newSong') : t('edit') })
}

function mergeEditorSections(esText, enText) {
  const esSecs = parseSongChunk({ title: 'x', key: '', body: String(esText || '').split('\n') }).sections
  const enSecs = parseSongChunk({ title: 'x', key: '', body: String(enText || '').split('\n') }).sections
  const n = Math.max(esSecs.length, enSecs.length, 1)
  const out = []
  for (let i = 0; i < n; i++) {
    const es = esSecs[i]
    const en = enSecs[i]
    out.push({
      type: (es && es.type !== 'verse' ? es.type : null) || (en && en.type !== 'verse' ? en.type : null) || 'verse',
      label: es?.label || en?.label || '',
      notes: [es?.notes, en?.notes].filter(Boolean).join(' · '),
      linesEs: es ? (es.linesEs?.some(Boolean) ? es.linesEs : es.linesEn) : [],
      linesEn: en ? (en.linesEn?.some(Boolean) ? en.linesEn : en.linesEs) : []
    })
  }
  return out.filter((s) => s.linesEn?.some(Boolean) || s.linesEs?.some(Boolean) || s.notes)
}

function pageImport() {
  const ta = h('textarea', { placeholder: t('pasteHint') })
  const preview = h('div')
  const fileInput = h('input', { type: 'file', accept: '.pdf,.docx,.txt,.md,text/plain,application/pdf', multiple: true, style: { display: 'none' } })

  const showPreview = (songs, sourceLabel) => {
    state.importPreview = songs
    clear(preview)
    preview.append(h('h3', {}, t('preview') + (sourceLabel ? ' — ' + sourceLabel : '')))
    if (!songs.length) preview.append(h('p', { class: 'muted' }, t('noResults')))
    songs.forEach((s, i) => {
      preview.append(
        h('div', { class: 'preview-song' },
          h('div', { class: 'row' }, keyBadge(s.originalKey), h('strong', {}, s.title), h('span', { class: 'meta' }, `${s.sections?.length || 0} ${t('sections')}`))
        )
      )
    })
    if (songs.length) {
      preview.append(h('button', { class: 'btn block', onclick: () => commitImport(songs) }, t('importN', { n: songs.length })))
    }
  }

  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return
    preview.textContent = '…'
    const results = await importFilesToSongs(fileInput.files)
    const songs = results.flatMap((r) => r.songs)
    const errors = results.filter((r) => r.error)
    showPreview(songs, results.map((r) => r.file).join(', '))
    if (errors.length) preview.prepend(h('p', { class: 'help' }, errors.map((e) => `${e.file}: ${e.error}`).join('\n')))
  })

  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, t('import'))),
    h('div', { class: 'field' },
      h('label', {}, t('pasteLyrics')),
      ta,
      h('div', { class: 'help' }, t('pasteHint'))
    ),
    h('button', { class: 'btn secondary', onclick: () => showPreview(parseSongsFromText(ta.value), t('pasteLyrics')) }, t('preview')),
    h('hr', { class: 'sep' }),
    h('label', { class: 'file-drop', onclick: () => fileInput.click() },
      h('div', {}, t('importFiles')),
      h('div', { class: 'help' }, t('importFilesHint'))
    ),
    fileInput,
    preview
  )
  return shell(page, { title: t('import') })
}

async function commitImport(songs) {
  let n = 0
  for (const p of songs) {
    const rec = {
      id: db.uid('song'),
      title: p.title,
      artist: p.artist || '',
      originalKey: p.originalKey || '',
      bpm: p.bpm || '',
      notes: p.notes || '',
      sections: p.sections,
      createdAt: db.nowIso(),
      updatedAt: db.nowIso()
    }
    await saveSong(rec, { silent: true })
    n++
  }
  toast(t('importN', { n }))
  go('/songs')
}

function pageStage(id) {
  const svc = byId(state.services, id)
  if (!svc) return shell(h('div', { class: 'page' }, 'Not found'))
  const items = svc.items || []
  let idx = Number(parseHash().query.i || 0)
  if (idx < 0) idx = 0
  if (idx >= items.length) idx = Math.max(0, items.length - 1)
  const item = items[idx]
  const song = item ? byId(state.songs, item.songId) : null
  const key = item?.key || song?.originalKey || ''
  const steps = song ? stepsBetween(song.originalKey || key, key) : 0
  const useFlats = preferFlatsFor(key)
  let lang = state.settings.lyricLang || 'both'

  const lyricsHost = h('div', { class: 'lyrics' })
  const draw = () => {
    clear(lyricsHost)
    if (!song) { lyricsHost.append(h('p', {}, '—')); return }
    lyricsHost.append(renderLyrics(song, { lang, layout: 'stack', showChords: state.settings.showChords !== false, steps, useFlats }))
  }
  draw()

  const goIdx = (n) => {
    const next = Math.max(0, Math.min(items.length - 1, n))
    go('/services/' + svc.id + '/stage?i=' + next, { replace: true })
  }

  const root = h('div', { class: 'stage', style: { '--stage-size': state.stageSize + 'px' } },
    h('div', { class: 'stage-top' },
      h('button', { class: 'icon-btn', onclick: () => { releaseWake(); go('/services/' + svc.id) } }, '✕'),
      h('div', { class: 'grow' },
        h('div', { class: 'meta' }, `${idx + 1} / ${items.length} · ${svc.name}`),
        h('h2', {}, song?.title || '—')
      ),
      keyBadge(key, true)
    ),
    h('div', { class: 'row spread' },
      h('div', { class: 'seg' },
        ...['es', 'en', 'both'].map((v) => h('button', { class: lang === v ? 'on' : '', type: 'button', onclick: function () { lang = v; this.parentElement.querySelectorAll('button').forEach((b) => b.classList.remove('on')); this.classList.add('on'); draw() } }, v === 'both' ? t('langBoth') : v.toUpperCase()))
      ),
      h('div', {},
        h('button', { class: 'icon-btn', onclick: () => { state.stageSize = Math.max(18, state.stageSize - 2); root.style.setProperty('--stage-size', state.stageSize + 'px') } }, 'A−'),
        h('button', { class: 'icon-btn', onclick: () => { state.stageSize = Math.min(48, state.stageSize + 2); root.style.setProperty('--stage-size', state.stageSize + 'px') } }, 'A+')
      )
    ),
    lyricsHost,
    h('div', { class: 'stage-bot' },
      h('button', { class: 'btn secondary', disabled: idx === 0, onclick: () => goIdx(idx - 1) }, '‹ ' + t('prev')),
      h('div', { class: 'grow meta', style: { textAlign: 'center' } }, t('screenAwake')),
      h('button', { class: 'btn peach', disabled: idx >= items.length - 1, onclick: () => goIdx(idx + 1) }, t('next') + ' ›')
    )
  )

  let startX = 0
  root.addEventListener('touchstart', (e) => { startX = e.changedTouches[0].clientX }, { passive: true })
  root.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX
    if (dx > 50) goIdx(idx - 1)
    if (dx < -50) goIdx(idx + 1)
  }, { passive: true })

  requestWake()
  return shell(root, { stage: true, title: song?.title })
}

async function requestWake() {
  try {
    if (navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen')
      wakeLock.addEventListener('release', () => { wakeLock = null })
    }
  } catch { /* not allowed */ }
}
async function releaseWake() {
  try { await wakeLock?.release() } catch {}
  wakeLock = null
}

function pagePrint(id) {
  const svc = byId(state.services, id)
  if (!svc) return shell(h('div', { class: 'page' }, 'Not found'))
  const map = songsById()
  const root = h('div', { class: 'print-root' },
    h('div', { class: 'no-print actions' },
      h('button', { class: 'btn', onclick: () => window.print() }, t('exportPdf')),
      h('button', { class: 'btn secondary', onclick: () => go('/services/' + svc.id) }, t('close'))
    ),
    h('h1', {}, svc.name),
    h('p', {}, [formatDate(svc.date), typeLabel(svc.type), svc.leader].filter(Boolean).join(' · ')),
    svc.notes ? h('p', {}, svc.notes) : null,
    h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, t('title')), h('th', {}, t('key')), h('th', {}, t('lead')))),
      h('tbody', {},
        ...(svc.items || []).map((it) => {
          const song = map[it.songId]
          return h('tr', {}, h('td', {}, song?.title || '—'), h('td', {}, it.key || song?.originalKey || ''), h('td', {}, it.lead || ''))
        })
      )
    )
  )
  for (const it of svc.items || []) {
    const song = map[it.songId]
    if (!song) continue
    const key = it.key || song.originalKey || ''
    const steps = stepsBetween(song.originalKey || key, key)
    root.append(h('h2', { class: 'song-title' }, `${song.title}${key ? ' (' + key + ')' : ''}`))
    root.append(renderLyrics(song, { lang: state.settings.lyricLang || 'both', layout: 'stack', showChords: true, steps, useFlats: preferFlatsFor(key) }))
  }
  return shell(root, { print: true, title: svc.name })
}

function pageSettings() {
  const s = state.settings
  const url = h('input', { value: s.supabaseUrl || '', placeholder: 'https://xxxx.supabase.co', autocomplete: 'off' })
  const key = h('input', { value: s.supabaseAnonKey || '', placeholder: 'eyJ…', autocomplete: 'off' })
  const email = h('input', { type: 'email', value: s.userEmail || '', placeholder: 'you@church.org' })
  const join = h('input', { value: s.joinCode || '', placeholder: 'CUPC-XXXX', autocomplete: 'off' })
  const name = h('input', { value: s.displayName || '', placeholder: t('displayName') })

  const page = h('div', { class: 'page' },
    h('div', { class: 'page-head' }, h('h2', {}, t('settings'))),
    h('div', { class: 'field' },
      h('label', {}, t('uiLanguage')),
      h('div', { class: 'seg' },
        h('button', { class: s.uiLang === 'en' ? 'on' : '', onclick: async () => { s.uiLang = 'en'; await persistSettings(); render() } }, 'English'),
        h('button', { class: s.uiLang === 'es' ? 'on' : '', onclick: async () => { s.uiLang = 'es'; await persistSettings(); render() } }, 'Español')
      )
    ),
    h('div', { class: 'field' },
      h('label', {}, t('darkMode')),
      h('div', { class: 'seg' },
        ...['system', 'light', 'dark'].map((v) => h('button', { class: (s.theme || 'system') === v ? 'on' : '', onclick: async () => { s.theme = v; await persistSettings(); applyTheme(); render() } }, t(v === 'system' ? 'system' : v === 'light' ? 'light' : 'dark')))
      )
    ),
    h('div', { class: 'field' },
      h('label', {}, t('language')),
      h('div', { class: 'seg' },
        ...['es', 'en', 'both'].map((v) => h('button', { class: (s.lyricLang || 'both') === v ? 'on' : '', onclick: async () => { s.lyricLang = v; await persistSettings(); render() } }, v === 'both' ? t('langBoth') : v.toUpperCase()))
      )
    ),
    h('hr', { class: 'sep' }),
    h('h3', {}, t('howToInstall')),
    h('p', { class: 'help' }, t('installHint')),
    h('p', { class: 'help' }, t('installIos')),
    h('p', { class: 'help' }, t('installAndroid')),
    h('hr', { class: 'sep' }),
    h('h3', {}, t('teamSync')),
    h('p', { class: 'help' }, t('setupLead')),
    h('p', { class: 'meta' }, sync.isConfigured(s) ? t('syncOn') : t('syncOff')),
    h('div', { class: 'field' }, h('label', {}, t('supabaseUrl')), url),
    h('div', { class: 'field' }, h('label', {}, t('supabaseKey')), key),
    h('button', { class: 'btn', onclick: async () => {
      s.supabaseUrl = url.value.trim().replace(/\/$/, '')
      s.supabaseAnonKey = key.value.trim()
      await persistSettings()
      toast(t('saved'))
      render()
    } }, t('connect')),
    sync.isConfigured(s) ? h('div', {},
      h('div', { class: 'field', style: { marginTop: '16px' } }, h('label', {}, t('displayName')), name),
      h('div', { class: 'field' }, h('label', {}, t('magicLink')), email),
      h('button', { class: 'btn secondary', onclick: async () => {
        s.displayName = name.value.trim()
        s.userEmail = email.value.trim()
        await persistSettings()
        try {
          await sync.sendMagicLink(s, email.value.trim(), `${location.origin}${BASE}`)
          toast('Email sent')
        } catch (e) { toast(e.message || String(e)) }
      } }, t('sendLink')),
      h('div', { class: 'field', style: { marginTop: '16px' } }, h('label', {}, t('joinCode')), join),
      h('button', { class: 'btn secondary', onclick: async () => {
        s.joinCode = join.value.trim()
        s.displayName = name.value.trim()
        await persistSettings()
        try {
          const data = await sync.joinTeam(s, join.value, name.value)
          if (data?.team_id) s.teamId = data.team_id
          if (data?.role) s.role = data.role
          await persistSettings()
          toast(t('join'))
          await tryPull()
        } catch (e) { toast(e.message || String(e)) }
      } }, t('join')),
      h('button', { class: 'btn', style: { marginTop: '8px' }, onclick: async () => {
        s.joinCode = join.value.trim()
        s.displayName = name.value.trim()
        await persistSettings()
        try {
          const data = await sync.createTeam(s, 'CUPC Mississauga Worship', join.value)
          if (data?.team_id) s.teamId = data.team_id
          s.role = 'admin'
          s.canEdit = true
          await persistSettings()
          toast('Team created')
          await tryPull()
        } catch (e) { toast(e.message || String(e)) }
      } }, 'Create team'),
      s.userEmail ? h('p', { class: 'help' }, t('signedInAs') + ' ' + (s.userEmail || '')) : null,
      h('button', { class: 'btn ghost', onclick: async () => { await sync.signOut(s); toast(t('signOut')) } }, t('signOut'))
    ) : null,
    h('hr', { class: 'sep' }),
    h('h3', {}, t('backup')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn secondary', onclick: exportBackup }, t('exportBackup')),
      h('button', { class: 'btn secondary', onclick: importBackup }, t('importBackup'))
    ),
    h('hr', { class: 'sep' }),
    h('h3', {}, t('about')),
    h('p', { class: 'help' }, t('seedNote')),
    h('p', { class: 'help' }, t('privacyNote'))
  )
  return shell(page, { title: t('settings') })
}

async function exportBackup() {
  const data = await db.exportBackup({ songs: state.songs, services: state.services, settings: state.settings })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `cupc-worship-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  toast(t('saved'))
}

function importBackup() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      if (!data.songs || !data.services) throw new Error('Invalid backup')
      state.songs = data.songs
      state.services = data.services
      await db.putMany('songs', data.songs)
      await db.putMany('services', data.services)
      toast(t('importN', { n: data.songs.length }))
      render()
    } catch (e) { toast(e.message || String(e)) }
  }
  input.click()
}

/* ---------- Router ---------- */
function render() {
  applyTheme()
  const root = document.getElementById('app')
  const { parts } = parseHash()
  let view
  if (!state.ready) {
    view = h('div', { class: 'page' }, h('p', { class: 'muted' }, '…'))
  } else if (parts[0] === 's' && parts[1]) {
    ingestShare(parts[1])
    view = h('div', { class: 'page' }, '…')
  } else if (parts[0] === 'songs' && parts[1] === 'new') view = pageSongEdit('new')
  else if (parts[0] === 'songs' && parts[2] === 'edit') view = pageSongEdit(parts[1])
  else if (parts[0] === 'songs' && parts[1]) view = pageSongDetail(parts[1])
  else if (parts[0] === 'songs') view = pageSongs()
  else if (parts[0] === 'import') view = pageImport()
  else if (parts[0] === 'settings') view = pageSettings()
  else if (parts[0] === 'services' && parts[1] === 'new') view = pageServiceEdit('new')
  else if (parts[0] === 'services' && parts[2] === 'edit') view = pageServiceEdit(parts[1])
  else if (parts[0] === 'services' && parts[2] === 'stage') view = pageStage(parts[1])
  else if (parts[0] === 'services' && parts[2] === 'print') view = pagePrint(parts[1])
  else if (parts[0] === 'services' && parts[1]) view = pageServiceDetail(parts[1])
  else view = pageServices()
  clear(root).append(view)
}

async function ingestShare(token) {
  const payload = decodeSharePayload(token)
  if (!payload?.service) { toast('Invalid link'); go('/services'); return }
  const idMap = {}
  for (const song of payload.songs || []) {
    const existing = state.songs.find((s) => s.id === song.id) || state.songs.find((s) => s.title === song.title && s.originalKey === song.originalKey)
    if (existing) { idMap[song.id] = existing.id; continue }
    const rec = { ...song, id: song.id || db.uid('song'), createdAt: db.nowIso(), updatedAt: db.nowIso() }
    await saveSong(rec, { silent: true })
    idMap[song.id] = rec.id
  }
  const svc = {
    ...payload.service,
    id: db.uid('service'),
    items: (payload.service.items || []).map((it) => ({ ...it, songId: idMap[it.songId] || it.songId })),
    createdAt: db.nowIso(),
    updatedAt: db.nowIso()
  }
  await saveService(svc, { silent: true })
  go('/services/' + svc.id)
}

async function tryPull() {
  if (!sync.isConfigured(state.settings)) return
  try {
    const result = await sync.pullAll(state.settings)
    if (!result || result.needsAuth) return
    if (result.profile) {
      state.settings.role = result.profile.role || state.settings.role
      state.settings.teamId = result.profile.team_id || state.settings.teamId
      state.settings.canEdit = !!result.profile.can_edit || result.profile.role === 'admin'
      state.settings.userId = result.session?.user?.id || ''
      state.settings.userEmail = result.session?.user?.email || state.settings.userEmail
      state.settings.lastSync = db.nowIso()
      await persistSettings()
    }
    if (result.songs?.length) {
      // merge by updatedAt
      const map = new Map(state.songs.map((s) => [s.id, s]))
      for (const s of result.songs) {
        const local = map.get(s.id)
        if (!local || String(s.updatedAt) >= String(local.updatedAt || '')) map.set(s.id, s)
      }
      state.songs = [...map.values()]
      await db.putMany('songs', state.songs)
    }
    if (result.services?.length) {
      const map = new Map(state.services.map((s) => [s.id, s]))
      for (const s of result.services) {
        const local = map.get(s.id)
        if (!local || String(s.updatedAt) >= String(local.updatedAt || '')) map.set(s.id, s)
      }
      state.services = [...map.values()]
      await db.putMany('services', state.services)
    }
  } catch (e) {
    console.warn('sync pull failed', e)
  }
}

async function boot() {
  try {
    const saved = await db.getMeta('settings')
    if (saved) state.settings = { ...db.defaultSettings(), ...saved }
    const [songs, services] = await Promise.all([db.getAll('songs'), db.getAll('services')])
    if (!songs.length && !services.length) {
      const seed = stampedSeed()
      state.songs = seed.songs
      state.services = seed.services
      await db.putMany('songs', seed.songs)
      await db.putMany('services', seed.services)
      await db.setMeta('seeded', true)
    } else {
      state.songs = songs
      state.services = services
    }
    applyTheme()
    state.ready = true
    render()
    await tryPull()
    render()
  } catch (e) {
    console.error(e)
    state.ready = true
    render()
    toast(String(e.message || e))
  }
}

window.addEventListener('hashchange', () => { if (!location.hash.includes('/stage')) releaseWake(); render() })
window.addEventListener('online', () => { state.online = true })
window.addEventListener('offline', () => { state.online = false })
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme)

try {
  const { registerSW } = await import('virtual:pwa-register')
  registerSW({ immediate: true })
} catch { /* dev without plugin */ }

if (!location.hash || location.hash === '#') location.hash = '#/services'
boot()
