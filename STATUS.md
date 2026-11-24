# CUPC Worship — status (v13)

Live: https://diebeste.github.io/cupc-worship/

## Shipped

- App stamp / service worker: `cupc-worship-v13`
- Packaged song library version: `3` (unchanged in this pass)
- GitHub Pages deploy from `main` via `.github/workflows/pages.yml`
- Lyric formatter: pasted, typed, and imported songs are standardized to the v10 library format, with a preview to accept or undo. Restoring an app JSON backup is not reformatted.

## Open items

1. **Supabase anonymous sign-ins are still off.** Team join without email will fail until a project admin turns on Authentication → Providers → Allow anonymous sign-ins.
2. **CCLI / licensing** is still an open question for Brandon.
3. **92 songs remain unfilled** (one or both languages missing). See `backups/flagged-unfilled.md`. Do not machine-translate them.

## Tests

`npm test` runs the Node unit tests and Playwright on phone (390×844) and desktop (1280×800) viewports.
