# Cultural calendar

A private, synchronised exhibition and theatre diary, installed from the web on a phone or desktop.

The public repository contains application code only. Event research, personal decisions, visit notes and followed artists live in Supabase behind authentication and database policies.

## Features

- The existing forward diary, daily calendar, shortlist, booking queue, reviewed events and archive.
- Separate planning notes, attendance dates and visit reflections, with a Seen / visit notes view.
- Follow, annotate and pause artists; show research findings alongside each artist.
- Save directly to Supabase. Failed writes retain the draft; stale writes require review instead of overwriting another device.
- Background checks while open, plus Check for updates. Offline viewing after the first online visit; offline drafts must be saved after reconnecting.
- Installable PWA. Sign out clears this device's cached records and drafts.
- Optional backup and one-time import from the previous local diary.

## Development

Requires Node 24 or later. Copy `.env.example` to `.env.local` and provide the project URL and **publishable** key. Never put a secret or service-role key in a `VITE_` variable.

```text
npm ci
npm test
npm run dev
npm run build
```

Apply the migration in `supabase/migrations` once to an empty project. Add the owner's lower-case email to `calendar_members` through the SQL Editor. This allowlist is inaccessible to browser accounts. Signing up alone never grants calendar access.

Set the Supabase Site URL to the published calendar URL. Additional redirect URLs should be exact application URLs; allow a localhost development URL only while testing. The initial implementation uses email sign-in links.

`tests/database.sql` tests the deployed database in a transaction and rolls back all fixtures. Run it after the research inventory has been imported.

## Publishing

GitHub Pages serves only the built app, never research source files. The deployment workflow runs tests, builds with the public project connection values, and uploads `dist/` only. A public Supabase publishable key identifies the project; authenticated database policies enforce access.

Keep the existing local research folder and its original HTML location until browser-only decisions have been transferred. A browser cache is not a substitute for the online database or a backup.

## Research updates

Read `REFRESH.md`. Researchers read the followed artists from Supabase on every requested refresh. Research publishing changes `calendar_research` only and cannot overwrite `calendar_decisions` or `calendar_artists`. The browser cannot publish research.

The optional command-line publisher accepts a server-only credential from the environment. It never stores credentials in this repository. An authenticated Supabase dashboard session is also sufficient for manual refreshes, without asking the owner to export their artist list.
