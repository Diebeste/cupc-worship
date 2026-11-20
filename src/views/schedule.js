import { h } from '../dom.js'
import {
  cardTheme, scheduleHeader, monthLabel, shiftMonth, currentMonth,
  servicesForMonth
} from '../data/roles.js'

export function renderScheduleCard(svc, { onOpen } = {}) {
  const theme = cardTheme(svc)
  const header = scheduleHeader(svc.date) || svc.name || '—'
  const voices = (svc.voices || []).length ? svc.voices : []
  const inst = svc.instruments || []
  const card = h('article', {
    class: 'sched-card',
    style: { background: theme.bg, borderColor: theme.accent, color: theme.ink },
    onclick: onOpen ? () => onOpen(svc) : null
  },
    h('h3', {}, header),
    svc.subtitle ? h('div', { class: 'sched-sub' }, `(${svc.subtitle})`) : null,
    h('div', { class: 'sched-k' }, 'Leader'),
    h('div', { class: 'sched-v' }, svc.leader || ''),
    h('div', { class: 'sched-k' }, 'Voices'),
    h('div', { class: 'sched-v' },
      voices.length ? h('ul', {}, ...voices.map((v) => h('li', {}, v))) : ''
    ),
    h('div', { class: 'sched-k' }, 'Instrumentos'),
    h('div', { class: 'sched-v' },
      h('ul', {}, ...inst.map((i) => h('li', {}, `${i.name}${i.player ? ': ' + i.player : ':'}`)))
    ),
    h('div', { class: 'sched-k' }, 'Ujier'),
    h('div', { class: 'sched-v' }, svc.ujier || '')
  )
  return card
}

export function buildPoster(svcList, { month, practiceNotes, banner }) {
  const poster = h('div', { class: 'sched-poster', id: 'schedule-poster' },
    h('div', { class: 'sched-title' }, monthLabel(month, 'en')),
    h('div', { class: 'sched-poster-head' },
      practiceNotes ? h('div', { class: 'sched-practice' }, practiceNotes) : null,
      banner ? h('div', { class: 'banner-pill' }, banner) : null
    ),
    h('div', { class: 'sched-grid' },
      ...svcList.map((s) => renderScheduleCard(s))
    )
  )
  return poster
}

export { currentMonth, shiftMonth, monthLabel, servicesForMonth }
