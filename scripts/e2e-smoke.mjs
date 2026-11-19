// End-to-end smoke test against the local stack (npm run dev + npx supabase start).
// Drives the installed Chrome with playwright-core; reads email codes from Mailpit.
// Usage: node scripts/e2e-smoke.mjs [screenshot-dir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const MAIL = "http://127.0.0.1:54324";
const OUT = process.argv[2] ?? ".impeccable/review";
mkdirSync(OUT, { recursive: true });

const PHONE = { width: 390, height: 844 };
const run = Date.now().toString(36);
const emailA = `a-${run}@roma.test`;
const emailB = `b-${run}@roma.test`;
const cadets = [
  ["נועה", "ברק"], ["איתי", "לוי"], ["מאיה", "כהן"], ["עומר", "דהן"], ["יונתן", "פרץ"], ["דניאל", "אזולאי"],
  ["שירה", "אבוטבול"], ["רון", "שפירא"], ["תמר", "גולן"], ["אלון", "מזרחי"], ["ליאור", "חדד"], ["עדי", "רוזן"],
];

const step = (msg) => console.log(`• ${msg}`);
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
};

async function otpFor(email) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages = [] } = await res.json();
    if (messages.length) {
      const msg = await (await fetch(`${MAIL}/api/v1/message/${messages[0].ID}`)).json();
      const code = (msg.Text || msg.HTML || "").match(/\b(\d{6})\b/);
      if (code) return code[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no OTP email for ${email}`);
}

async function signIn(page, email) {
  await page.goto(BASE);
  await page.waitForURL(/\/login/);
  await page.getByLabel("כתובת מייל").fill(email);
  await page.getByRole("button", { name: "שליחת קוד" }).click();
  const code = await otpFor(email);
  await page.getByLabel("קוד").fill(code);
  await page.getByRole("button", { name: "כניסה", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  // ---- A: create the team -------------------------------------------------
  const ctxA = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  await ctxA.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const a = await ctxA.newPage();
  const consoleErrors = [];
  a.on("pageerror", (e) => consoleErrors.push(String(e)));

  await a.goto(`${BASE}/login`);
  await a.screenshot({ path: `${OUT}/login.png` });
  step("login page");

  await signIn(a, emailA);
  step("A signed in");
  await a.getByRole("link", { name: "פתיחת צוות חדש" }).click();
  await a.getByLabel("שם הצוות").fill("צוות 3");
  await a.getByLabel("השם הפרטי שלך").fill("אבי");
  await a.getByLabel("שם המשפחה שלך").fill("כהן");
  await a.getByRole("button", { name: "פתיחת הצוות" }).click();
  await a.waitForURL(/\/t\/\d+\/team/);
  const teamUrl = new URL(a.url());
  const teamId = teamUrl.pathname.split("/")[2];
  step(`team created (${teamId})`);

  // One name through the single-add form, the rest pasted as a list.
  const [[first0, last0], ...pasted] = cadets;
  const addForm = a.locator("form", { has: a.getByRole("button", { name: "הוספת שם" }) });
  await addForm.getByLabel("שם פרטי").fill(first0);
  await addForm.getByLabel("שם משפחה").fill(last0);
  await addForm.getByRole("button", { name: "הוספת שם" }).click();
  await a.locator("li p", { hasText: `${first0} ${last0}` }).first().waitFor();

  await a.locator("summary", { hasText: "הדבקת רשימה" }).click();
  // Numbered lines, a tab-separated row (as pasted from a sheet) and a duplicate.
  const pasteText = [
    ...pasted.slice(0, 5).map(([f, l], i) => `${i + 1}. ${f} ${l}`),
    ...pasted.slice(5).map(([f, l]) => `${f}\t${l}`),
    `${first0} ${last0}`,
  ].join("\n");
  await a.getByLabel("שם בכל שורה").fill(pasteText);
  await a.getByRole("button", { name: "הוספת השמות" }).click();
  await a.getByText("נוספו 11 שמות (שם אחד כבר היה ברשימה)").waitFor();
  for (const [f, l] of pasted) await a.locator("li p", { hasText: `${f} ${l}` }).first().waitFor();
  step("1 cadet added + 11 pasted (numbering, tabs and a duplicate handled)");

  // Edit a name.
  await a.locator("summary", { hasText: "עדי רוזן" }).click();
  const editForm = a.locator("form", { has: a.getByRole("button", { name: "שמירת שם" }) }).filter({ has: a.locator('input[value="רוזן"]') });
  await editForm.getByLabel("שם משפחה").fill("רוזנברג");
  await editForm.getByRole("button", { name: "שמירת שם" }).click();
  await a.locator("li p", { hasText: "עדי רוזנברג" }).first().waitFor();
  await a.locator("summary", { hasText: "עדי רוזנברג" }).click(); // collapse
  step("name edited");

  await a.locator("summary", { hasText: "עריכת שיבוצים" }).click();
  const assign = a.locator("form", { has: a.getByRole("button", { name: "שיבוץ" }) });
  await assign.getByLabel("תפקיד").selectOption({ label: "א׳ צוות" });
  await assign.getByLabel("מי").selectOption({ label: "אבי כהן" });
  await assign.getByRole("button", { name: "שיבוץ" }).click();
  await a.locator("header").getByText("א׳ צוות").waitFor();
  step("role assigned to A for today");

  // Tomorrow's סמל, to exercise the board's next-up row.
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  await assign.getByLabel("תפקיד").selectOption({ label: "סמל" });
  await assign.getByLabel("מי").selectOption({ label: "איתי לוי" });
  await assign.getByLabel("מתאריך").fill(tomorrow);
  await assign.getByLabel("עד תאריך").fill(tomorrow);
  await assign.getByRole("button", { name: "שיבוץ" }).click();
  await a.locator("header").getByText(/מחר/).waitFor();
  step("tomorrow's role-holder shows on the board");
  const inviteCode = (await a.locator("p[dir=ltr]").first().innerText()).trim();
  await a.locator("summary", { hasText: "איתי לוי" }).click();
  await a.screenshot({ path: `${OUT}/team.png`, fullPage: true });

  // ---- A: roll call -------------------------------------------------------
  await a.getByRole("link", { name: "היום" }).click();
  await a.waitForURL(new RegExp(`/t/${teamId}$`));
  await a.getByRole("button", { name: "התחלה" }).waitFor();
  await a.screenshot({ path: `${OUT}/today-empty.png` });
  await a.getByRole("button", { name: "התחלה" }).click();
  await a.waitForURL(/\/attendance\/\d+/);
  step("roll call started");

  const cell = (first) => a.getByRole("button", { name: new RegExp(`^${first} `) });
  await cell("נועה").click(); // present
  await cell("יונתן").click();
  await cell("יונתן").click(); // late
  await cell("שירה").click();
  await cell("שירה").click();
  await cell("שירה").click(); // absent
  await a.getByRole("button", { name: /שאר נוכחים/ }).click();
  await a.getByRole("textbox", { name: "יונתן פרץ" }).fill("בדרך");
  await a.getByRole("textbox", { name: "שירה אבוטבול" }).fill("באישור");
  await a.waitForTimeout(1200); // reason debounce
  await a.evaluate(() => window.scrollTo(0, 0));
  await a.screenshot({ path: `${OUT}/mobile.png` });
  if (!(await a.getByRole("button", { name: /יונתן פרץ: מאחר, בדרך/ }).isVisible())) fail("reason not shown in the cell");

  // Keyboard focus survives a status change (the cell must not remount).
  await cell("רון").focus();
  await a.keyboard.press("Enter");
  const stillFocused = await a.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  if (!stillFocused.startsWith("רון")) fail(`focus lost after marking (active: ${stillFocused})`);
  await a.keyboard.press("Enter");
  await a.keyboard.press("Enter");
  await a.keyboard.press("Enter"); // back to present
  await a.waitForTimeout(1000);
  await a.screenshot({ path: `${OUT}/roll-call-full.png`, fullPage: true });

  // The page bottom must scroll clear of the pinned action bar.
  await a.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await a.waitForTimeout(300);
  const del = await a.getByRole("button", { name: "מחיקת הנוכחות" }).boundingBox();
  const bar = await a.getByRole("button", { name: "העתקת סיכום" }).boundingBox();
  if (!del || !bar || del.y + del.height > bar.y - 8) fail(`delete button hidden under the action bar (${del?.y}+${del?.height} vs ${bar?.y})`);
  await a.screenshot({ path: `${OUT}/roll-call-bottom.png` });

  await a.getByRole("button", { name: "העתקת סיכום" }).click();
  const summary = await a.evaluate(() => navigator.clipboard.readText());
  console.log("  summary:\n" + summary.replace(/^/gm, "    "));
  if (!summary.includes("נוכחים 11/13")) fail("summary count should be 11/13");
  if (!summary.includes("יונתן פרץ (בדרך)")) fail("late reason missing from summary");

  await a.reload();
  const count = await a.locator("[aria-live=polite]").innerText();
  if (!count.replace(/\s/g, "").startsWith("11/13")) fail(`count after reload is ${count}`);
  step("roll call persisted after reload");

  // ---- A: links -----------------------------------------------------------
  await a.goto(`${BASE}/t/${teamId}/links`);
  await a.getByLabel("שם").fill("יומן הצוות");
  await a.getByLabel("כתובת (https://…)").fill("https://calendar.google.com/");
  await a.getByLabel("קטגוריה (לא חובה)").fill("לו״ז");
  await a.getByRole("button", { name: "הוספת קישור" }).click();
  await a.getByRole("link", { name: /יומן הצוות/ }).first().waitFor();
  await a.screenshot({ path: `${OUT}/links.png` });
  step("link added");

  // ---- A: connect a calendar (public Israeli holidays calendar) -----------
  const holidays = "he.jewish#holiday@group.v.calendar.google.com";
  await a.goto(`${BASE}/t/${teamId}/team#calendar`);
  await a.locator("summary", { hasText: "חיבור היומן" }).click();
  const calForm = a.locator("form", { has: a.getByRole("button", { name: "חיבור היומן" }) });
  await calForm.getByLabel("יומן Google").fill("this is not a calendar");
  await calForm.getByRole("button", { name: "חיבור היומן" }).click();
  await a.getByText(/לא מצאנו מזהה יומן/).waitFor();
  const snippet = `<iframe src="https://calendar.google.com/calendar/embed?src=${encodeURIComponent(holidays)}&amp;ctz=Asia%2FJerusalem" style="border: 0" width="800" height="600"></iframe>`;
  await calForm.getByLabel("יומן Google").fill(snippet);
  await calForm.getByLabel(/^שם \(לא חובה/).fill("חגים");
  await calForm.getByRole("button", { name: "חיבור היומן" }).click();
  await a.locator("#calendar").getByText(holidays).first().waitFor();
  // With Roma's Google account connected (.env.local), Roma reads the calendar itself.
  const apiMode = (await a.locator("#calendar").getByText("נקרא ✓").count()) > 0;
  step(`calendar connected from a pasted <iframe> snippet (bad input rejected; ${apiMode ? "read by Roma's account" : "embed mode"})`);

  await a.goto(`${BASE}/t/${teamId}`);
  await a.getByRole("heading", { name: "יומן", exact: true }).waitFor();
  if (apiMode) {
    if (await a.locator('iframe[title="יומן הצוות"]').count()) fail("API mode should not use the embed");
    await a.getByText(/אין אירועים בימים הקרובים|כל היום|היום|מחר/).first().waitFor();
    await a.screenshot({ path: `${OUT}/today-calendar.png`, fullPage: true });
    step("Today shows the calendar as Roma's own agenda (no iframe)");
  } else {
    const frame = a.locator('iframe[title="יומן הצוות"]');
    await frame.waitFor();
    const frameSrc = new URL(await frame.getAttribute("src"));
    if (!frameSrc.searchParams.getAll("src").includes(holidays)) fail(`embed src missing the calendar: ${frameSrc}`);
    if (frameSrc.searchParams.get("ctz") !== "Asia/Jerusalem") fail("embed not in Israel time");
    await frame.scrollIntoViewIfNeeded();
    await a.waitForTimeout(4000); // let Google render the agenda
    await a.screenshot({ path: `${OUT}/today-calendar.png`, fullPage: true });
    step("Today embeds the calendar (agenda, Israel time)");
  }

  // ---- A: tasks ---------------------------------------------------------
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  const tomorrowIso = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  await a.goto(`${BASE}/t/${teamId}/tasks`);
  const newTask = async ({ title, team, assignee, due, time, steps }) => {
    await a.locator("summary", { hasText: "משימה חדשה" }).click();
    const form = a.locator("form", { has: a.getByRole("button", { name: "הוספה", exact: true }) });
    await form.getByLabel("מה צריך לעשות").fill(title);
    await form.getByText(team ? "משימת צוות" : "פרטית (רק אני)").click();
    if (team && assignee) await form.getByLabel("מבצע/ת").selectOption({ label: assignee });
    if (due) await form.getByLabel("תאריך יעד").fill(due);
    if (time) await form.getByLabel("שעה").fill(time);
    if (steps) {
      await form.getByRole("button", { name: "פירוק לשלבים" }).click();
      await form.getByLabel("שלבים (לא חובה)").fill(steps.join("\n"));
    }
    await form.getByRole("button", { name: "הוספה", exact: true }).click();
    await a.locator("summary", { hasText: "משימה חדשה" }).click(); // close
  };
  await newTask({
    title: "להגיש סיכום שיעור",
    team: true,
    assignee: "תמר גולן",
    due: todayIso,
    time: "14:00",
    steps: ["1. לאסוף סיכומים", "2. לכתוב טיוטה", "3. להגיש"],
  });
  await newTask({ title: "למלא משוב קורס", team: true, due: tomorrowIso });
  await newTask({ title: "להתקשר הביתה", team: false, due: todayIso });
  await a.goto(`${BASE}/t/${teamId}/tasks?view=team`);
  await a.getByText("להגיש סיכום שיעור").first().waitFor();
  await a.getByText("למלא משוב קורס").first().waitFor();
  await a.screenshot({ path: `${OUT}/tasks.png`, fullPage: true });
  step("A created two team tasks and a private one");

  // Personal views (issue #1): board layout, move a card with the one-thumb button, then back to list.
  await a.goto(`${BASE}/t/${teamId}/tasks`);
  await a.getByRole("radio", { name: "לוח" }).click();
  await a.locator('[data-lane="todo"] [data-card]', { hasText: "להתקשר הביתה" }).waitFor();
  await a.waitForLoadState("networkidle"); // the layout save refreshes the page; don't click a card mid-refresh
  await a.getByRole("button", { name: 'העברת "להתקשר הביתה" אל בתהליך' }).click();
  await a.locator('[data-lane="doing"] [data-card]', { hasText: "להתקשר הביתה" }).waitFor();
  await a.reload();
  if ((await a.getByRole("radio", { name: "לוח" }).getAttribute("aria-checked")) !== "true") fail("task layout not remembered");
  await a.locator('[data-lane="doing"] [data-card]', { hasText: "להתקשר הביתה" }).waitFor();
  await a.screenshot({ path: `${OUT}/tasks-board.png`, fullPage: true });
  await a.getByRole("radio", { name: "רשימה" }).click();
  await a.getByText("בתהליך", { exact: true }).first().waitFor(); // the list tags it too
  await a.waitForTimeout(500); // let the layout save before navigating
  await a.goto(`${BASE}/t/${teamId}/tasks?view=team`);
  step("A moved a task to in progress on their board; layout remembered");

  // Edit a team task's text and time.
  await a.getByRole("button", { name: "עריכת המשימה: להגיש סיכום שיעור" }).first().click();
  const taskEditForm = a.locator("form", { has: a.getByRole("button", { name: "שמירה", exact: true }) });
  await taskEditForm.getByLabel("מה צריך לעשות").fill("להגיש סיכום שיעור מתוקן");
  await taskEditForm.getByLabel("שעה").fill("15:00");
  await taskEditForm.getByRole("button", { name: "שמירה", exact: true }).click();
  await a.getByText("להגיש סיכום שיעור מתוקן").first().waitFor();
  await a.getByText("היום 15:00").first().waitFor();
  step("A edited a team task (text and time)");

  // Checklist: the steps were saved in order (numbering stripped); A adds and removes one.
  const summaryRow = a.locator("li", { has: a.getByRole("checkbox", { name: /להגיש סיכום שיעור מתוקן/ }) }).first();
  await summaryRow.getByRole("button", { name: /0\/3 שלבים/ }).click();
  const stepNames = await summaryRow.getByRole("checkbox", { name: /^סימון השלב/ }).allInnerTexts();
  if (stepNames.join("|") !== "לאסוף סיכומים|לכתוב טיוטה|להגיש") fail(`steps out of order: ${stepNames.join("|")}`);
  await summaryRow.getByPlaceholder("שלב חדש").fill("לבדוק שגיאות");
  await summaryRow.getByRole("button", { name: "הוספת שלב" }).click();
  await summaryRow.getByText("0/4 שלבים").waitFor();
  await summaryRow.getByRole("button", { name: "מחיקת שלבים" }).click();
  await summaryRow.getByRole("button", { name: "מחיקת השלב: לבדוק שגיאות" }).click();
  await summaryRow.getByText("0/3 שלבים").waitFor();
  step("A broke a task into steps (3 from the form, +1 added, 1 removed)");

  await a.goto(`${BASE}/t/${teamId}`);
  await a.getByText("המשימות שלי להיום").first().waitFor();
  if (!(await a.getByRole("checkbox", { name: /להתקשר הביתה/ }).first().isVisible())) fail("my day should list the private task due today");
  if (!(await a.getByText("נוספו היום לצוות").first().isVisible())) fail("catch-up should list team tasks added today");
  if (!(await a.getByText("למחר").first().isVisible())) fail("catch-up should list tasks due tomorrow");
  await a.screenshot({ path: `${OUT}/today-tasks.png`, fullPage: true });
  step("Today shows my day and the catch-up");

  await a.goto(`${BASE}/t/${teamId}/attendance`);
  await a.getByText("נוכחויות אחרונות").first().waitFor();
  await a.screenshot({ path: `${OUT}/attendance.png` });
  await a.goto(`${BASE}/t/${teamId}`);
  await a.getByRole("link", { name: "המשך הנוכחות" }).waitFor();
  await a.screenshot({ path: `${OUT}/today.png` });

  // Desktop width of the today screen
  const desk = await ctxA.newPage();
  await desk.setViewportSize({ width: 1440, height: 900 });
  await desk.goto(`${BASE}/t/${teamId}`);
  await desk.getByRole("link", { name: "המשך הנוכחות" }).waitFor();
  await desk.screenshot({ path: `${OUT}/desktop.png`, fullPage: true });
  await desk.close();

  // ---- B: join and claim a name ------------------------------------------
  const ctxB = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const b = await ctxB.newPage();
  b.on("pageerror", (e) => consoleErrors.push(String(e)));
  await signIn(b, emailB);
  await b.goto(`${BASE}/join?code=${inviteCode}`);
  await b.getByText("תמר גולן").click();
  await b.screenshot({ path: `${OUT}/join.png` });
  await b.getByRole("button", { name: "הצטרפות בתור תמר גולן" }).click();
  await b.waitForURL(new RegExp(`/t/${teamId}$`));
  step("B joined and claimed תמר גולן");
  const visible = (loc) => loc.waitFor({ timeout: 10_000 }).then(() => true, () => false);
  if (!(await visible(b.getByRole("link", { name: "המשך הנוכחות" })))) fail("B should see today's roll call");
  if (await b.locator("summary", { hasText: "נוכחות חדשה" }).count()) fail("B (no role) is offered a new roll call");
  if (await b.getByRole("button", { name: "התחלה" }).count()) fail("B sees a start-roll-call button");
  await b.goto(`${BASE}/t/${teamId}/attendance`);
  await b.getByRole("link", { name: /בוקר|צהריים|ערב/ }).first().click();
  await b.waitForURL(/\/attendance\/\d+/);
  if (!(await visible(b.getByText(/צפייה בלבד/)))) fail("B should see roll call read-only");
  await b.screenshot({ path: `${OUT}/roll-call-readonly.png` });
  step("B sees roll call read-only");

  // ---- B: sees the calendar, cannot connect one ----------------------------
  await b.goto(`${BASE}/t/${teamId}`);
  await b.getByRole("heading", { name: "יומן", exact: true }).waitFor();
  await b.goto(`${BASE}/t/${teamId}/team`);
  await b.getByText("יומן הצוות").first().waitFor();
  if (await b.locator("summary", { hasText: "חיבור היומן" }).count()) fail("B can connect a calendar");
  step("B sees the team calendar but cannot change it");

  // ---- B: tasks ---------------------------------------------------------
  await b.goto(`${BASE}/t/${teamId}/tasks`);
  const bTask = b.getByRole("checkbox", { name: /להגיש סיכום שיעור/ });
  await bTask.waitFor();
  if (await b.getByRole("button", { name: /^עריכת המשימה: להגיש/ }).count()) fail("B can edit a team task");
  if (await b.getByText("להתקשר הביתה").count()) fail("B can see A's private task");
  await b.locator("summary", { hasText: "משימה חדשה" }).click();
  if (await b.getByText("משימת צוות", { exact: true }).count()) fail("B (no role) is offered a team task");
  await b.locator("summary", { hasText: "משימה חדשה" }).click();
  // Checklist: B (the assignee) ticks a step but can't add or remove steps.
  const bRow = b.locator("li", { has: bTask }).first();
  await bRow.getByRole("button", { name: /0\/3 שלבים/ }).click();
  await bRow.getByRole("checkbox", { name: "סימון השלב כבוצע: לאסוף סיכומים" }).click();
  await bRow.getByText("1/3 שלבים").waitFor();
  if (await bRow.getByRole("button", { name: "הוספת שלב" }).count()) fail("B (assignee) can add steps");
  if (await bRow.getByRole("button", { name: "מחיקת שלבים" }).count()) fail("B (assignee) can remove steps");
  await b.waitForTimeout(800);
  await b.reload();
  await b.locator("li", { has: bTask }).first().getByText("1/3 שלבים").waitFor();
  step("B ticks a step of their task (1/3, persisted), cannot add or remove steps");
  // Team-wide task: B marks their own part, and can't mark anyone else.
  await b.getByRole("checkbox", { name: /סימון החלק שלי כבוצע: למלא משוב קורס/ }).click();
  await b.getByText("1/13 סיימו").first().waitFor();
  await b.getByRole("button", { name: "מי סיים" }).first().click();
  if (!(await b.getByRole("button", { name: "סימון נועה ברק כסיים/ה" }).isDisabled())) fail("B can mark another cadet");
  if (await b.getByRole("button", { name: "סגירת המשימה לכולם" }).count()) fail("B can close a team-wide task");
  step("B marks their own part of a team-wide task (1/13), not others'");
  await bTask.click();
  await b.waitForTimeout(800);
  await b.reload();
  await b.locator("summary", { hasText: "הושלמו" }).click();
  const checked = await b.getByRole("checkbox", { name: /להגיש סיכום שיעור/ }).getAttribute("aria-checked");
  if (checked !== "true") fail(`B's done task did not persist (aria-checked=${checked})`);
  await b.screenshot({ path: `${OUT}/tasks-cadet.png`, fullPage: true });
  step("B ticks their assigned task; sees no private or team-create options");

  // ---- A: marks a cadet without a phone, then closes the team-wide task ----
  await a.goto(`${BASE}/t/${teamId}/tasks?view=team`);
  await a.getByText("1/13 סיימו").first().waitFor();
  await a.getByRole("button", { name: "מי סיים" }).first().click();
  await a.getByRole("button", { name: "סימון עדי רוזנברג כסיים/ה" }).click();
  await a.getByText("2/13 סיימו").first().waitFor();
  await a.waitForTimeout(600);
  await a.screenshot({ path: `${OUT}/tasks-team-wide.png`, fullPage: true });
  await a.getByRole("button", { name: "סגירת המשימה לכולם" }).click();
  await a.locator("summary", { hasText: "הושלמו" }).waitFor();
  step("command marked a cadet (2/13) and closed the task");

  // ---- Company level ---------------------------------------------------------
  await a.goto(`${BASE}/t/${teamId}/team#company`);
  await a.locator("summary", { hasText: "פתיחת פלוגה חדשה" }).click();
  const coForm = a.locator("form", { has: a.getByRole("button", { name: "פתיחת הפלוגה" }) });
  await coForm.getByLabel("שם הפלוגה").fill("פלוגה ב׳");
  await coForm.getByRole("button", { name: "פתיחת הפלוגה" }).click();
  await a.waitForURL(/\/c\/\d+$/);
  const companyUrl = a.url();
  const card = a.locator("li", { has: a.getByRole("heading", { name: "צוות 3" }) });
  await card.waitFor();
  if (!(await card.getByText("11/13 נוכחים").count())) fail("dashboard should show the team's roll call (11/13)");
  if (!(await card.getByText("שירה אבוטבול").count())) fail("dashboard should list the absentee");
  const companyCode = (await a.locator("p[dir=ltr]").first().innerText()).trim();
  await a.screenshot({ path: `${OUT}/company.png`, fullPage: true });
  step("team admin created a company; dashboard shows the team's roll call and absentees");

  const bCo = await b.goto(companyUrl);
  if (bCo?.status() !== 404 && (await b.getByRole("heading", { name: "צוות 3" }).count())) fail("a non-member sees the company dashboard");
  await b.goto(`${BASE}/join?code=${companyCode}`);
  await b.getByLabel("השם שלך בפלוגה").fill("תמר גולן");
  await b.getByRole("button", { name: "הצטרפות לפלוגה" }).click();
  await b.waitForURL(/\/c\/\d+$/);
  await b.getByRole("heading", { name: "צוות 3" }).waitFor();
  if (await b.locator("summary", { hasText: "עריכת תפקידים פלוגתיים" }).count()) fail("a plain company member can manage roles");
  step("company: hidden from non-members; joined with the code, read-only for a plain member");

  // ---- Icons are served -------------------------------------------------
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/apple-icon.png", "/icon.png"]) {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok || !res.headers.get("content-type")?.includes("image/png")) fail(`${path} not served as PNG`);
  }
  const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
  if (!manifest.icons?.some((i) => i.purpose === "maskable")) fail("manifest has no maskable icon");
  step("icons and manifest served");

  // ---- Signed-out access is redirected -----------------------------------
  const ctxC = await browser.newContext();
  const c = await ctxC.newPage();
  await c.goto(`${BASE}/t/${teamId}/team`);
  if (!c.url().includes("/login")) fail("signed-out visitor was not redirected to /login");
  step("signed-out visitor redirected to login");

  if (consoleErrors.length) fail(`page errors: ${consoleErrors.join(" | ")}`);
  console.log(process.exitCode ? "\nSMOKE: FAIL" : "\nSMOKE: PASS");
} finally {
  await browser.close();
}
