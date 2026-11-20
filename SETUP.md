# CUPC Worship — team setup

The live app at https://diebeste.github.io/cupc-worship/ is already pointed at the **CUPC Worship** Supabase project. The public URL and anon key are built in, and the join code is **CUPC-ALABANZA**. Teammates do not need to paste keys.


Teammates can join **without email**: Settings → enter their name and team code **CUPC-ALABANZA** → **Join team**. That signs the device in anonymously and keeps the session on the phone. The team code alone is view-only. Leaders also enter the leader/editor code (ask Brandon; it is not stored in the repo).

Magic-link email is optional, under **Back up my login / use on another device**.

### Enable anonymous sign-ins

The MCP tools cannot flip this switch. In the dashboard open [Authentication → Providers](https://supabase.com/dashboard/project/jpiwwwzozivkdgajiltm/auth/providers) (or **Authentication → Sign In / Providers**) and turn on **Allow anonymous sign-ins**. If abuse becomes a problem later, you can also enable CAPTCHA on that same Auth settings page.

## First sign-in (Brandon becomes admin)

1. Open the live app → **Settings**.
2. Enter your email and tap **Send login link**.
3. Open the email and tap the magic link (it should return to `https://diebeste.github.io/cupc-worship/`).
4. Back in **Settings**, confirm the join code is `CUPC-ALABANZA` and tap **Join team**. The first person to join this pre-created team becomes **admin**; later teammates join as members (view only until an admin grants `can_edit` in **Table Editor → profiles**).

## Auth URLs Brandon should confirm in the dashboard

The MCP tools cannot set Auth URLs. In [Authentication → URL Configuration](https://supabase.com/dashboard/project/jpiwwwzozivkdgajiltm/auth/url-configuration) set:

- **Site URL:** `https://diebeste.github.io/cupc-worship/`
- **Redirect URLs:** `https://diebeste.github.io/cupc-worship/` and `http://127.0.0.1:4173/cupc-worship/` (local preview)

If the magic-link email opens a blank or wrong page, those two fields are the usual cause. Also leave **Confirm email** enabled.

To re-seed songs, services, members, and the November schedule later (use a service_role key at runtime; never commit it):

```bash
SUPABASE_URL=https://jpiwwwzozivkdgajiltm.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=… \
TEAM_JOIN_CODE=CUPC-ALABANZA \
node scripts/seed-supabase.mjs
```

---

# Turn on team sync (Supabase)

The app works fully on one phone or computer without this. Songs, services and backups stay in the browser. When you are ready for the whole CUPC Mississauga worship team to share one library, create a free Supabase project and paste two values into **Settings**.

This takes about 10–15 minutes. Brandon (or another worship leader) should do it once; after that, teammates only need a magic-link email and the join code.

## 1. Create a free Supabase project

1. Open [https://supabase.com](https://supabase.com) and sign in (GitHub is fine).
2. Click **New project**.
3. Organization: your personal org is fine.
4. Name: `cupc-worship` (or similar).
5. Database password: generate a strong one and store it in a password manager. You will rarely need it.
6. Region: **Northeast US (North Virginia)** or the closest region to Ontario.
7. Click **Create new project** and wait until it is ready (about one minute).

## 2. Run the database schema

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) from this repo and click **Run**.
4. You should see a success message. This creates the `teams`, `profiles`, `songs` and `services` tables, plus row-level security so one church team cannot see another.

## 3. Turn on email login

1. Open **Authentication → Providers** and make sure **Email** is enabled.
2. Under **Authentication → Settings** (or **URL Configuration**):
   - **Site URL:** `https://diebeste.github.io/cupc-worship/`
   - **Redirect URLs:** add the same URL, and `http://localhost:5173/cupc-worship/` if you will test locally.
3. Keep **Confirm email** enabled so only people who can open the mailbox can join.

## 4. Copy the two public keys

1. Open **Project Settings → API**.
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long token starting with `eyJ`)
3. Do **not** paste the `service_role` key into the app. That key bypasses security.

## 5. Paste them into the app

1. Open [https://diebeste.github.io/cupc-worship/#/settings](https://diebeste.github.io/cupc-worship/#/settings).
2. Paste the URL and anon key.
3. Tap **Connect**.
4. Enter your name and church email.
5. Tap **Send login link**. Open the email on the same phone and tap the link. You will come back into the app signed in.

## 6. Create the team (first worship leader only)

In the browser console on the Settings page (or later from a small form if added), the first admin calls the `create_team` function. Easiest path:

1. Still signed in, open the browser console (or use the Supabase **SQL** / **API**).
2. From the app Settings page, use the **Create team** button:
   - Team name: `CUPC Mississauga Worship`
   - Join code: pick something the team can type, for example `CUPC-ALABANZA` (at least 4 characters).
3. You become the **admin**. Admins can add, edit and delete songs and services.

If you already have local songs (including the seeded 15/11 and Semana de alabanza setlists), sign in as admin and they will start syncing as you save them. You can also **Export JSON backup** first, then **Import JSON backup** on any device after sync is on.

## 7. Invite the rest of the team

1. Tell teammates the app link: `https://diebeste.github.io/cupc-worship/`
2. Ask them to **Add to Home Screen**:
   - iPhone / iPad: Safari → Share → **Add to Home Screen**
   - Android: Chrome menu → **Add to Home Screen** or **Install app**
3. Each person opens **Settings**, pastes the same Supabase URL and anon key, enters their email, taps **Send login link**, then enters the **join code** and taps **Join team**.
4. New people join as **members** (view only). An admin can set `can_edit = true` (or `role = admin`) for a person in the Supabase **Table Editor → profiles** table if they should also edit setlists.

## Roles

| Role | What they can do |
| --- | --- |
| **Admin** (worship leader) | View, create, edit, delete songs and services |
| **Member** | View the shared library and setlists, use transpose and stage view |
| **Member + can_edit** | Same as admin for editing, without being listed as admin |

Local demo mode (no Supabase keys) treats everyone on that device as an editor.

## If something goes wrong

- **Magic link does nothing:** check Site URL / Redirect URLs in step 3, and that the email was not filtered.
- **“Unknown join code”:** codes are stored in uppercase; type it exactly. Confirm the row exists in the `teams` table.
- **Songs not appearing on a second phone:** confirm both devices are signed in, joined the same team, and have an internet connection once so the first sync can run. After that, the app works offline from its local cache.
- **Need a fresh start:** Settings → Export JSON backup, then in Supabase Table Editor clear `songs` / `services` if you must, and re-import the backup while signed in as admin.

The official schema file is the source of truth: [`supabase/schema.sql`](supabase/schema.sql).


## Schema updates (v2 — roles and schedule)

If you already ran the original `schema.sql`, run the file again in the SQL Editor. The new section at the bottom is safe to re-run: it adds `voices`, `instruments`, `ujier`, `subtitle` and `schedule_pin` on `services`, converts any `adhoc` type to `service`, and creates the `members` and `schedule_meta` tables with the same row-level security.
