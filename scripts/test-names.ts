// Unit checks for the name trainer. Run: npm run test:unit
import assert from "node:assert/strict";
import { cleanState, deckOf, emptyState, grade, learned, makeQuestion, nextCard, toCard, type Person } from "../src/lib/names.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};

const people: Person[] = [
  { id: 1, first_name: "נועה", last_name: "ברק", nickname: null },
  { id: 2, first_name: "איתי", last_name: "לוי", nickname: "איצ'ו" },
  { id: 3, first_name: "מאיה", last_name: "כהן", nickname: null },
  { id: 4, first_name: "נועה", last_name: "מזרחי", nickname: null },
  { id: 5, first_name: "דן", last_name: "", nickname: null }, // nothing to recall
  { id: 6, first_name: "שירה", last_name: "פרץ", nickname: "  " }, // blank nickname = none
];

// Cards ---------------------------------------------------------------------------
ok(() => assert.deepEqual(toCard(people[0]), { id: 1, cue: "נועה", answer: "ברק", full: "נועה ברק", last: "ברק", kind: "first" }));
ok(() => assert.deepEqual(toCard(people[1]), { id: 2, cue: "איצ'ו", answer: "איתי לוי", full: "איתי לוי", last: "לוי", kind: "nickname" }));
ok(() => assert.equal(toCard(people[4]), null));
ok(() => assert.equal(toCard(people[5])?.kind, "first"));
const deck = deckOf(people);
ok(() => assert.deepEqual(deck.map((c) => c.id), [1, 2, 3, 4, 6]));

// Spaced repetition -----------------------------------------------------------------
let s = emptyState();
ok(() => assert.equal(nextCard(deck, s)?.id, 1)); // unseen cards in roster order
s = grade(s, 1, true); // box 1, due at turn 1 + 2
ok(() => assert.deepEqual(s.progress[1], { box: 1, due: 3 }));
ok(() => assert.equal(nextCard(deck, s)?.id, 2)); // 1 is not due yet
s = grade(s, 2, false); // missed: box 1, back in 2 turns
ok(() => assert.deepEqual(s.progress[2], { box: 1, due: 4 }));
s = grade(s, 1, true); // box 2 → gap 4
ok(() => assert.deepEqual(s.progress[1], { box: 2, due: 7 }));
s = grade(s, 1, false); // a miss drops it back to box 1
ok(() => assert.equal(s.progress[1].box, 1));
ok(() => assert.notEqual(nextCard(deck, s, 3)?.id, 3)); // never the same card twice in a row
ok(() => assert.equal(nextCard([], s), null));
let top = emptyState();
for (let i = 0; i < 10; i++) top = grade(top, 3, true);
ok(() => assert.equal(top.progress[3].box, 5)); // capped
ok(() => assert.equal(learned(deck, top), 1));

// Stored state is cleaned ----------------------------------------------------------
ok(() => assert.deepEqual(cleanState(null, deck), emptyState()));
ok(() => assert.deepEqual(cleanState({ turn: 4, progress: { 1: { box: 9, due: 6 }, 99: { box: 1, due: 1 }, 3: "x" } }, deck), { turn: 4, progress: { 1: { box: 5, due: 6 } } }));
ok(() => assert.equal(cleanState({ turn: -3 }, deck).turn, 0));

// Quiz -----------------------------------------------------------------------------
const rand = (() => {
  let x = 0.3;
  return () => (x = (x * 9301 + 0.49297) % 1);
})();
const q = makeQuestion(deck, deck[0], rand); // "נועה": either Noa's family name is right
ok(() => assert.ok(q.options.includes("ברק")));
ok(() => assert.ok(!q.options.includes("מזרחי"))); // the other Noa is never a distractor
ok(() => assert.deepEqual([...q.correct].sort(), ["ברק", "מזרחי"]));
ok(() => assert.equal(new Set(q.options).size, q.options.length));
ok(() => assert.ok(q.options.every((o) => !o.includes(" ")))); // first-name cards ask for family names only
const nq = makeQuestion(deck, deck[1], rand); // a nickname card: full names from the whole deck
ok(() => assert.equal(nq.options.length, 4));
ok(() => assert.ok(nq.options.includes("איתי לוי") && nq.options.every((o) => o.includes(" "))));

console.log(`names: ${checks} checks passed`);
