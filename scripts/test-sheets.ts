// Unit checks for the Sheets helpers. Run: npm run test:unit
import assert from "node:assert/strict";
import { a1Range, decodeSheetRef, encodeSheetRef, filterRows, parseSheetInput, toTable, MAX_ROWS } from "../src/lib/sheets.ts";

let checks = 0;
const ok = (fn: () => void) => {
  fn();
  checks++;
};

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-xyz";

// Parsing pasted input ------------------------------------------------------------
ok(() => assert.deepEqual(parseSheetInput(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=12345`), { spreadsheetId: ID, gid: 12345, range: null }));
ok(() => assert.deepEqual(parseSheetInput(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`), { spreadsheetId: ID, gid: null, range: null }));
ok(() => assert.deepEqual(parseSheetInput(`https://docs.google.com/spreadsheets/d/${ID}/htmlview?gid=7`), { spreadsheetId: ID, gid: 7, range: null }));
ok(() => assert.deepEqual(parseSheetInput(`  ${ID}  `, " a1:f40 "), { spreadsheetId: ID, gid: null, range: "A1:F40" }));
ok(() => assert.equal(parseSheetInput("https://example.com/whatever"), null));
ok(() => assert.equal(parseSheetInput("short"), null));
ok(() => assert.equal(parseSheetInput(ID, "A1:F40; DROP"), null));

// Stored identifier round-trips ----------------------------------------------------
ok(() => assert.equal(encodeSheetRef({ spreadsheetId: ID, gid: 0, range: null }), `${ID}#gid=0`));
ok(() => assert.equal(encodeSheetRef({ spreadsheetId: ID, gid: 9, range: "B2:D20" }), `${ID}#gid=9&range=B2:D20`));
ok(() => assert.deepEqual(decodeSheetRef(`${ID}#gid=9&range=B2:D20`), { spreadsheetId: ID, gid: 9, range: "B2:D20" }));
ok(() => assert.deepEqual(decodeSheetRef(ID), { spreadsheetId: ID, gid: null, range: null }));
ok(() => assert.deepEqual(decodeSheetRef(encodeSheetRef({ spreadsheetId: ID, gid: null, range: "A1:B2" })), { spreadsheetId: ID, gid: null, range: "A1:B2" }));
ok(() => assert.equal(decodeSheetRef("bad id!"), null));

// A1 ranges ----------------------------------------------------------------------
ok(() => assert.equal(a1Range("רשימה", null), `'רשימה'!A1:O${MAX_ROWS}`));
ok(() => assert.equal(a1Range("It's", "A1:C5"), "'It''s'!A1:C5"));

// Tables -------------------------------------------------------------------------
const t = toTable([[], ["שם", "תפקיד", "", ""], ["נועה ברק", "קל\"ג"], ["", ""], ["איתי", "", "הערה"]]);
ok(() => assert.deepEqual(t.header, ["שם", "תפקיד", "3"])); // width from the widest row, blank headers numbered
ok(() => assert.deepEqual(t.rows, [["נועה ברק", "קל\"ג", ""], ["איתי", "", "הערה"]]));
ok(() => assert.equal(t.truncated, false));
ok(() => assert.deepEqual(toTable(undefined), { header: [], rows: [], truncated: false }));
ok(() => assert.deepEqual(toTable([["a", 5, null, true]]).header, ["a", "5", "3", "true"])); // non-strings become text
const big = toTable(Array.from({ length: MAX_ROWS + 5 }, (_, i) => [`r${i}`]));
ok(() => assert.equal(big.rows.length, MAX_ROWS - 1));
ok(() => assert.equal(big.truncated, true));
ok(() => assert.equal(toTable([Array.from({ length: 20 }, (_, i) => `c${i}`)]).header.length, 15));

// Search -------------------------------------------------------------------------
const rows = [["נועה ברק", "צוות 1"], ["איתי לוי", "צוות 2"], ["מאיה ברק", "צוות 2"]];
ok(() => assert.equal(filterRows(rows, "").length, 3));
ok(() => assert.deepEqual(filterRows(rows, "ברק 2"), [["מאיה ברק", "צוות 2"]]));
ok(() => assert.equal(filterRows(rows, "zzz").length, 0));

console.log(`sheets: ${checks} checks passed`);
