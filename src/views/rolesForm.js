import { h, clear } from '../dom.js'
import { DEFAULT_INSTRUMENTS, SUBTITLE_SUGGESTIONS, normalizeService, rememberMany, membersFromService } from '../data/roles.js'

function datalist(id, members) {
  return h('datalist', { id }, ...members.map((m) => h('option', { value: m.name })))
}

export function mountRolesFields({ svc, members, t }) {
  const data = normalizeService(structuredClone(svc))
  if (!data.instruments.length) {
    data.instruments = DEFAULT_INSTRUMENTS.map((name) => ({ name, player: '' }))
  }
  const listId = 'member-suggest-' + Math.random().toString(36).slice(2, 8)
  const root = h('div', { class: 'roles-block' })

  const subtitle = h('input', {
    'data-field': 'service-subtitle',
    value: data.subtitle || '',
    list: 'subtitle-suggest',
    placeholder: t('subtitleHint')
  })
  const leader = h('input', { 'data-field': 'service-leader', value: data.leader || '', list: listId, placeholder: t('leader') })
  const ujier = h('input', { 'data-field': 'service-ujier', value: data.ujier || '', list: listId, placeholder: t('ujier') })
  const voiceBox = h('div')
  const instBox = h('div')

  const drawVoices = () => {
    clear(voiceBox)
    voiceBox.append(h('div', { class: 'voice-chips' },
      ...(data.voices || []).map((name, i) => h('span', { class: 'voice-chip' },
        name,
        h('button', { type: 'button', 'aria-label': t('remove'), onclick: () => { data.voices.splice(i, 1); drawVoices() } }, '×')
      ))
    ))
    const add = h('input', { 'data-field': 'service-add-voice', list: listId, placeholder: t('addVoice') })
    add.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        commitVoice(add)
      }
    })
    add.addEventListener('change', () => commitVoice(add))
    voiceBox.append(add)
  }
  const commitVoice = (input) => {
    const v = input.value.trim().replace(/,$/, '')
    if (!v) return
    data.voices = data.voices || []
    data.voices.push(v)
    input.value = ''
    drawVoices()
  }

  const drawInst = () => {
    clear(instBox)
    data.instruments.forEach((row, i) => {
      const name = h('input', { 'data-field': 'instrument-name', value: row.name, placeholder: t('instrumentName') })
      const player = h('input', { 'data-field': 'instrument-player', value: row.player, list: listId, placeholder: t('player') })
      name.addEventListener('input', () => { row.name = name.value })
      player.addEventListener('input', () => { row.player = player.value })
      const locked = DEFAULT_INSTRUMENTS.includes(row.name)
      instBox.append(
        h('div', { class: 'inst-row' },
          locked ? h('input', { value: row.name, disabled: true }) : name,
          player,
          h('button', {
            class: 'btn ghost', type: 'button',
            disabled: locked,
            onclick: () => { if (!locked) { data.instruments.splice(i, 1); drawInst() } }
          }, locked ? '' : '×')
        )
      )
    })
    instBox.append(h('button', { class: 'btn secondary', type: 'button', onclick: () => {
      data.instruments.push({ name: '', player: '' })
      drawInst()
    } }, '+ ' + t('addInstrument')))
  }

  drawVoices()
  drawInst()

  root.append(
    h('div', { class: 'field' }, h('label', {}, t('subtitle')), subtitle, h('datalist', { id: 'subtitle-suggest' }, ...SUBTITLE_SUGGESTIONS.map((s) => h('option', { value: s })))),
    h('div', { class: 'field' }, h('label', {}, t('leader')), leader),
    h('div', { class: 'field' }, h('label', {}, t('voices')), voiceBox),
    h('div', { class: 'field' }, h('label', {}, t('instruments')), instBox),
    h('div', { class: 'field' }, h('label', {}, t('ujier')), ujier),
    datalist(listId, members)
  )

  return {
    el: root,
    read() {
      const pendingVoice = voiceBox.querySelector('input')
      if (pendingVoice?.value.trim()) {
        data.voices = data.voices || []
        data.voices.push(pendingVoice.value.trim())
        pendingVoice.value = ''
      }
      return {
        subtitle: subtitle.value.trim(),
        leader: leader.value.trim(),
        voices: (data.voices || []).map((v) => String(v).trim()).filter(Boolean),
        instruments: (data.instruments || []).map((i) => ({ name: (i.name || '').trim(), player: (i.player || '').trim() })).filter((i) => i.name),
        ujier: ujier.value.trim()
      }
    },
    nextMembers(list) {
      const roles = this.read()
      return rememberMany(list, membersFromService(roles))
    }
  }
}

export function renderRolesView(svc, t) {
  const voices = (svc.voices || []).length ? svc.voices : []
  const inst = svc.instruments || []
  return h('div', { class: 'roles-view' },
    h('h3', {}, t('roles')),
    svc.subtitle ? h('div', { class: 'role-line' }, h('span', { class: 'role-k' }, t('subtitle') + ' '), svc.subtitle) : null,
    h('div', { class: 'role-line' }, h('span', { class: 'role-k' }, t('leader') + ' '), svc.leader || ''),
    h('div', { class: 'role-line' },
      h('div', { class: 'role-k' }, t('voices')),
      voices.length
        ? h('ul', {}, ...voices.map((v) => h('li', {}, v)))
        : h('div', {}, '')
    ),
    h('div', { class: 'role-line' },
      h('div', { class: 'role-k' }, t('instruments')),
      h('ul', {}, ...inst.map((i) => h('li', {}, `${i.name}${i.player ? ': ' + i.player : ':'}`)))
    ),
    h('div', { class: 'role-line' }, h('span', { class: 'role-k' }, t('ujier') + ' '), svc.ujier || '')
  )
}
