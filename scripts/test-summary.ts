// Unit checks for the evening summary wording. Run: npm run test:unit
import assert from "node:assert/strict";
import { composeSummary } from "../src/lib/evening-summary.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};

ok(() => assert.equal(composeSummary({ teamName: "צוות 3", dueTomorrow: 0, newTeamTasksToday: 0, tomorrowRoles: [] }), null));

const full = composeSummary({
  teamName: "צוות 3",
  dueTomorrow: 2,
  newTeamTasksToday: 1,
  tomorrowRoles: [
    { role: "א׳ צוות", name: "נועה ברק", isMe: true },
    { role: "סמל", name: "איתי לוי", isMe: false },
  ],
});
ok(() => assert.equal(full?.title, "סיכום ערב · צוות 3"));
ok(() =>
  assert.equal(full?.body, "מחר את/ה א׳ צוות · 2 משימות למחר · משימת צוות חדשה היום · בתפקיד מחר: סמל איתי לוי"),
);

const one = composeSummary({ teamName: "x", dueTomorrow: 1, newTeamTasksToday: 3, tomorrowRoles: [] });
ok(() => assert.equal(one?.body, "משימה אחת למחר · 3 משימות צוות חדשות היום"));

console.log(`evening summary: ${checks} checks passed`);
