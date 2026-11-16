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

  for (const [first, last] of cadets) {
    const form = a.locator("form", { has: a.getByRole("button", { name: "הוספת שם" }) });
    await form.getByLabel("שם פרטי").fill(first);
    await form.getByLabel("שם משפחה").fill(last);
    await form.getByRole("button", { name: "הוספת שם" }).click();
    await a.locator("li p", { hasText: `${first} ${last}` }).first().waitFor();
  }
  step("12 cadets added");

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
