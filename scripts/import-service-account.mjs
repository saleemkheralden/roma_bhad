// Imports a Google service-account JSON key into .env.local (GOOGLE_SA_EMAIL / GOOGLE_SA_KEY),
// and with --vercel also into Vercel (production + preview). Never prints the key.
// Usage: node scripts/import-service-account.mjs <path-to-key.json> [--vercel]
// Keep the JSON file outside this project folder, and delete it once imported.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [path, flag] = process.argv.slice(2);
if (!path) {
  console.error("usage: node scripts/import-service-account.mjs <key.json> [--vercel]");
  process.exit(1);
}

const json = JSON.parse(readFileSync(path, "utf8"));
const email = json.client_email;
const key = json.private_key;
if (json.type !== "service_account" || !email || !key?.includes("PRIVATE KEY")) {
  console.error("That file doesn't look like a Google service-account key (type: service_account).");
  process.exit(1);
}

// .env.local: replace any previous values.
const envPath = ".env.local";
const escaped = key.replace(/\r?\n/g, "\\n");
let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
env = env
  .split(/\r?\n/)
  .filter((line) => !/^GOOGLE_SA_(EMAIL|KEY)=/.test(line))
  .join("\n")
  .replace(/\n*$/, "\n");
env += `\n# Google service account (calendar read access). Never commit.\nGOOGLE_SA_EMAIL=${email}\nGOOGLE_SA_KEY="${escaped}"\n`;
writeFileSync(envPath, env);
console.log(`✓ .env.local: GOOGLE_SA_EMAIL=${email} and GOOGLE_SA_KEY (hidden)`);

if (flag === "--vercel") {
  const add = (name, value, target) => {
    const r = spawnSync("vercel", ["env", "add", name, target, "--force", "--sensitive"], {
      input: value,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    if (r.status !== 0) {
      console.error(`✗ vercel env add ${name} ${target} failed`);
      process.exitCode = 1;
    } else console.log(`✓ Vercel ${target}: ${name}`);
  };
  for (const target of ["production", "preview"]) {
    add("GOOGLE_SA_EMAIL", email, target);
    add("GOOGLE_SA_KEY", escaped, target);
  }
}

console.log(`\nShare each team calendar with ${email} ("See all event details").`);
