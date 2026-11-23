import { test, expect } from '@playwright/test'

async function waitSongs(page) {
  await page.goto('./#/songs', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-field="search-songs"]')).toBeVisible({ timeout: 20_000 })
}

test('search is accent-insensitive and keeps focus while typing', async ({ page }) => {
  await waitSongs(page)
  const search = page.locator('[data-field="search-songs"]')
  await search.click()
  await search.evaluate((el) => { el.__focusProbe = 1 })
  await page.keyboard.type('senor', { delay: 20 })
  await expect(search).toHaveValue('senor')
  expect(await page.evaluate(() => document.activeElement && document.activeElement.__focusProbe === 1)).toBe(true)
  await expect(page.getByText(/El Señor está en este lugar/i).first()).toBeVisible()
  await expect(page.getByText(/Eres Se[nñ]or/i).first()).toBeVisible()
  await expect(page.locator('.list-count')).toContainText(/match/i)
})

test('empty search results show a clear message', async ({ page }) => {
  await waitSongs(page)
  const search = page.locator('[data-field="search-songs"]')
  await search.click()
  await page.keyboard.type('zzzqqqnotasong', { delay: 10 })
  await expect(page.locator('.empty')).toContainText(/No songs match|Ninguna canción coincide/)
  await expect(page.locator('.list-count')).toContainText(/No matches|Sin resultados/)
  await expect(page.locator('.search-results .card.clickable')).toHaveCount(0)
})

test('both languages are visible side by side on a bilingual song', async ({ page }) => {
  await waitSongs(page)
  await page.goto('./#/songs/song-al-que-esta-sentado-en-trono-i-want-to-know-you')
  await expect(page.getByRole('heading', { name: /Al que está sentado en el trono/i, level: 2 })).toBeVisible({ timeout: 15_000 })
  const both = page.getByRole('button', { name: /Both|Ambos/ })
  if (await both.count()) await both.click()
  await expect(page.locator('.lang-tag', { hasText: 'ES' })).toBeVisible()
  await expect(page.locator('.lang-tag', { hasText: 'EN' })).toBeVisible()
  await expect(page.getByText('Quiero conocerte').first()).toBeVisible()
  await expect(page.getByText(/I want to know you/i).first()).toBeVisible()
  const side = page.locator('.side-by-side')
  await expect(side).toBeVisible()
  const box = await side.boundingBox()
  expect(box?.width || 0).toBeGreaterThan(200)
})

test('songs without a key do not pretend they are in C', async ({ page }) => {
  await waitSongs(page)
  await page.goto('./#/songs/song-alto-sublime')
  await expect(page.getByRole('heading', { name: /A el alto y sublime/i, level: 2 })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('#cur-key')).toHaveText(/No key listed|Sin tono/)
  await expect(page.locator('.no-key-hint')).toBeVisible()
  await expect(page.locator('.key-chip.on')).toHaveCount(0)
  await page.getByRole('button', { name: 'G', exact: true }).click()
  await expect(page.locator('#cur-key')).toHaveText('G')
  await page.getByRole('button', { name: /Original key|Tono original/ }).click()
  await expect(page.locator('#cur-key')).toHaveText(/No key listed|Sin tono/)
})

test('list meta does not say Key No key listed and hides lyric-like artists', async ({ page }) => {
  await waitSongs(page)
  await expect(page.getByText(/Key No key listed/)).toHaveCount(0)
  await expect(page.getByText(/No key listed|Sin tono/).first()).toBeVisible()
  await expect(page.getByText('the power of the name of Jesus')).toHaveCount(0)
})

test('transpose updates the label and reset restores the original key', async ({ page }) => {
  await waitSongs(page)
  await page.goto('./#/songs/song-cristo-yo-te-amo')
  await expect(page.locator('#cur-key')).toHaveText('F', { timeout: 15_000 })
  await page.getByRole('button', { name: 'G', exact: true }).click()
  await expect(page.locator('#cur-key')).toHaveText('G')
  await expect(page.locator('.key-chip.on')).toHaveText('G')
  await page.getByRole('button', { name: /Original key|Tono original/ }).click()
  await expect(page.locator('#cur-key')).toHaveText('F')
  await expect(page.locator('.key-chip.on')).toHaveText('F')
})

test('unknown song shows a friendly not-found state', async ({ page }) => {
  await page.goto('./#/songs/this-song-does-not-exist')
  await expect(page.getByRole('heading', { name: /Song not found|Canción no encontrada/, level: 2 })).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: /Back to songs|Volver a canciones/ }).click()
  await expect(page.locator('[data-field="search-songs"]')).toBeVisible()
})

test('song list and a song view still work offline without a session', async ({ page, context }) => {
  await waitSongs(page)
  await expect(page.locator('.search-results .card.clickable').first()).toBeVisible({ timeout: 15_000 })
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
        setTimeout(resolve, 2000)
      })
    }
    return reg?.active?.state || null
  })
  await page.waitForTimeout(400)
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-field="search-songs"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.search-results .card.clickable').first()).toBeVisible()
  await page.locator('.search-results .card.clickable').first().click()
  await expect(page.locator('.song-view h2, .page-head h2').first()).toBeVisible()
  await context.setOffline(false)
})

test('long lyric lines wrap inside the song view', async ({ page }) => {
  await waitSongs(page)
  await page.goto('./#/songs/song-al-que-esta-sentado-en-trono-i-want-to-know-you')
  await expect(page.getByText(/Entrar en tu Presencia y adorar/i).first()).toBeVisible({ timeout: 15_000 })
  const overflow = await page.evaluate(() => {
    const root = document.querySelector('.lyrics, .lyrics-host')
    if (!root) return { missing: true }
    const max = root.getBoundingClientRect().width
    const wide = [...root.querySelectorAll('.lyric-line, .lyric-row, .chord-pair')]
      .some((el) => el.scrollWidth > max + 2 && getComputedStyle(el).overflowX === 'visible')
    return { max, overflowVisible: wide }
  })
  expect(overflow.missing, 'lyrics should be on the page').toBeFalsy()
  expect(overflow.overflowVisible).toBeFalsy()
})
