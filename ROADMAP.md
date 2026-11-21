# Team Hub for Officers Course: Research, Roadmap and TODO

## The problem
1. **Names**: cadets in a rotating command role (התנסות מ"צ / מ"פ) have to learn the names of everyone in the team, and roll call starts from scratch every time.
2. **Things are spread out**: the calendar is in Google Calendar, duty lists are somewhere else, and spreadsheets sit in a third place.
3. **Tasks**: there are lots of them and everyone tracks them differently. People need team tasks (public) and their own tasks (private) in one view.

### Who uses it, and when
| When | Who | What they need |
|---|---|---|
| **During the day** | Only today's role-holders have phones (personal phones, own accounts) | Fast roll call, assigning team tasks, today's schedule, duty lists, links |
| **Evening after classes, and weekends** | Everyone | Catch-up: what the team got today, my private tasks, tomorrow's schedule. Tomorrow's role-holders prepare: handover notes, learning names |

This means:
- **Role-holders are the main users.** The role rotation (who holds which role today) is core, so it moves up from Phase 4 into the MVP.
- **Two modes:** a fast daytime "command" mode for role-holders, and an evening "catch-up" mode for everyone.
- Daytime push notifications only matter for role-holders. Everyone else gets an **evening summary** instead.
- The role list differs between teams and companies, so it's configurable, not hardcoded.

---

## 1. Research: what already exists

| Need | Existing tools | What we take from them | Integrate or build? |
|---|---|---|---|
| Learning names | NameDrill, FaceCards, FaceRecall (iOS flashcards with spaced repetition) | Photo + name flashcards, and the people you get wrong come back more often | **Build** a simple version on top of our own roster. These apps can't import a team list |
| Roll call / accountability | Army PERSTAT "Leaders Book", Adyton Mustr/AOK (US military), a planned IDF morning self-report app | One-tap checklist, reasons for absence, a summary ready to send, alerts for people who haven't reported | **Build** (this is the core feature) |
| Duty rosters | Picket List (auto-assigns guard slots), SAF Duty Roster (open source, points-based fairness), eDuty | Fair rotation using points and blocked-out dates | Phase 2: **build**, borrowing the points algorithm from SAF Duty Roster |
| Calendar | Google Calendar | It's already the source of truth, so don't replace it | **Integrate**: iframe embed first, Calendar API later |
| Spreadsheets | Google Sheets | Keep the staff's existing sheets as the source | **Integrate**: Sheets API (read-only) |
| Tasks | Todoist, Trello, Army NCO Tools "Blue Force Taskr" | Assignee, due date ("suspense"), public vs. private | **Build**: we need the team/private split and the role rotation |
| Unit management, broadly | Resgrid (open source, made for first responders) | Ideas for the data model (units, groups, accountability logs) | Use for reference only, too heavy to adopt |

**Takeaway:** no existing product combines a roster, roll call, team and private tasks, and the course's own calendar and sheets, in Hebrew. Rather than replace the parts that already work (Google Calendar, Sheets), the app should **pull them into one place** and build only the missing core: roster, roll call, tasks and the name trainer.

