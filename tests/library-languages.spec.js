import { test, expect } from '@playwright/test'

const SONGS = [
  {
    id: 'song-at-your-feet',
    heading: /At your feet/i,
    en: /I surrender who I am/,
    es: /A Tus pies, arde mi corazón|entrego lo que soy/
  },
  {
    id: 'song-construire-mi-vida-build-my-life',
    heading: /Construir[eé] mi vida/i,
    en: /Worthy of ev[’']ry song we could ever sing/,
    es: /Digno de recibir toda adoración/
  },
  {
    id: 'song-to-god-be-glory-dios-sea-gloria',
    heading: /To God be the Glory/i,
    en: /How can I say thanks/,
    es: /A Dios sea la gloria/
  }
]

async function openSong(page, song) {
  await page.goto(`./#/songs/${song.id}`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: song.heading, level: 2 })).toBeVisible({ timeout: 20_000 })
}

async function setLang(page, which) {
  const names = { en: /^EN$/i, es: /^ES$/i, both: /Both|Ambos/ }
  const btn = page.locator('.lang-row .seg').getByRole('button', { name: names[which] })
  await expect(btn).toBeVisible()
  await btn.click()
  await expect(btn).toHaveClass(/on/)
}

for (const song of SONGS) {
  test(`EN / ES / Both for ${song.id}`, async ({ page }) => {
    await openSong(page, song)

    const lyrics = page.locator('.lyrics')

    await setLang(page, 'en')
    await expect(lyrics.getByText(song.en).first()).toBeVisible()
    await expect(lyrics.getByText(song.es)).toHaveCount(0)

    await setLang(page, 'es')
    await expect(lyrics.getByText(song.es).first()).toBeVisible()
    await expect(lyrics.getByText(song.en)).toHaveCount(0)

    await setLang(page, 'both')
    await expect(lyrics.getByText(song.en).first()).toBeVisible()
    await expect(lyrics.getByText(song.es).first()).toBeVisible()
    await expect(page.locator('.side-by-side').first()).toBeVisible()
    expect(await page.locator('.side-by-side').count()).toBeGreaterThan(0)
    await expect(page.locator('.lang-tag', { hasText: 'EN' }).first()).toBeVisible()
    await expect(page.locator('.lang-tag', { hasText: 'ES' }).first()).toBeVisible()
  })
}
