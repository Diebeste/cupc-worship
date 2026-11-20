import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const examples = path.resolve(__dirname, '../public/examples')
const shots = path.resolve(__dirname, '../screenshots')

async function waitReady(page) {
  await page.goto('./#/services')
  await expect(page.getByText('15/11', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
}

test.beforeAll(async () => {
  const fs = await import('fs')
  fs.mkdirSync(shots, { recursive: true })
})

test('seeded services and songs, EN/ES UI, screenshots', async ({ page }) => {
  await waitReady(page)
  await expect(page.getByText('Semana de alabanza — Jueves Acústico')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '01-services.png'), fullPage: true })

  await page.getByRole('link', { name: 'Songs' }).or(page.getByRole('link', { name: 'Canciones' })).first().click()
  // bottom nav might just be the hash via click on 🎵
  await page.goto('./#/songs')
  await expect(page.getByText('Cristo yo te amo')).toBeVisible()
  await expect(page.getByText('Al estar ante ti')).toBeVisible()
  await expect(page.getByText('Believe for it')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '02-songs.png'), fullPage: true })

  await page.getByPlaceholder(/Search titles or lyrics|Buscar título/).fill('imparable')
  await expect(page.getByText('Dios imparable')).toBeVisible()
  await expect(page.getByText('Cristo yo te amo')).toHaveCount(0)

  // UI language toggle
  await page.getByRole('button', { name: 'ES', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Canciones', level: 2 })).toBeVisible()
  await page.screenshot({ path: path.join(shots, '03-songs-es.png'), fullPage: true })
  await page.getByRole('button', { name: 'EN', exact: true }).click()
})

test('open a song, transpose, toggle EN/ES lyrics', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/songs')
  await page.getByText('Cristo yo te amo').click()
  await expect(page.getByText('Cristo, yo te amo').first()).toBeVisible()
  await expect(page.getByText('Jesus how I love you').first()).toBeVisible()
  await page.screenshot({ path: path.join(shots, '04-song-both.png'), fullPage: true })

  await page.getByRole('button', { name: 'ES', exact: true }).nth(1).click() // lyric lang, not UI
  // There are two ES buttons (UI + lyrics). Safer:
  await page.goto('./#/songs/song-cristo-yo-te-amo')
  await expect(page.getByText('Cristo, yo te amo').first()).toBeVisible()
  const lyricSeg = page.locator('.seg').first()
  await lyricSeg.getByRole('button', { name: 'ES' }).click()
  await expect(page.getByText('Cristo, yo te amo').first()).toBeVisible()
  await expect(page.getByText('Jesus how I love you')).toHaveCount(0)
  await lyricSeg.getByRole('button', { name: 'EN' }).click()
  await expect(page.getByText('Jesus how I love you').first()).toBeVisible()
  await expect(page.getByText('Cristo, yo te amo')).toHaveCount(0)
  await lyricSeg.getByRole('button', { name: 'Both' }).click()

  await page.getByRole('button', { name: 'G', exact: true }).click()
  await expect(page.locator('#cur-key')).toHaveText('G')
  await expect(page.getByText(/Capo/)).toBeVisible()
  await page.screenshot({ path: path.join(shots, '05-song-transpose.png'), fullPage: true })
})

test('create a song by paste', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/songs/new')
  await page.getByPlaceholder('Untitled song').or(page.locator('input').first()).fill('How Great Is Our God')
  const paste = page.getByPlaceholder(/Paste a song or a whole setlist/)
  await paste.fill(`How Great Is Our God (C)

The splendor of the King
Clothed in majesty
Let all the earth rejoice

Chorus
How great is our God
Sing with me

-----

La esplendor del Rey
Vestido en majestad

Coro
Cuan grande es Dios
`)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'How Great Is Our God', level: 2 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('The splendor of the King')).toBeVisible()
  await expect(page.getByText('Cuan grande es Dios')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '06-new-song-paste.png'), fullPage: true })
})

test('import the two example PDFs', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/import')
  const input = page.locator('input[type=file]')
  await input.setInputFiles([
    path.join(examples, '15-11-service.pdf'),
    path.join(examples, 'semana-de-alabanza-jueves.pdf')
  ])
  await expect(page.getByText(/Import \d+ song/)).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: path.join(shots, '07-import-preview.png'), fullPage: true })
  // Should see well-known titles from both docs
  await expect(page.getByText('Cristo yo te amo').first()).toBeVisible()
  await expect(page.getByText(/Al estar ante ti/i).first()).toBeVisible()
  await page.getByRole('button', { name: /Import \d+ song/ }).click()
  await expect(page).toHaveURL(/#\/songs/)
  // imported copies exist (may be duplicates of seeded titles)
  await expect(page.getByText('Cristo yo te amo').first()).toBeVisible()
})

test('create and duplicate a service, open stage view', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/services/new')
  await page.getByPlaceholder('Untitled service').or(page.locator('input').first()).fill('Ad hoc Friday')
  await page.getByRole('button', { name: '+ Add song' }).click()
  await page.getByText('Cristo yo te amo').first().click()
  await page.getByRole('button', { name: '+ Add song' }).click()
  await page.getByText('Entra en la presencia').first().click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Ad hoc Friday', level: 2 })).toBeVisible()
  await expect(page.getByText('Cristo yo te amo')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '08-new-service.png'), fullPage: true })

  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(page.getByPlaceholder('Untitled service').or(page.locator('input').first())).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Ad hoc Friday (copy)', level: 2 })).toBeVisible()

  await page.getByRole('button', { name: 'Stage view' }).click()
  await expect(page.getByText('Cristo yo te amo')).toBeVisible()
  await expect(page.getByText('Keeping screen awake')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '09-stage.png'), fullPage: true })
  await page.getByRole('button', { name: /Next/ }).click()
  await expect(page.getByRole('heading', { name: 'Entra en la presencia' }).first()).toBeVisible()
  await page.locator('.stage-top button').first().click() // close
})

test('copy WhatsApp text and open print view', async ({ page }) => {
  await waitReady(page)
  await page.goto('./#/services/service-15-11')
  await expect(page.getByRole('heading', { name: '15/11', level: 2 })).toBeVisible()
  await page.getByRole('button', { name: 'WhatsApp text' }).click()
  await expect(page.getByText('Copied')).toBeVisible()
  await page.getByRole('button', { name: 'Print / PDF' }).click()
  await expect(page.getByRole('heading', { name: '15/11' }).first()).toBeVisible()
  await expect(page.locator('table')).toBeVisible()
  await expect(page.getByText('Cristo yo te amo').first()).toBeVisible()
  await page.screenshot({ path: path.join(shots, '10-print.png'), fullPage: true })
})

test('offline reload still shows seeded data', async ({ page, context }) => {
  await waitReady(page)
  // Give the service worker a moment to claim
  await page.waitForTimeout(1500)
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText('15/11', { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Semana de alabanza — Jueves Acústico')).toBeVisible()
  await page.screenshot({ path: path.join(shots, '11-offline.png'), fullPage: true })
  await context.setOffline(false)
})
