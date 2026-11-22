export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v)
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'html') el.innerHTML = v
    else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'value') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue
    el.append(c.nodeType ? c : document.createTextNode(c))
  }
  return el
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild)
  return el
}

export function parseHash() {
  const raw = (location.hash || '#/').replace(/^#/, '')
  const [pathPart, queryPart] = raw.split('?')
  const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''))
  const parts = path.split('/').filter(Boolean)
  return { path, parts, query }
}

export function go(to, { replace = false } = {}) {
  const hash = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
  if (replace) location.replace(hash)
  else location.hash = hash
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function replaceHashSilent(to) {
  const hash = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
  if (location.hash === hash) return
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`)
}

export function isEditableFocus(el = document.activeElement) {
  return !!(el && el !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.readOnly)
}

export function captureFocusedField(root = document) {
  const ae = document.activeElement
  if (!isEditableFocus(ae)) return null
  if (root && !root.contains(ae)) return null
  const all = [...root.querySelectorAll('input, textarea, select')]
  return {
    index: all.indexOf(ae),
    field: ae.getAttribute('data-field') || '',
    tag: ae.tagName,
    type: ae.type || '',
    className: String(ae.className || ''),
    placeholder: ae.placeholder || '',
    name: ae.name || '',
    id: ae.id || '',
    value: (ae.type === 'checkbox' || ae.type === 'radio') ? null : ae.value,
    checked: (ae.type === 'checkbox' || ae.type === 'radio') ? ae.checked : null,
    start: ae.selectionStart,
    end: ae.selectionEnd
  }
}

export function restoreFocusedField(root, saved) {
  if (!saved || !root) return
  const all = [...root.querySelectorAll('input, textarea, select')]
  let el = saved.field ? all.find((c) => c.getAttribute('data-field') === saved.field) : null
  if (!el) {
    el = all.find((c) =>
      c.tagName === saved.tag &&
      (c.type || '') === saved.type &&
      String(c.className || '') === saved.className &&
      (c.placeholder || '') === saved.placeholder &&
      (c.name || '') === saved.name &&
      (c.id || '') === saved.id
    )
  }
  if (!el && saved.index >= 0 && all[saved.index] && all[saved.index].tagName === saved.tag) el = all[saved.index]
  if (!el) return
  if (saved.checked != null) el.checked = saved.checked
  else if (saved.value != null && el.type !== 'file') el.value = saved.value
  el.focus()
  try {
    if (typeof saved.start === 'number' && typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(saved.start, saved.end)
    }
  } catch { /* some input types do not support a selection range */ }
}
