---
version: 1
slug: "src-app"
primary_target: "src/app"
related_targets: []
---

# Roma app shell (all Phase 1 screens)

Scope: the signed-in app (Today, Team/roster, Roll call, Links) plus sign-in and join. Visitor mode: Operate.

Audience and job: today's role-holders on their own phones, one-handed, outdoors, in a hurry (roll call, today's roles); everyone in the evening catching up. Staff can act at any time. Teams are 10–15 cadets.

Constraints: Hebrew RTL, logical properties only, tap targets ≥ 44px, sun-readable contrast, no operational data (PRODUCT.md).

## Direction contract

THESIS: The day runs like a departure board: who holds which role now, who is here, what comes next. It refuses the generic white-cards-and-blue-accent team app.

OWN-WORLD: Light working ground #F4F5F0 under a deep navy board band #0E1B33 that carries identity and today's role-holders as board rows. Amber #F2A900 is reserved for "now" (the current role, the active tab, the live count). State colours: green #1E8E4E present, amber-on-cream late, red #C62828 absent, dashed grey for unmarked. Heebo throughout, tabular figures for every count and time. Square-ish 6–8px corners, 1px rules, no shadows.

STORY: A role-holder opens Roma, sees at once that they're on duty and who else is, taps through roll call in seconds, copies the summary and sends it. In the evening anyone sees the same board and the day's roll calls.

FIRST VIEWPORT: Navy board band on top: "רומא", team name, day and clock in amber; rows "תפקיד / בתפקיד עכשיו / עד" with the viewer's own row marked. Below on the light ground: the open roll call, a big tabular count (11/13) and the roster packed as whole name cells (3 per row) carrying their state; primary "העתקת סיכום", with "סיום" set apart. Bottom tab bar: היום · צוות · נוכחות · קישורים, the active tab marked with an amber top rule.

FORM: Departure Board, assigned candidate 3 of 7 (1 road signage, 2 corridor bulletin board, 3 departure board, 4 field notebook, 5 government form, 6 school diary, 7 Roman milestone). seed:616eb1a8717033e3. Raises: whole-cell roster (convention catalog); fixed-scale roll-call history (botanical folio); destructive actions isolated by space (dark console); one face with tabular figures (datamatics). Signature move: board rows flip (a short vertical flip-panel transition) when a status or role-holder changes; reduced motion swaps instantly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
