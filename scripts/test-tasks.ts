// Unit checks for task checklists. Run: npm run test:unit
import assert from "node:assert/strict";
import { checklistAccess, parseSteps, sortSteps } from "../src/lib/tasks.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};

// Numbering, bullets and checkbox marks are stripped; blank lines dropped; text trimmed.
ok(() =>
  assert.deepEqual(parseSteps("1. לאסוף חומרים\n2) לכתוב טיוטה\n\n- להגיש\n• לבדוק\n[ ] לסכם\n  [x] לשלוח  "), [
    "לאסוף חומרים",
    "לכתוב טיוטה",
    "להגיש",
    "לבדוק",
    "לסכם",
    "לשלוח",
  ]),
);
// Digits that are part of the text stay.
ok(() => assert.deepEqual(parseSteps("3-4 עמודים\n2026 סיכום"), ["3-4 עמודים", "2026 סיכום"]));
// Windows line endings, 120 characters per step, at most 20 steps.
ok(() => assert.deepEqual(parseSteps("א\r\nב"), ["א", "ב"]));
ok(() => assert.equal(parseSteps("x".repeat(200))[0].length, 120));
ok(() => assert.equal(parseSteps(Array.from({ length: 30 }, (_, i) => `שלב ${i}`).join("\n")).length, 20));

// Saved order: position, then id.
ok(() =>
  assert.deepEqual(
    sortSteps([{ id: 3, position: 2 }, { id: 2, position: 1 }, { id: 1, position: 2 }]).map((x) => x.id),
    [2, 1, 3],
  ),
);

// Access mirrors private.checklist_access.
const base = { id: 1, title: "t", due_on: null, due_time: null, owner_id: null, created_at: "" };
const team = { ...base, visibility: "team", status: "open", assignee_member_id: 7 };
ok(() => assert.equal(checklistAccess(team, 1, true), "edit")); // command
ok(() => assert.equal(checklistAccess(team, 7, false), "tick")); // assignee
ok(() => assert.equal(checklistAccess(team, 8, false), "read")); // teammate
ok(() => assert.equal(checklistAccess({ ...team, assignee_member_id: null }, 7, false), "read")); // team-wide
ok(() => assert.equal(checklistAccess({ ...base, visibility: "private", status: "open", assignee_member_id: null }, 7, false), "edit"));
ok(() => assert.equal(checklistAccess({ ...team, status: "done" }, 1, true), "read")); // closed

console.log(`tasks: ${checks} checks passed`);
