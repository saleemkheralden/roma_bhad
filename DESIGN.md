---
name: Roma
description: A Hebrew team hub that runs the day like a departure board.
colors:
  ground: "#f4f5f0"
  paper: "#ffffff"
  board: "#0e1b33"
  board-2: "#1c2b4a"
  board-rule: "#2a3a5c"
  board-ink: "#f4f5f0"
  board-dim: "#c3ccdd"
  ink: "#0e1b33"
  ink-2: "#3f4a5f"
  rule: "#d7dacf"
  rule-strong: "#b9beb0"
  now: "#f2a900"
  now-ink: "#7a5600"
  now-wash: "#fff4d6"
  present: "#1e8e4e"
  present-ink: "#146b3a"
  absent: "#c62828"
  absent-ink: "#a01f1f"
  absent-wash: "#fcebea"
  unmarked: "#5b6478"
typography:
  display:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  headline:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.25
  title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.4
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  body-strong:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.25
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.4
  caption:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  cell: "6px"
  control: "8px"
  full: "9999px"
spacing:
  tight: "6px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.board-2}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.ground}"
  button-quiet:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.absent-ink}"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-danger-hover:
    backgroundColor: "{colors.absent-wash}"
  button-icon:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    size: "44px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "48px"
  roll-call-cell-unmarked:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "6px 8px"
    height: "64px"
  roll-call-cell-present:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
  roll-call-cell-late:
    backgroundColor: "{colors.now-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
  roll-call-cell-absent:
    backgroundColor: "{colors.absent-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
  choice-chip-selected:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    rounded: "{rounded.cell}"
    height: "44px"
  tab-bar:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    height: "64px"
  board-band:
    backgroundColor: "{colors.board}"
    textColor: "{colors.board-ink}"
    padding: "16px 16px 12px"
---

# Design System: Roma

## Overview

**Creative North Star: "The Departure Board"**

Roma reads like the board in a station hall: a deep navy band at the top says who holds which role now and what comes next, and below it a pale working ground carries the day's business in plain rows and packed cells. The system is built for a phone held in one hand outdoors, in the sun, by someone in a hurry. Density is high but never cramped: every tap target is at least 44px, rows are separated by 1px rules rather than boxed into cards, and the whole UI is one typeface whose numbers line up.

