import { test, expect } from '@playwright/test'

const SUPA = /jpiwwwzozivkdgajiltm\.supabase\.co/
const TEAM_ID = '50b2b04b-3657-47c3-8b99-d8fab258a119'
const USER_ID = '11111111-1111-1111-1111-111111111111'
const FRIENDLY = 'Sign in first with the magic link, then try Join team again.'

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

function makeSession({ anonymous = true, email = '' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const user = {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    is_anonymous: anonymous,
    user_metadata: { display_name: 'Kathy' },
    app_metadata: { provider: 'anonymous' }
  }
  const access_token = fakeJwt({
    sub: USER_ID,
    role: 'authenticated',
    aud: 'authenticated',
    exp: now + 3600,
    iat: now,
    is_anonymous: anonymous,
    email
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

async function mockSupabase(page, { session, profile, delayJoinMs = 0, denyJoinWithoutAuth = true } = {}) {
  const calls = { join: 0, signup: 0, claim: 0, profiles: 0 }
  let currentSession = session || null
  let currentProfile = profile || null

  await page.route(SUPA, async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })

    const authHeader = req.headers()['authorization'] || ''
    const hasUserJwt = /Bearer eyJ/.test(authHeader) && !authHeader.includes('anon')
    // anon key is also a JWT; treat as signed-in only if we have a current session and the token matches it
    const signedIn = !!(currentSession && authHeader.includes(currentSession.access_token))

    if (url.includes('/auth/v1/signup') && method === 'POST') {
      calls.signup++
      const sess = currentSession || makeSession()
      currentSession = sess
      return route.fulfill({ status: 200, json: { access_token: sess.access_token, refresh_token: sess.refresh_token, expires_in: 3600, expires_at: sess.expires_at, token_type: 'bearer', user: sess.user }, headers: cors() })
    }
    if (url.includes('/auth/v1/user') || url.includes('/auth/v1/session')) {
      if (!currentSession) return route.fulfill({ status: 401, json: { message: 'No session' }, headers: cors() })
      return route.fulfill({ status: 200, json: currentSession.user, headers: cors() })
    }
    if (url.includes('/auth/v1/token')) {
      if (!currentSession) return route.fulfill({ status: 401, json: { error: 'invalid_grant' }, headers: cors() })
      return route.fulfill({ status: 200, json: currentSession, headers: cors() })
    }
    if (url.includes('/rest/v1/rpc/join_team_with_code')) {
      calls.join++
      if (delayJoinMs) await new Promise((r) => setTimeout(r, delayJoinMs))
      if (!signedIn && denyJoinWithoutAuth) {
        return route.fulfill({
          status: 401,
          json: { message: 'permission denied for function join_team_with_code', code: '42501' },
          headers: cors()
        })
      }
      currentProfile = {
        id: USER_ID,
        team_id: TEAM_ID,
        role: 'member',
        can_edit: false,
        display_name: 'Kathy'
      }
      return route.fulfill({ status: 200, json: { team_id: TEAM_ID, role: 'member', can_edit: false }, headers: cors() })
    }
    if (url.includes('/rest/v1/rpc/claim_editor_code')) {
      calls.claim++
      return route.fulfill({ status: 200, json: { team_id: TEAM_ID, role: 'member', can_edit: true }, headers: cors() })
    }
    if (url.includes('/rest/v1/profiles')) {
      calls.profiles++
      if (!currentProfile) return route.fulfill({ status: 200, json: [], headers: cors() })
      return route.fulfill({ status: 200, json: [currentProfile], headers: cors() })
    }
    if (url.includes('/rest/v1/rpc/team_admin_state')) {
      return route.fulfill({ status: 200, json: { team_id: TEAM_ID, name: 'CUPC Mississauga Worship', join_code: 'CUPC-ALABANZA', has_editor_code: true }, headers: cors() })
    }
    if (url.includes('/rest/v1/rpc/list_team_members')) {
      return route.fulfill({ status: 200, json: [], headers: cors() })
    }
    if (/\/rest\/v1\/(songs|services|members|schedule_meta)/.test(url)) {
      return route.fulfill({ status: 200, json: [], headers: cors() })
    }
    return route.fulfill({ status: 200, json: {}, headers: cors() })
  })
  return calls
}

async function waitReady(page) {
  await page.goto('./#/settings')
  await expect(page.getByRole('heading', { name: /Settings|Ajustes/ }).first()).toBeVisible({ timeout: 20_000 })
}

test('join without a session signs in anonymously then joins once', async ({ page }) => {
  const calls = await mockSupabase(page, { session: null, profile: null, delayJoinMs: 400 })
  await waitReady(page)
  await page.getByPlaceholder('Your name').or(page.getByPlaceholder('Tu nombre')).fill('Kathy')
  const joinBtn = page.getByRole('button', { name: /^Join team$|^Unirse$/ })
  await joinBtn.click()
  await joinBtn.click() // double tap must not fire a second RPC
  await expect(page.getByText("You're in CUPC Mississauga Worship (member)").or(page.getByText(/Estás en CUPC Mississauga Worship/))).toBeVisible({ timeout: 15_000 })
  expect(calls.signup).toBe(1)
  expect(calls.join).toBe(1)
  await expect(page.getByText('permission denied')).toHaveCount(0)
})

test('already on a team skips the join RPC and shows membership', async ({ page }) => {
  const session = makeSession()
  const profile = { id: USER_ID, team_id: TEAM_ID, role: 'admin', can_edit: true, display_name: 'Brandon' }
  await page.addInitScript((sess) => {
    localStorage.setItem('sb-jpiwwwzozivkdgajiltm-auth-token', JSON.stringify(sess))
  }, session)
  const calls = await mockSupabase(page, { session, profile })
  await waitReady(page)
  await expect(page.locator('.team-membership')).toContainText("You're in CUPC Mississauga Worship (admin)", { timeout: 15_000 })
  await page.getByRole('button', { name: /^Join team$|^Unirse$/ }).click()
  await expect(page.locator('.team-membership')).toContainText("You're in CUPC Mississauga Worship (admin)")
  await expect(page.getByText('permission denied')).toHaveCount(0)
  expect(calls.join).toBe(0)
  expect(calls.signup).toBe(0)
})

test('permission-denied style errors show a friendly toast, not raw Postgres', async ({ page }) => {
  // Force a signed-in client that still gets 42501 from the RPC (legacy race)
  const session = makeSession()
  await page.addInitScript((sess) => {
    localStorage.setItem('sb-jpiwwwzozivkdgajiltm-auth-token', JSON.stringify(sess))
  }, session)
  await mockSupabase(page, { session, profile: null, denyJoinWithoutAuth: true })
  // Override join to always return permission denied even when signed in
  await page.unroute(SUPA)
  const calls = { join: 0 }
  await page.route(SUPA, async (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })
    if (url.includes('/rest/v1/rpc/join_team_with_code')) {
      calls.join++
      return route.fulfill({ status: 401, json: { message: 'permission denied for function join_team_with_code', code: '42501' }, headers: cors() })
    }
    if (url.includes('/rest/v1/profiles')) return route.fulfill({ status: 200, json: [], headers: cors() })
    if (url.includes('/auth/v1/user')) return route.fulfill({ status: 200, json: session.user, headers: cors() })
    if (url.includes('/auth/v1/token')) return route.fulfill({ status: 200, json: session, headers: cors() })
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: 200, json: [], headers: cors() })
    return route.fulfill({ status: 200, json: {}, headers: cors() })
  })
  await waitReady(page)
  await page.getByRole('button', { name: /^Join team$|^Unirse$/ }).click()
  await expect(page.locator('.toast')).toBeVisible()
  await expect(page.locator('.toast')).toHaveText(FRIENDLY)
  await expect(page.getByText('permission denied for function')).toHaveCount(0)
})