### ⚠️ The biggest constraint: information security
- The IDF prohibits passing operational information through civilian apps (the WhatsApp guidelines), and in 2025 it tightened phone rules for officers.
- **The app must stay unclassified by design:** no locations, no operational schedules, no weapons or equipment data, no ID numbers. Store names, roles, generic tasks and links only.
- **Before building, get approval from the course staff or the information-security officer (קב"ט / ביטחון מידע).** That's step zero, because an unapproved app can get banned on day one.
- Keep each team's data to the minimum, let people delete it all at the end of the course, and make photos optional.

---

## 2. Proposed architecture

- **App type:** a mobile-first **PWA** (installs from the browser, nothing to submit to an app store), in Hebrew with **RTL**.
- **Frontend:** Next.js + Tailwind (RTL), or React + Vite if you want something simpler.
- **Backend:** **Supabase** (Postgres + Auth + Row-Level Security + Storage). Row-Level Security handles public vs. private tasks at the database level, which is safer than checking in the app.
- **Auth:** Google sign-in (everyone already uses Google Calendar) or magic links.
- **Integrations:** Google Calendar (embed, then API), Google Sheets API (read-only, through a service account the staff shares sheets with), and WhatsApp "share" links only (no bot, no operational content).
- **Hosting:** Vercel plus Supabase free tiers. That's enough for a course.

### Data model (first draft)
```
users(id, name, nickname, photo_url?, phone?)
teams(id, name, company_id)            -- צוות
companies(id, name)                    -- פלוגה
memberships(user_id, team_id, role)    -- cadet / staff
role_assignments(team_id, user_id, role, start_date, end_date)
                                       -- התנסות: מ"צ, סמל, מ"פ... rotates
attendance_sessions(id, team_id, taken_by, created_at, label)
attendance_entries(session_id, user_id, status, reason)
tasks(id, team_id, owner_id, assignee_id?, visibility[team|private],
      title, notes, due_at, status, created_by)
links(id, team_id, title, url, category)        -- the hub
integrations(team_id, type[gcal|gsheet], external_id, config)
```

### Key permissions
- Team tasks: everyone in the team can see them. Staff and the current role-holder can create and assign them.
- Private tasks: only the owner can see them.
- Roll call: whoever holds the command role right now (from `role_assignments`), plus staff.

---

## 3. Roadmap

### Phase 0: Validation and approval (week 1)
Talk to 5–8 cadets and one staff member, confirm which problems hurt the most, get the information-security OK, and agree on what data is allowed.

### Phase 1: MVP "Roster + Roles + Roll Call + Hub" (weeks 2–3)
Sign-in, create or join a team with an invite code, the team roster, **today's role-holders** (who is א' צוות / קל"ג / קמב"צ today; they get command permissions), **one-tap roll call** that produces a summary to copy into a message, and a **links hub** (calendar, sheets, forms).
Goal: one team uses it for a full week.

