import { h } from '../dom.js'
import {
  cardTheme, scheduleHeader, monthLabel, shiftMonth, currentMonth,
  servicesForMonth, monthGrid, todayIso, servicesOnDate
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

export function renderMonthCalendar({ month, services, weekdays, today, onDay }) {
  const cells = monthGrid(month)
  const todayVal = today || todayIso()
  return h('div', { class: 'cal' },
    h('div', { class: 'cal-weekdays' },
      ...weekdays.map((w) => h('span', {}, w))
    ),
    h('div', { class: 'cal-grid', role: 'grid' },
      ...cells.map((cell) => {
        const list = servicesOnDate(services, cell.iso)
        const isToday = cell.iso === todayVal
        const labelParts = [cell.iso, ...list.map((s) => [s.subtitle || s.name, s.leader].filter(Boolean).join(', '))]
        return h('button', {
          type: 'button',
          class: 'cal-cell' + (cell.inMonth ? '' : ' is-out') + (isToday ? ' is-today' : '') + (list.length ? ' has-svc' : ''),
          'data-date': cell.iso,
          'aria-label': labelParts.filter(Boolean).join('. '),
          'aria-current': isToday ? 'date' : undefined,
          onclick: onDay ? () => onDay(cell.iso, list) : null
        },
          h('span', { class: 'cal-num' }, String(cell.day)),
          h('span', { class: 'cal-chips' },
            ...list.map((svc) => {
              const theme = cardTheme(svc)
              const title = svc.subtitle || svc.name || ''
              return h('span', {
                class: 'cal-chip',
                style: { background: theme.bg, color: theme.ink, borderColor: theme.accent }
              },
                title ? h('span', { class: 'cal-chip-name' }, title) : null,
                svc.leader ? h('span', { class: 'cal-chip-lead' }, svc.leader) : (!title ? '·' : null)
              )
            })
          )
        )
      })
    )
  )
}

export { currentMonth, shiftMonth, monthLabel, servicesForMonth, servicesOnDate, todayIso, monthGrid }
