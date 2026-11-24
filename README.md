# CUPC Mississauga Worship

A mobile-first, installable web app (PWA) for the CUPC Mississauga worship team. It unifies song lyrics (English and Spanish), keys, transpose, and service setlists so the team does not have to juggle Drive documents.

**Live:** https://diebeste.github.io/cupc-worship/

Add it to the home screen on iPhone or Android — no app store. It works offline after the first visit.

## What’s included

- Song library with search in either language, section labels, optional ChordPro chords
- Paste or import lyrics from PDF, Word (.docx) or text; bulk import is supported
- Transpose by step or target key, with a capo suggestion; a service can override the key without changing the song
- Services / setlists, including duplicate-a-past-service and a quick ad-hoc create flow
- Stage view: large type, swipe, EN/ES toggle, optional wake lock
- Share a service link, print/PDF in a setlist-and-lyrics layout close to the team’s current docs, or copy WhatsApp text
- Bilingual UI (English / Spanish)
- Local first (IndexedDB + JSON backup), with optional [Supabase](https://supabase.com) team sync — see [SETUP.md](SETUP.md)

The library is a bilingual EN/ES songbook (library version 3) plus two seeded services from real team documents: a typical service (**15/11**) and the special event **Semana de alabanza — Jueves Acústico**.

Branding (navy `#182848`, blue `#4B6AB7`, logo) comes from the official [CUPC-EPUC website](https://cupc-epuc.org/). Fonts are Roboto, Roboto Slab and Quicksand, as used on that site.

## Develop

```bash
npm install
npm run dev
```

The dev server is at `http://localhost:5173/cupc-worship/`.

```bash
npm run build
npm run preview
npm test          # unit tests + Playwright (phone and desktop)
```

## Deploy

GitHub Pages serves the `dist` output from the `gh-pages` branch (or the Pages workflow). Base path is `/cupc-worship/`.


## Current status

The live app is **v12** (`cupc-worship-v12`). See [STATUS.md](STATUS.md) for the wrap-up notes and remaining open items:

- Supabase anonymous sign-ins are still off, so email-free team join does not work yet
- The CCLI / licensing question is still undecided
- 92 library songs are still unfilled (no confirmed published source)