The world is light only, by decision: it is read in daylight, so there is no dark theme. Identity lives in the navy band (which continues into the phone's status bar through the theme colour), not in decoration. One warm colour, amber, means "now" and nothing else. Everything is flat: depth comes from the navy-versus-ground contrast and from rules, never from shadows. It refuses the generic white-cards-and-blue-accent team app.

**Key Characteristics:**
- Navy board band on top, light ground below, white paper for interactive surfaces.
- Amber is reserved for "now"; four fixed state colours for attendance.
- One face (Heebo), heavy weights for hierarchy, tabular figures everywhere.
- Square-ish corners (6px cells, 8px controls), 1px rules, no shadows.
- Hebrew RTL, logical properties only, 44px minimum tap targets.
- Destructive actions are set apart by space and rules, never next to the primary action.

## Colors

A cool navy-and-paper neutral base with one reserved warm signal and a strict set of attendance state colours.

### Primary
- **Board Navy** (board): the band at the top of every screen, primary buttons, the selected choice chip, the theme colour of the installed app. Also the body ink colour, so text and band are one navy.
- **Board Navy Raised** (board-2): primary-button hover and the hairline between board rows.
- **Board Rule** (board-rule): 1px rules inside the board band.
- **Board Ink / Board Dim** (board-ink, board-dim): primary and secondary text on navy. Board Dim carries the team name, column headers, "until" dates and the "tomorrow" line.

### Secondary
- **Now Amber** (now): the only accent. Used for the current role names and the day-and-clock on the board, the active tab's 3px top rule, the 4px underline under the live roll-call count, the late segment of tally bars, the late-cell border, focus rings, text selection and the caret.
- **Now Ink** (now-ink): the dark amber that carries "now" as text on the light ground (current role tags in the roster, the "current" assignment label, late status text).
- **Now Wash** (now-wash): fill of a late roll-call cell.

### Tertiary (state)
- **Present Green** (present / present-ink): present-cell border and tally segment; present-ink for "present" and "joined" text. Present has no wash by design (see The Four States Rule).
- **Absent Red** (absent / absent-ink / absent-wash): absent-cell border, danger-button border; absent-ink for danger text and errors; absent-wash for absent cells, error notices and danger hover.
- **Unmarked Slate** (unmarked): status text of a cell nobody has marked yet (paired with a dashed rule-strong border).

### Neutral
- **Working Ground** (ground): the page background under the board; also the pinned action bar.
- **Paper** (paper): inputs, outline buttons, roll-call cells, the tab bar, expanded edit panels, row hover.
- **Ink / Ink 2** (ink, ink-2): primary and secondary text on light surfaces.
- **Rule / Rule Strong** (rule, rule-strong): 1px dividers between rows and around lists; rule-strong for input borders, unmarked dashed cells and scrollbars.

### Named Rules
**The Now Rule.** Amber means "now": the current role, the active tab, the live count, the focused control. It never decorates, never fills a button, and never marks something that isn't current or in focus.

**The Sun Contrast Rule.** Bright amber (now) is never text on the light ground. On light surfaces "now" text uses now-ink; bright amber text appears only on the navy board.

**The Four States Rule.** Attendance has exactly four looks: unmarked is paper with a dashed rule-strong border; present is paper with a green border; late is now-wash with an amber border; absent is absent-wash with a red border. Present stays paper so the exceptions (late, absent) are the only washes on a full grid.

## Typography

**Display Font:** Heebo (with system-ui, sans-serif)
**Body Font:** Heebo
**Label/Mono Font:** none; one face throughout.

**Character:** One sturdy Hebrew sans doing everything, with hierarchy carried by weight (400 / 500 / 700 / 800) rather than by a second face. Tabular figures are on at the body level, so every count, time and date aligns like a board.

### Hierarchy
- **Display** (800, 2.5rem, line-height 1): the live roll-call count (present), with the total set smaller at 1.125rem / 500 in ink-2.
- **Brand** (800, 1.375rem in the team board, 1.75rem in the brand-only header): the "רומא" wordmark on navy.
- **Headline** (800, 1.5rem, 1.25): page titles such as the roll-call label, with the date beside it at 1rem / 500 in ink-2.
- **Title** (800, 1.25rem): section headings; more space above (32px) than below (12px).
- **Body** (400–500, 1rem, 1.5): list rows, links, inputs, button text (700 on buttons).
- **Body Strong** (700, 0.9375rem, 1.25): board rows and roll-call first names.
- **Label** (700, 0.875rem): field labels, collapsed edit-area summaries, back links.
- **Caption** (500, 0.75rem): board column headers, tab labels, secondary lines (last names, URLs, dates, role tags).

### Named Rules
**The One Face Rule.** Heebo only, tabular figures always. Hierarchy comes from weight and size, never from a second family, italics or letter-spacing.

## Layout

A single column on a light ground, centered at max 36rem (max-w-xl) inside the team area and 28rem (max-w-md) on sign-in, join and create screens, with a 16px side gutter. The navy board band runs full width on top and honours the top safe area; a fixed 64px tab bar sits at the bottom above the bottom safe area, and content is padded to clear it.

Lists are full-width rows divided by 1px rules with a rule above and below the list, each row at least 48–56px tall. Grids are used only where the content is a set of equal things: the roll-call roster (3 columns, 6px gaps) and the session-label chips (4 columns, 6px gaps). Spacing steps in practice: 6px inside grids, 8px and 12px between controls and rows, 16px gutter, 32px between sections. On the roll-call screen, the primary actions are pinned in a bar directly above the tab bar so they stay in thumb reach. Desktop is the same column, centered.

All direction is RTL and expressed with logical properties (start/end, ms/me, ps/pe).

## Elevation & Depth

Flat. There are no drop shadows anywhere. Depth comes from three tones (navy band, ground, white paper) and from 1px rules. The only box-shadow in the build is an inset 3px amber line used as the active tab's top rule, which is a rule, not elevation.

### Named Rules
**The Flat Board Rule.** Surfaces never lift. To separate something, change its tone (ground to paper) or draw a 1px rule.

## Shapes

Square-ish and quiet: 6px corners for cells, chips, error notices and the reason inputs; 8px for buttons, fields and expanded panels. The only fully rounded form is the 8px-tall tally bar. Borders are 1px; the dashed border is reserved for the unmarked roll-call cell. Heavier lines appear only as "now" markers (the 3px tab rule, the 4px count underline).

## Components

### Buttons
Solid and plain; size, padding and colour live only in the variant, never added at the call site, because utility classes don't override each other by order.
- **Shape:** 8px corners, 700 weight at 1rem, 8px icon gap.
- **Primary:** board navy with board-ink text, 48px tall, 20px inline padding; hover to board-2.
- **Outline:** paper with a 1px ink border and ink text, 48px; hover to ground. The partner to primary ("done", "mark the rest present", form submits that aren't the screen's main action).
- **Quiet:** text-only in ink-2, 44px, 12px padding; hover to paper and ink.
- **Danger:** paper with a 1px red border and absent-ink text, 48px; hover to absent-wash.
- **Icon / Icon-danger:** 44px squares, ink-2 or absent-ink, washing on hover.
- **Focus:** the global 3px amber outline with a 2px offset. **Disabled:** 50% opacity, not-allowed cursor. Pending state swaps the label for a loading string.

### Chips (session-label choice)
- **Style:** 44px paper cells with a 1px rule border, 6px corners, ink-2 at 0.875rem / 700.
- **State:** the checked chip fills with board navy and board-ink text. A radio set, one choice.

### Cards / Containers
There are no cards. Content sits directly on the ground in ruled lists. The one container is the expanded edit panel inside a roster row: paper, 8px corners, 12px padding.

### Inputs / Fields
- **Style:** 48px, paper, 1px rule-strong border, 8px corners, 12px inline padding; label above at 0.875rem / 700 with a 6px gap; optional hint in ink-2.
- **Focus:** the border turns board navy (the global amber focus ring applies on keyboard focus).
- **Error:** a 6px-cornered absent-wash notice with absent-ink text below the form, announced as an alert.

### Navigation
- **Tab bar:** fixed at the bottom, paper with a 1px top rule, four equal 64px tabs (lucide icon at 22px over a 0.75rem label). Inactive is ink-2 / 500 with 1.8 stroke; active is ink / 800 with 2.4 stroke and a 3px amber top rule.
- **Back link:** 0.875rem / 700 ink-2 with a chevron pointing to the start edge, hover to ink.

### Team Board (signature)
The navy band at the top of every team screen. Wordmark and team name on the start side, day and clock in bright amber on the end side. Below, a ruled table with columns role / on duty now / until: role names in amber 700, the holder in board-ink (bold with a dim "· me" tag when it's the viewer), the end date in board-dim. A final dim line lists tomorrow's role-holders. With nobody assigned, it shows a dim line and, for managers, an amber underlined link to assign.

### Roll-Call Grid (signature)
The roster as whole-name cells, 3 per row, each a 64px-minimum button: first name (0.9375rem / 700), last name (0.75rem, ink-2), then the status word (and reason) in the state's ink. Tapping cycles unmarked → present → late → absent → unmarked and plays a 360ms vertical flip (rotateX from -70deg, ease-out-expo) on the changed cell only, never on first render; reduced motion makes it instant. Above the grid: the display-size live count with its amber underline and a full-width tally bar (green present, amber late, on a rule track) that uses the same fixed scale in history rows so roll calls compare. Below: "mark the rest present" as an outline button, reason inputs for late and absent, and, after a large gap and a rule, the danger delete. The copy-summary primary and an outline "done" are pinned above the tab bar.

### Edit Area
A collapsed disclosure (44px summary, 0.875rem / 700 ink-2, chevron that turns on open). Adding comes first; removing sits 24px lower behind a 1px rule.

## Do's and Don'ts

### Do:
- **Do** keep amber for "now" only: current role, active tab, live count, focus ring.
- **Do** use now-ink, not bright amber, for "now" text on the ground or on paper.
- **Do** separate rows with 1px rules (rule) and lists with a rule above and below, instead of boxing them in cards.
- **Do** keep every tap target at 44px or taller; primary and outline buttons are 48px.
- **Do** put size, padding and colour in a button variant, and only layout (width, margin) at the call site.
- **Do** set destructive actions apart: below a rule with space above, or inside a collapsed edit area, never beside the primary action.
- **Do** use logical properties (start/end) for every direction.
- **Do** keep figures tabular and use lucide icons (18–22px) alongside text.

### Don't:
- **Don't** add drop shadows or lifted cards; the system is flat.
- **Don't** use bright amber (#f2a900) as text on the light ground.
- **Don't** fill present cells with a wash; only late and absent get washes.
- **Don't** add a dark theme; the app is light only for daylight use.
- **Don't** introduce a second typeface or carry hierarchy with letter-spacing or uppercase.
- **Don't** use left/right physical properties.
