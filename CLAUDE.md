# CLAUDE.md

## Project
A team hub for IDF officers-course cadets. It brings together in one Hebrew mobile web app (PWA) the team roster, roll call (attendance), team and private tasks, the Google Calendar, the Google Sheets, and links. Cadets rotate through command roles (התנסות מ"צ / סמל / מ"פ), and the app gives whoever currently holds the role command permissions.

**Who uses it, and when** (this drives the design):
- **During the day, only role-holders have phones** (א' פלוגה, א' צוות "ממש", קל"ג, קמב"צ and others). They use their **own personal phones**, each signed in with their own account. They're the daytime users: roll call, assigning team tasks, checking the schedule. Design these flows to be fast and to work with one hand under pressure.
- **Everyone else gets their phone back in the evening after classes, and on weekends.** That's when they catch up: what the team got today, their own private tasks, tomorrow's schedule. It's also when the next day's role-holders prepare (handover notes, learning names).
- Roles rotate. Permissions come from `role_assignments`, never from a fixed "admin" user. The role list varies, so it's configurable per team and company, not hardcoded.

The full research, roadmap and TODO list are in `ROADMAP.md`. Update its checkboxes when you finish a task.

**Current phase:** 1, MVP setup. Scaffolded, in a private GitHub repo (`saleemkheralden/team-hub`), and linked to the Vercel project `team-hub`. Phase 0 approval is still pending, so don't share the app with other cadets yet.

@AGENTS.md: Next.js 16 has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.

## 🔒 Information security: hard rules (never break these)
The app must stay **unclassified**. The IDF prohibits passing operational information through civilian apps.
- **Store only:** names and nicknames, team/company names, role titles, generic task text, attendance status and a free-text reason, links, and an optional profile photo.
- **Never** add fields, features or seed data for: locations, base names or coordinates, operational schedules or missions, weapons or equipment, ID numbers (מספר אישי / ת"ז), medical details, or anything about classification.
- Generated roll-call summaries must not contain locations.
- No analytics or third-party trackers. Collect as little data as possible, and keep "export my data" and "delete all team data" possible.
- If a request would break these rules, stop and flag it instead of building it.

## Stack
- **Frontend:** Next.js 16 (App Router, `src/` dir, `cacheComponents` on) + React 19 + TypeScript + Tailwind CSS 4, installable as a PWA (`src/app/manifest.ts`).
- **Backend:** Supabase (Postgres, Auth, Storage, Row-Level Security).
- **Auth:** Google sign-in through Supabase Auth.
- **Integrations:** Google Calendar (iframe embed first, then the API) and Google Sheets API (read-only, through a service account).
- **Hosting:** Vercel Hobby (free) + Supabase Free.
  - Supabase Free pauses a project after 7 days with no activity. Keep a scheduled ping (GitHub Actions cron) once the app is live.
  - Firebase is not used, because its Storage needs a paid plan.

## Conventions
- **Hebrew-first, right-to-left:** `<html lang="he" dir="rtl">`. Use Tailwind's logical properties (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`), never `ml-`/`mr-`/`left-`/`right-`. Font: Heebo or Assistant.
- UI text is Hebrew, kept in one strings file (`src/lib/strings.ts`) so it isn't scattered through the code. Code, comments and commit messages are in English.
- **Mobile-first:** design for a phone held in one hand. Tap targets ≥ 44px. Roll call must work with one thumb.
- **Permissions are enforced by RLS in the database**, not only in the UI. Every new table gets RLS enabled plus explicit policies in the same migration.
  - Team tasks: readable by team members. Staff and the current role-holder can create or assign them.
  - Private tasks (`visibility = 'private'`): only `owner_id = auth.uid()`.
  - Roll call: staff plus whoever holds the command role right now, from `role_assignments` where today falls between `start_date` and `end_date`.
- Schema changes only through migrations in `supabase/migrations/`. Never change production by hand.
- Secrets go in `.env.local` (git-ignored) and Vercel environment variables. Commit a `.env.example`. The Supabase service-role key and the Google service-account key are used only on the server, never with a `NEXT_PUBLIC_` prefix.
- Keep it simple: this is a course tool with ~30–150 users. Don't add infrastructure the free tiers don't need.

## Data model (draft; the source of truth will be the migrations)
`users`, `companies`, `teams`, `memberships(role: cadet|staff)`, `role_assignments`, `attendance_sessions`, `attendance_entries`, `tasks(visibility: team|private)`, `links`, `integrations(type: gcal|gsheet)`. See `ROADMAP.md` §2.

## Commands
- `npm run dev`: start the dev server at http://localhost:3000
- `npm run build`: production build (run before committing larger changes)
- `npm run lint`: ESLint
- `vercel deploy -y --no-wait`: deploy from the CLI (until GitHub auto-deploy is connected)
- `npx impeccable detect src`: scan the UI for design issues
- _Still to add:_ tests, Supabase migrations
