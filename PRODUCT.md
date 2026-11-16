# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first web app, installable as a PWA. Used on personal phones; desktop is secondary.

## Users

- **Role-holders during the day.** Cadets in an IDF officers course who currently hold a command role (א' פלוגה, א' צוות "ממש", קל"ג, קמב"צ and others) are the only cadets with phones during the day. They use their own personal phones and accounts. Their jobs: take roll call fast, assign team tasks, check today's schedule and lists, often standing, in a hurry, with one hand, in the sun, under pressure from staff.
- **All cadets in the evening and on weekends.** Everyone else gets their phone back after classes end and on weekends. Their jobs: catch up on what the team got today, check their own private tasks and tomorrow's schedule. Tomorrow's role-holders prepare here: handover notes and learning the team's names.
- **Course staff** (the team's מפקדים / סגל) also use it. They can take roll call and assign tasks at any time, so their view of the team matters.
- Scale: about 10–15 cadets per team (צוות); a company (פלוגה) has several teams.

## Product Purpose

Roma puts everything a team needs in one place ("all roads lead to Roma"). Today the calendar is in Google Calendar, the security-team list is in one place, spreadsheets are in another, and every cadet tracks tasks differently. A new role-holder also has to learn everyone's names, and roll call keeps starting over.

Success: a role-holder takes roll call in seconds without knowing everyone's names by heart, and every cadet knows in the evening what the team got today and what's theirs to do.

## Positioning

Built around how the course actually works: roles rotate daily or weekly, permissions follow whoever holds the role today, most cadets only have their phone in the evening, and the roster includes people who haven't signed up yet. Generic task, roster or scheduling apps assume fixed admins and always-online members.

## Operating Context

- Rotating leadership simulations (התנסות א' צוות, א' פלוגה …). Whoever holds a command role today gets command permissions (roll call, assigning team tasks); course staff always have them.
- The roster can contain cadets without an account; they claim their name from the list when they join with the team's invite code.
- Existing sources stay where they are and are pulled in: Google Calendar (embed, later the API) and Google Sheets (read-only).
- Roll-call results are copied as a summary and passed on in a message.

## Capabilities and Constraints

- **Information security (hard rule):** the app must stay unclassified. It stores only names and nicknames, team/company names, role titles, generic task text, attendance status with a short reason, links, and an optional photo. Never locations, base names, operational schedules or missions, weapons or equipment, ID numbers, or medical details. No analytics or third-party trackers. Not indexed by search engines.
- **Approval pending:** course staff and information-security approval (Phase 0) is still pending; the app isn't shared with other cadets until then.
- **Language:** Hebrew UI, right-to-left. Military terms and abbreviations (צוות, פלוגה, התנסות, מ"צ, קל"ג, קמב"צ) are the vocabulary, used as cadets say them.
- **Free tier:** Next.js on Vercel Hobby plus Supabase Free. A course tool for tens to about 150 users.
- Phase 1 scope: teams, roster, configurable roles, today's role-holders, roll call with a copyable summary and history, links hub. Tasks, calendar/sheets integration, name trainer and notifications come in later phases (see ROADMAP.md).

## Brand Commitments

- Name: **Roma** (Hebrew: רומא), from "all roads lead to Roma". Everything leads to one place.

## Evidence on Hand

None yet: no testimonials, usage numbers or endorsements exist. Don't invent any, and don't imply official IDF endorsement.

## Product Principles

1. **Seconds, not minutes.** The daytime flows (roll call above all) must finish fast, one-handed, on a phone, under pressure.
2. **Permissions follow the role, not the person.** Whoever holds the role today has the power; tomorrow it moves on.
3. **Works for people who aren't there yet.** The roster, roll call and tasks work for cadets who haven't signed up or don't have their phone right now.
4. **One place, not another place.** Pull in the calendar and sheets the course already uses instead of replacing them.
5. **Unclassified by design.** If a feature needs operational data, it doesn't get built.

## Accessibility & Inclusion

Use outdoors in bright sun, one-handed, often in a hurry: high contrast, large tap targets (≥ 44px), no reliance on hover or fine gestures. Hebrew RTL throughout, with correct mixing of Hebrew and Latin/numbers.