### Phase 2: Tasks (weeks 4–5)
Team and private tasks, due dates, a "my day" view (my private tasks + team tasks assigned to me + today's events), and done/undone. Plus an **evening catch-up view**: what was added today and what's due tomorrow, for the cadets who only get their phones in the evening.

### Phase 3: Integrations (weeks 6–7)
An embedded Google Calendar (then a native "today" list from the Calendar API), a read-only Google Sheets view (for example a duty list rendered as a clean table), and caching for weak reception.

### Phase 4: Leadership simulation features (weeks 8–9)
- **Name trainer**: photo/role/nickname → name flashcards and a quiz before your התנסות starts.
- "Handover" notes from one role-holder to the next (written in the evening, read by tomorrow's holder).
- Notifications: daytime push for role-holders only, plus an evening summary for everyone.
- (The basic role rotation moved into Phase 1.)

### Phase 5: Scale and polish (week 10+)
Multiple teams and a company view (התנסות מ"פ sees all its teams), duty rotation with fairness points, end-of-course data deletion and export, and offline mode.

---

## 4. TODO list

### Phase 0
- [ ] Write a one-page pitch (problem, solution, what data is and isn't stored)
- [ ] Get approval from the course staff and the information-security officer
- [ ] Interview 5–8 cadets: how roll call is done today, where tasks come from, which sheets they use
- [ ] Collect real examples: the roll-call message format, the duty sheets, the calendar
- [ ] Decide: Hebrew only? Photos allowed?

### Phase 1: MVP
- [x] Scaffold the app (Next.js 16 + TypeScript + Tailwind 4, `dir="rtl"`, Heebo font, PWA manifest)
- [x] Add Impeccable (dev dependency + project skills)
- [x] Create the design context (`PRODUCT.md`, "Departure Board" direction in `.impeccable/surfaces/src-app.md`)
- [x] `git init` + GitHub repo + link to Vercel; first deploy (behind Vercel login)
- [x] Give the Vercel GitHub app access to the repo, so every push deploys
- [x] Local Supabase + Phase 1 schema (`teams`, `team_members`, `team_roles`, `role_assignments`, `attendance_*`, `links`) with RLS and 25 pgTAP tests
- [x] Create the hosted Supabase project (`roma`, Frankfurt) and push the migrations
- [x] Sign-in with a 6-digit email code (works locally via Mailpit)
- [x] Google sign-in (OAuth client in Google Cloud, provider enabled in Supabase)
- [x] Create a team, and join one with an invite code or link (claim your name from the roster)
- [x] Roster screen: list, add and remove names, admin/staff flags
- [x] Roster: edit names, paste a list (one per line, or two columns from a sheet)
- [x] Configurable role list per team (defaults: א׳ צוות, סמל, קל״ג, קמב״צ)
- [ ] Company-level roles (א׳ פלוגה …) once companies exist
- [x] `role_assignments` + today's role-holders on the board; assign by date range (so tomorrow's holders can be set in the evening)
- [x] RLS: roll call only for staff + today's role-holders (team tasks come in Phase 2)
- [x] Roll-call screen: tap each name for present/late/absent plus a reason; live counter
- [x] "Copy summary" button that formats the summary for a message (no locations)
- [x] Roll-call history
- [x] Links hub: add, remove and categorize links
- [x] PWA manifest
- [x] Real app icons (192/512 PNG + maskable + apple-touch), rendered by `scripts/make-icons.mjs`
- [x] Deploy to Vercel (https://roma-bhad.vercel.app)
- [ ] Pilot with your own team (after Phase 0 approval)

### Phase 2: Tasks
- [x] `tasks` table and Row-Level Security policies (team vs. private), 20 pgTAP tests
- [x] Create a task: title, notes, due date and time, visibility, assignee (or the whole team)
- [x] Views: mine / team / private, grouped by overdue, today, tomorrow, later; "my day" on Today
- [x] Mark done (assignee or command); overdue group; done tasks of the last week collapsed
- [x] Evening catch-up on Today: team tasks added today, due tomorrow (moves to the top after 17:00)
- [x] Catch-up: tomorrow's calendar events (when the service account can read the calendar)
- [x] Edit a task after creating it (text, notes, date/time, assignee; command for team tasks, owner for private)
- [x] Team-wide tasks done per cadet: each cadet marks their part, progress and who's missing, command marks cadets without a phone and closes the task
- [x] Personal task views (issue #1): each cadet picks list, Kanban board (to do / in progress / done, long-press drag + one-thumb arrow buttons, drag engine ported from Focus Board) or by-day; the layout, "in progress" and card order are per user only (`user_settings`, `task_lanes`), 16 pgTAP tests
- [x] Task checklists (#2): break a task into up to 20 steps with progress (3/5) on the card, in every layout (list, by-day, and ticked or added right on a Kanban card); steps typed one per line when creating, or added later. Editors (command / private owner) add and remove steps; the assignee ticks them; a team-wide task's steps are a shared guide that command ticks. 20 pgTAP tests

### Phase 3: Integrations
- [x] Settings: paste the team's Google Calendar (ID, share link, embed link or `<iframe>` code) → agenda embed on Today, up to 3 calendars
- [x] Calendar API via a service account: Roma's own agenda on Today (works on any phone, calendar stays private); falls back to the embed until the calendar is shared with the service account
- [ ] Google Cloud service account + Sheets API (read-only); the staff shares the sheet with the service account's email
- [ ] Sheet viewer: pick a tab/range → mobile-friendly table, cached
- [ ] Error states (sheet not shared, quota exceeded)

### Phase 4: Simulation features
- [ ] Name-trainer flashcards (simple spaced repetition: missed cards come back sooner)
- [ ] Roll-call "practice mode": a photo or nickname is shown and you pick the name
- [x] Notice board (#3): role-holders and staff post to the team; pinned notices, optional expiry, "new today" tag; on Today and its own tab
- [x] Handover notes between role-holders: notices with the "role-holders only" audience, readable by staff and today's or upcoming role-holders
- [ ] Web push for role-holders during the day; an evening summary for everyone

### Phase 5: Scale
- [ ] Company level: a company holds teams; company dashboard
- [ ] Duty rotation with fairness points and blocked-out dates
- [ ] Offline support for roll call (service worker + sync queue)
- [x] Export all data, then delete it all (end of course): "my data" download for every member, full team download and typed-name team deletion for admins (Team page → הנתונים)
- [ ] Onboarding for other teams
