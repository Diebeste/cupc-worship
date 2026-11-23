import { test, expect } from '@playwright/test'

const PHRASE = 'hello world team'

const FIELDS = [
  { hash: '#/songs', sel: '[data-field="search-songs"]' },
  { hash: '#/songs/new', sel: '[data-field="song-title"]' },
  { hash: '#/songs/new', sel: '[data-field="song-artist"]' },
  { hash: '#/songs/new', sel: '[data-field="song-notes"]' },
  { hash: '#/songs/new', sel: '[data-field="song-paste"]' },
  { hash: '#/songs/new', sel: '[data-field="song-lyrics-es"]' },
  { hash: '#/songs/new', sel: '[data-field="song-lyrics-en"]' },
  { hash: '#/services', sel: '[data-field="search-services"]' },
  { hash: '#/services/new', sel: '[data-field="service-name"]' },
  { hash: '#/services/new', sel: '[data-field="service-notes"]' },
  { hash: '#/services/new', sel: '[data-field="service-leader"]' },
  { hash: '#/services/new', sel: '[data-field="service-ujier"]' },
  { hash: '#/services/new', sel: '[data-field="service-add-voice"]' },
  { hash: '#/services/new', sel: '[data-field="service-subtitle"]' },
  { hash: '#/services/new', sel: '[data-field="instrument-player"]' },
  { hash: '#/schedule?month=2026-11', sel: '[data-field="sched-practice"]' },
  { hash: '#/schedule?month=2026-11', sel: '[data-field="sched-banner"]' },
  { hash: '#/settings', sel: '[data-field="settings-name"]' },
  { hash: '#/settings', sel: '[data-field="settings-join"]' },
  { hash: '#/settings', sel: '[data-field="settings-editor"]' },
  { hash: '#/settings', sel: '[data-field="settings-email"]' },
  { hash: '#/settings', sel: '[data-field="settings-url"]', openAdvanced: true },
  { hash: '#/import', sel: '[data-field="import-paste"]' }
]

async function waitReady(page) {
  await page.goto('./#/services')
  await expect(page.getByRole('heading', { name: /Services|Servicios/ }).first()).toBeVisible({ timeout: 20_000 })
}

async function typeAndStay(page, sel, text, { openAdvanced = false } = {}) {
  if (openAdvanced) {
    const details = page.locator('details.advanced-sync')
    await expect(details).toBeVisible()
    await details.locator('summary').click()
  }
  const loc = page.locator(sel).first()
  await expect(loc).toBeVisible()
  await loc.evaluate((el) => { el.value = '' })
  await loc.click()
  await loc.evaluate((el) => { el.__focusProbe = 1 })
  await page.keyboard.type(text, { delay: 20 })
  await expect(loc).toHaveValue(text)
  const ok = await page.evaluate(() => document.activeElement && document.activeElement.__focusProbe === 1)
  expect(ok, `document.activeElement changed while typing in ${sel}`).toBe(true)
}

async function typeAllMajorFields(page) {
  let lastHash = ''
  for (const field of FIELDS) {
    if (field.hash !== lastHash) {
      await page.goto('./' + field.hash)
      lastHash = field.hash
      await expect(page.locator('.page, .app-shell').first()).toBeVisible()
    }
    await typeAndStay(page, field.sel, PHRASE, { openAdvanced: !!field.openAdvanced })
  }
}

test('types a multi-word string into each major field without losing focus', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/settings')
  await expect(page.locator('.build-stamp')).toContainText('cupc-worship-v9')
  await typeAllMajorFields(page)
})

const SUPA = /jpiwwwzozivkdgajiltm\.supabase\.co/
const USER_ID = '11111111-1111-1111-1111-111111111111'
const TEAM_ID = '50b2b04b-3657-47c3-8b99-d8fab258a119'

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Content-Type': 'application/json'
  }
}

function fakeJwt(payload) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`
}

function makeSession() {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'teammate@church.org',
    is_anonymous: false,
    user_metadata: { display_name: 'Teammate' },
    app_metadata: { provider: 'email' }
  }
  const access_token = fakeJwt({
    sub: USER_ID,
    role: 'authenticated',
    aud: 'authenticated',
    exp: now + 3600,
    iat: now,
    email: user.email
  })
  return {
    access_token,
    refresh_token: 'refresh',
    expires_in: 3600,
    expires_at: now + 3600,
    token_type: 'bearer',
    user
  }
}

async function mockSignedInSync(page, session) {
  await page.route(SUPA, async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })
    if (url.includes('/auth/v1/user') || url.includes('/auth/v1/session')) {
      return route.fulfill({ status: 200, json: session.user, headers: cors() })
    }
    if (url.includes('/auth/v1/token')) {
      return route.fulfill({ status: 200, json: session, headers: cors() })
    }
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        json: [{ id: USER_ID, team_id: TEAM_ID, role: 'admin', can_edit: true, display_name: 'Teammate' }],
        headers: cors()
      })
    }
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: 200, json: [], headers: cors() })
    return route.fulfill({ status: 200, json: {}, headers: cors() })
  })
}

test('keeps focus while typing under a mocked signed-in sync session', async ({ page }) => {
  const session = makeSession()
  await page.addInitScript((sess) => {
    localStorage.setItem('sb-jpiwwwzozivkdgajiltm-auth-token', JSON.stringify(sess))
  }, session)
  await mockSignedInSync(page, session)
  await waitReady(page)

  await page.goto('./#/songs')
  await typeAndStay(page, '[data-field="search-songs"]', 'hello ')
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')))
  await page.keyboard.type('world team', { delay: 20 })
  const search = page.locator('[data-field="search-songs"]').first()
  await expect(search).toHaveValue(PHRASE)
  expect(await page.evaluate(() => document.activeElement && document.activeElement.__focusProbe === 1)).toBe(true)

  await page.goto('./#/songs/new')
  await typeAndStay(page, '[data-field="song-title"]', 'hello ')
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')))
  await page.keyboard.type('world team', { delay: 20 })
  await expect(page.locator('[data-field="song-title"]').first()).toHaveValue(PHRASE)
  expect(await page.evaluate(() => document.activeElement && document.activeElement.__focusProbe === 1)).toBe(true)

  await page.goto('./#/settings')
  await typeAndStay(page, '[data-field="settings-name"]', 'hello ')
  await page.evaluate(() => window.dispatchEvent(new HashChangeEvent('hashchange')))
  await page.keyboard.type('world team', { delay: 20 })
  await expect(page.locator('[data-field="settings-name"]').first()).toHaveValue(PHRASE)
  expect(await page.evaluate(() => document.activeElement && document.activeElement.__focusProbe === 1)).toBe(true)

  await typeAllMajorFields(page)
})
