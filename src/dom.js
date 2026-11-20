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
