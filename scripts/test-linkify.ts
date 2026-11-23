// Unit checks for turning links in free text into tappable links. Run: npm run test:unit
import assert from "node:assert/strict";
import { linkify } from "../src/lib/linkify.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};
const links = (s: string) => linkify(s).flatMap((p) => (p.kind === "link" ? [p.href] : []));

// Plain text stays one piece.
ok(() => assert.deepEqual(linkify("בלי קישורים"), [{ kind: "text", text: "בלי קישורים" }]));
// A link inside Hebrew text, text kept around it.
ok(() =>
  assert.deepEqual(linkify("טופס: https://forms.gle/abc123 עד הערב"), [
    { kind: "text", text: "טופס: " },
    { kind: "link", text: "https://forms.gle/abc123", href: "https://forms.gle/abc123" },
    { kind: "text", text: " עד הערב" },
  ]),
);
// Sentence punctuation is not part of the link.
ok(() => assert.deepEqual(links("ראו https://example.com/a."), ["https://example.com/a"]));
ok(() => assert.deepEqual(links("(https://example.com/a)"), ["https://example.com/a"]));
// A bracket that belongs to the link stays.
ok(() => assert.deepEqual(links("https://en.wikipedia.org/wiki/Foo_(bar)"), ["https://en.wikipedia.org/wiki/Foo_(bar)"]));
// Bare www. opens as https.
ok(() => assert.deepEqual(links("www.example.com/x"), ["https://www.example.com/x"]));
// Several links, query strings kept.
ok(() => assert.deepEqual(links("a https://x.co/1?a=1&b=2 b http://y.co"), ["https://x.co/1?a=1&b=2", "http://y.co"]));
// Never other schemes.
ok(() => assert.deepEqual(links("javascript:alert(1) mailto:a@b.co data:text/html,x"), []));
// Text round-trips exactly.
ok(() => {
  const s = "שלב 1: https://a.co/x, שלב 2: www.b.co!";
  assert.equal(linkify(s).map((p) => p.text).join(""), s);
});

console.log(`linkify: ${checks} checks passed`);
