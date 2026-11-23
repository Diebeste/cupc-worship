# CUPC song library backups

Taken **before** the 2026-11-23 library cleanup (America/Toronto).

## Files

- `library-songs.20261123-081723.json` — copy of `src/data/library-songs.json` (238 imported songs)
- `library-songs.20261123-081723.sha256.txt` — checksum
- `supabase-songs.20261123-081723.json` — dump of `public.songs` for team `50b2b04b-3657-47c3-8b99-d8fab258a119` (project `jpiwwwzozivkdgajiltm`). No API keys are stored here.
- `supabase-songs.20261123-081723.sha256.txt` — checksum
- `screenshots-before/` — bilingual song views before the cleanup
- `screenshots-after/` — the same views after the cleanup
- `review/` — flagged-song list, per-song review, and the cleaned JSON produced by the script

JSON dumps are gitignored (they are large and already represented in the repo or this folder on the box). This README and the restore script are tracked.

## Restore

```bash
# List available backups
node scripts/restore-library-backup.mjs --list

# Restore the packaged library file only
node scripts/restore-library-backup.mjs --file backups/library-songs.20261123-081723.json

# Also restore the Supabase table (pass keys at runtime — never commit them)
SUPABASE_URL=https://jpiwwwzozivkdgajiltm.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=… \
node scripts/restore-library-backup.mjs \
  --file backups/library-songs.20261123-081723.json \
  --supabase backups/supabase-songs.20261123-081723.json
```
