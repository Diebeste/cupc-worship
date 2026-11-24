# CUPC Worship — final status (v12)

Live: https://diebeste.github.io/cupc-worship/

This is the wrap-up state after the v12 bug-fix and cleanup round. Song lyric text was not changed in this pass.

## Shipped

- App stamp / service worker: `cupc-worship-v12`
- Packaged song library version: `3` (from the v11 fill pass)
- GitHub Pages deploy from `main` via `.github/workflows/pages.yml`

## Open items (not done in this round)

1. **Supabase anonymous sign-ins are still off.** Team join without email will fail until a project admin turns on Authentication → Providers → Allow anonymous sign-ins. Do not change this from the app or from this repo.
2. **CCLI / licensing** is still an open question for Brandon. The library includes published lyrics; how the team wants to handle CCLI reporting has not been decided.
3. **92 songs remain unfilled** (one or both languages missing, with no confirmed published source used). The flagged list is in `backups/flagged-unfilled.md`. Do not machine-translate them.

## What v12 fixed

See the commit message for the full list. In short: sign-out actually clears the local session, copy-lyrics and chord-stripping no longer mangle `[EN]`/`[ES]` tags, deleting a song updates setlists on sync, service search is accent-insensitive, language boxes are visually boxed, stage wake lock is re-acquired when the tab is visible again, and basic keyboard / `lang` / skip-link accessibility is in place.

## Tests

`npm test` runs the Node unit tests and Playwright on phone (390×844) and desktop (1280×800) viewports.
