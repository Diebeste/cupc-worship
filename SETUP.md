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
