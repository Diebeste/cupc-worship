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
- Local demo mode by default (IndexedDB + JSON backup). Optional [Supabase](https://supabase.com) team sync — see [SETUP.md](SETUP.md)

The library is seeded from two real team documents: a typical service (**15/11**) and the special event **Semana de alabanza — Jueves Acústico**. Extra songs that appeared in the event packet (Believe for it, Hermoso momento) are in the library but not on that Thursday setlist.

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
npm test          # Playwright, phone viewport
```

## Deploy

GitHub Pages serves the `dist` output from the `gh-pages` branch (or the Pages workflow). Base path is `/cupc-worship/`.
