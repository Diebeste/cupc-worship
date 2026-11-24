import { test, expect } from '@playwright/test'

const BILINGUAL = `Formatter Test Song (C)

Verse 1
The splendor of the King
Clothed in majesty
Let all the earth rejoice

Chorus
How great is our God
Sing with me

-----

Estrofa 1
El esplendor del Rey
Vestido en majestad

Coro
Cuan grande es Dios
Canta conmigo
`

async function openNewSong(page) {
  await page.goto('./#/songs/new', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-field="song-title"]')).toBeVisible({ timeout: 20_000 })
}

async function pasteInto(locator, text) {
  await locator.click()
  await locator.evaluate((el, value) => {
    el.focus()
    el.value = ''
    const data = new DataTransfer()
    data.setData('text/plain', value)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    if (!el.value) el.value = value
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
}

test('paste on a new song shows a format preview that can be accepted or undone', async ({ page }) => {
  await openNewSong(page)
  const paste = page.locator('[data-field="song-paste"]')
  await pasteInto(paste, BILINGUAL)
  const preview = page.locator('[data-field="format-preview"]')
  await expect(preview).toBeVisible({ timeout: 10_000 })
  await expect(preview.getByText(/Formatted preview|Vista previa formateada/)).toBeVisible()
  await expect(preview.getByText(/The splendor of the King/)).toBeVisible()
  await expect(preview.getByText(/El esplendor del Rey/)).toBeVisible()
  await expect(preview.getByText(/Chorus/)).toBeVisible()

  await page.locator('[data-field="format-undo"]').click()
  await expect(preview).toBeHidden()
  await expect(page.locator('[data-field="song-lyrics-es"]')).toHaveValue('')
  await expect(page.locator('[data-field="song-lyrics-en"]')).toHaveValue('')
  await expect(paste).toHaveValue(/The splendor of the King/)

  await pasteInto(paste, BILINGUAL)
  await expect(preview).toBeVisible()
  await page.locator('[data-field="format-accept"]').click()
  await expect(preview).toBeHidden()
  await expect(page.locator('[data-field="song-lyrics-en"]')).toHaveValue(/The splendor of the King/)
  await expect(page.locator('[data-field="song-lyrics-es"]')).toHaveValue(/El esplendor del Rey/)
  await expect(page.locator('[data-field="song-title"]')).toHaveValue(/Formatter Test Song/i)

  await page.getByRole('button', { name: /Save|Guardar/ }).click()
  await expect(page.getByRole('heading', { name: /Formatter Test Song/i, level: 2 })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.lang-tag', { hasText: 'EN' }).first()).toBeVisible()
  await expect(page.locator('.lang-tag', { hasText: 'ES' }).first()).toBeVisible()
  await expect(page.getByText('The splendor of the King').first()).toBeVisible()
  await expect(page.getByText('El esplendor del Rey').first()).toBeVisible()
})

test('Format button standardizes typed lyrics and Undo restores them', async ({ page }) => {
  await openNewSong(page)
  await page.locator('[data-field="song-title"]').fill('Typed Song')
  const en = page.locator('[data-field="song-lyrics-en"]')
  await en.fill('verse 1\nThe splendor of the King\n\n\nchorus 2x\nHow great is our God\n')
  await page.locator('[data-field="format-lyrics"]').click()
  const preview = page.locator('[data-field="format-preview"]')
  await expect(preview).toBeVisible()
  await expect(preview.getByText(/Chorus/)).toBeVisible()
  await expect(preview.getByText(/The splendor of the King/)).toBeVisible()
  await page.locator('[data-field="format-accept"]').click()
  await expect(en).toHaveValue(/Verse 1|Chorus/)
  const formatted = await en.inputValue()
  await en.fill('verse 1\nThe splendor of the King\n\n\nchorus 2x\nHow great is our God\n')
  await page.locator('[data-field="format-lyrics"]').click()
  await expect(preview).toBeVisible()
  await page.locator('[data-field="format-undo"]').click()
  await expect(en).toHaveValue(/chorus 2x/)
  expect(await en.inputValue()).not.toEqual(formatted)
})

test('import paste shows a format summary and saves language boxes', async ({ page }) => {
  await page.goto('./#/import', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-field="import-paste"]')).toBeVisible({ timeout: 20_000 })
  await page.locator('[data-field="import-paste"]').fill(BILINGUAL)
  await page.getByRole('button', { name: /Preview|Vista previa/ }).click()
  await expect(page.locator('[data-field="import-format-summary"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-field="import-format-summary"]')).toContainText(/reformatted to the library format|reformateada/)
  await expect(page.getByText(/Formatter Test Song/i).first()).toBeVisible()
  await page.getByRole('button', { name: /Import 1 song|Importar 1/ }).click()
  await expect(page).toHaveURL(/#\/songs/)
  await page.locator('[data-field="search-songs"]').fill('Formatter Test Song')
  await page.getByText(/Formatter Test Song/i).first().click()
  await expect(page.getByRole('heading', { name: /Formatter Test Song/i, level: 2 })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.lang-tag', { hasText: 'EN' }).first()).toBeVisible()
  await expect(page.locator('.lang-tag', { hasText: 'ES' }).first()).toBeVisible()
  await expect(page.getByText('The splendor of the King').first()).toBeVisible()
  await expect(page.getByText('El esplendor del Rey').first()).toBeVisible()
})

test('restoring a JSON backup does not reformat already-saved songs', async ({ page }) => {
  const backup = {
    version: 2,
    app: 'cupc-worship',
    songs: [{
      id: 'song-backup-preserve-format',
      title: 'BACKUP PRESERVE SONG',
      artist: '',
      originalKey: 'C',
      bpm: '',
      notes: '',
      sections: [{
        type: 'verse',
        label: 'verse 1',
        notes: '',
        linesEn: ['The splendor of the King', '', '', 'Clothed in majesty'],
        linesEs: []
      }]
    }],
    services: [],
    members: [],
    scheduleMeta: {}
  }
  await page.goto('./#/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: /Import JSON backup|Importar respaldo JSON/ })).toBeVisible({ timeout: 20_000 })
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Import JSON backup|Importar respaldo JSON/ }).click()
  ])
  await chooser.setFiles({
    name: 'cupc-backup-test.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  })
  await expect(page.getByText(/Import 1 song|Importar 1/)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-field="import-format-summary"]')).toHaveCount(0)
  await page.goto('./#/songs/song-backup-preserve-format')
  await expect(page.getByRole('heading', { name: 'BACKUP PRESERVE SONG', level: 2 })).toBeVisible({ timeout: 15_000 })
  await page.goto('./#/songs/song-backup-preserve-format/edit')
  await expect(page.locator('[data-field="song-title"]')).toHaveValue('BACKUP PRESERVE SONG', { timeout: 15_000 })
  await expect(page.locator('[data-field="song-lyrics-en"]')).toHaveValue(/verse 1/)
  const en = await page.locator('[data-field="song-lyrics-en"]').inputValue()
  expect(en).toMatch(/The splendor of the King\s*\n\s*\n\s*\n\s*Clothed in majesty/)
})
