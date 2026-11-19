# CLAUDE.md

## Project
A team hub for IDF officers-course cadets. It brings together in one Hebrew mobile web app (PWA) the team roster, roll call (attendance), team and private tasks, the Google Calendar, the Google Sheets, and links. Cadets rotate through command roles (התנסות מ"צ / סמל / מ"פ), and the app gives whoever currently holds the role command permissions.

**Who uses it, and when** (this drives the design):
- **During the day, only role-holders have phones** (א' פלוגה, א' צוות "ממש", קל"ג, קמב"צ and others). They use their **own personal phones**, each signed in with their own account. They're the daytime users: roll call, assigning team tasks, checking the schedule. Design these flows to be fast and to work with one hand under pressure.
- **Everyone else gets their phone back in the evening after classes, and on weekends.** That's when they catch up: what the team got today, their own private tasks, tomorrow's schedule. It's also when the next day's role-holders prepare (handover notes, learning names).
- Roles rotate. **Command** permissions (roll call, later team tasks) come from `role_assignments` (today's role-holders) or course staff, never from a fixed user. Team **admins** (whoever created the team, plus anyone they promote) only handle setup: roster, roles, invite code. Today's role-holders can also manage the roster, roles and assignments. The role list varies, so it's configurable per team, not hardcoded.

The full research, roadmap and TODO list are in `ROADMAP.md`. Update its checkboxes when you finish a task.

**Current phase:** 3 in progress: calendar (embed + server-side read as Roma's Google account `roma.d.standard@gmail.com`) done; Sheets next (Phases 1–2 done). **Production:** https://roma-bhad.vercel.app (Vercel project `roma_bhad`, auto-deploys from GitHub `main`); Supabase project `roma` (ref `tuylurlxwgisrejgiwpr`, Frankfurt), migrations pushed with `npx supabase db push --remote --yes` (CLI v3 targets local by default). Sign-in is **Google only** in production; email codes exist only in local dev (`EMAIL_LOGIN=on`, ignored in production builds) for Mailpit and the smoke test. Repo: `saleemkheralden/roma_bhad` (private), Vercel project `roma_bhad`. Phase 0 approval is still pending, so don't share the app with other cadets yet.

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
- **Auth:** Google sign-in through Supabase Auth (production). Email codes only in local development.
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
- Secrets go in `.env.local` (git-ignored) and Vercel environment variables. Commit a `.env.example`. The Supabase service-role key and the Google OAuth secret/refresh token are used only on the server, never with a `NEXT_PUBLIC_` prefix.
- Keep it simple: this is a course tool with ~30–150 users. Don't add infrastructure the free tiers don't need.

## Data model (source of truth: `supabase/migrations/`)
- `teams` (with `invite_code`), `team_members` (the roster; `user_id` is null until the cadet joins and claims the name; `is_admin`, `is_staff`), `team_roles` (configurable), `role_assignments` (role + member + date range), `attendance_sessions` / `attendance_entries`, `links`.
- Permission helpers live in the unexposed `private` schema: `is_team_member`, `is_team_admin`, `can_command` (staff, or a command role today in Asia/Jerusalem), `can_manage` (admin or command). `public.my_permissions()` exposes them to the UI for display only.
- RPCs: `create_team`, `preview_team`, `join_team`, `regenerate_invite_code`. New tables need explicit `grant`s (Supabase no longer exposes them automatically).
- `tasks` (Phase 2): `visibility` team|private (immutable), `assignee_member_id` (null = whole team), `due_on` + optional `due_time`, `status` open|done. Trigger `private.guard_tasks` forces `owner_id` to the caller on private tasks, sets `done_at`/`done_by`, and lets a non-command assignee change only `status`. Team-wide tasks (no assignee) are closed by command only; each cadet's part lives in `task_completions` (own row, or anyone's for command; only while the task is open).
- `task_checklist_items` (issue #2): steps of a task (`text`, `position`, `done`, max 20). Access mirrors the parent task through `private.checklist_access` ('edit' | 'tick' | 'read'): editors of the task (command for team tasks, owner for private) add and remove steps (the DB also allows renaming; the UI does not offer it yet); the assignee of an assigned team task may only tick; a team-wide task's steps are ticked by command only; nothing changes once the task is closed. Trigger `private.guard_checklist_items` stamps `done_at`/`done_by` and enforces the 20-step limit.
- `integrations` (Phase 3): `kind` gcal|gsheet + `external_id` (only an identifier; events and sheet contents stay in Google). Members read, managers add/remove, max 3 calendars. `src/lib/calendar.ts` parses pasted IDs/links/iframes and builds the embed URL. `src/lib/google-calendar.ts` reads events server-side as Roma's own Google account (the calendar is shared with it, "See all event details"); it authorised Roma once with read-only scope via `scripts/connect-google-calendar.mjs`, and its refresh token lives only in server env (`GOOGLE_OAUTH_CLIENT_ID` / `_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_CALENDAR_ACCOUNT`). Requests only id/title/status/times, **never location or description**; cached ~1 min with `use cache`, never stored. Without access it falls back to the embed.
- Personal task views (issue #1): `user_settings` (my `task_layout`: list|board|days) and `task_lanes` (my board lane `todo|doing` + `position` per task). Both own-row only; a lane can only be set on a task the caller can see. "Done" is never a lane: it comes from `tasks.status` or my `task_completions` row. The "team" tab always stays a list.
- `push_subscriptions` (Phase 4): one row per device with notifications on; own rows only. The server reads others' rows only through `src/lib/supabase/admin.ts` (`SUPABASE_SECRET_KEY`, server-only). `src/lib/notify.ts` pushes role assignments and new team tasks (via `after()`), `src/app/api/cron/evening-summary` sends the evening summary (Vercel Cron in `vercel.json`, `CRON_SECRET`; `?dry=1` returns messages without sending). Payloads: title, one line, a path; no locations.
- Planned: `companies`. See `ROADMAP.md` §2.

## Gotchas
- Next.js 16 `cacheComponents`: per-user data goes inside `<Suspense>`; the server Supabase client calls `connection()` so it always renders at request time.
- Recently visited routes stay mounted but hidden (`<Activity>`), so tests must scope selectors to the visible page.
- Tailwind classes don't override each other by order: size/padding/colour live only in `button-class.ts` variants; don't pass a competing `px-*`/`h-*`/`text-*`.
- pgTAP tests must scope counts to their own fixture team: the local DB also holds smoke-test data.
- Sign-in emails must contain the 6-digit code: templates in `supabase/templates/` (set the same template in the hosted dashboard).

## Commands
- `npm run dev`: start the dev server at http://localhost:3000
- `npm run build`: production build (run before committing larger changes)
- `npm run lint`: ESLint
- `vercel deploy -y --no-wait`: deploy from the CLI (until GitHub auto-deploy is connected)
- `npx impeccable detect src`: scan the UI for design issues
- `npx supabase start` / `npx supabase stop`: local Supabase (Docker Desktop must be running). Studio http://127.0.0.1:54323, Mailpit (sign-in codes) http://127.0.0.1:54324
- `npx supabase migration new <name>`: new migration; `npx supabase migration up --local`: apply new migrations and keep local data; `npx supabase db reset --yes`: wipe and re-apply everything
- `npm run test:unit`: unit checks for the calendar parser, agenda, task checklists and evening summary (`scripts/test-*.ts`, run by Node with `scripts/ts-resolve.mjs`)
- `node scripts/connect-google-calendar.mjs <desktop-oauth-client.json> [--vercel]`: one-time, sign in as Roma's Google account so the server can read shared calendars; saves the refresh token to `.env.local` (and Vercel) without printing it
- `npm run db:test`: pgTAP RLS tests (`supabase/tests/`); `npm run db:types`: regenerate `src/lib/supabase/database.types.ts`
- `npx supabase db advisors --type all`: security and performance checks
- `node scripts/make-icons.mjs`: re-render the app icons (then re-embed provenance with `impeccable embed-prompt`)
- `node scripts/e2e-smoke.mjs`: end-to-end smoke test in headless Chrome (needs `npm run dev` + local Supabase); screenshots go to `.impeccable/review/`
