#!/usr/bin/env node
// Asserts that every rule in .semgrep.yml fires on at least one canary file.
//
// A Semgrep rule that matches nothing looks exactly like a Semgrep rule that
// passes. This turns that silence into a failure: reads `semgrep --json` on
// docs/semgrep-canaries/ from stdin, and exits non-zero if any declared rule id
// produced no findings there.

import { readFileSync } from "node:fs";

const CONFIG = ".semgrep.yml";
const CANARY_DIR = "docs/semgrep-canaries";

// Rule ids are one per `- id:` entry; good enough for a file we control, and it
// avoids taking a YAML parser as a dependency just for this.
const declared = [...readFileSync(CONFIG, "utf8").matchAll(/^\s*-\s+id:\s*(\S+)/gm)].map(
  (m) => m[1],
);

const stdin = readFileSync(0, "utf8").trim();
if (!stdin) {
  console.error(`✖ no Semgrep output — is semgrep installed and did it scan ${CANARY_DIR}/?`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(stdin);
} catch {
  console.error("✖ could not parse Semgrep JSON. Raw output:\n" + stdin.slice(0, 2000));
  process.exit(1);
}

if (report.errors?.length) {
  console.error("✖ Semgrep reported errors:");
  for (const e of report.errors) console.error("   " + (e.long_msg ?? e.message ?? JSON.stringify(e)));
  process.exit(1);
}

const hits = new Map(declared.map((id) => [id, 0]));
for (const f of report.results ?? []) {
  // check_id is namespaced when run via --config; the last segment is the id.
  const id = f.check_id.split(".").pop();
  if (hits.has(id)) hits.set(id, hits.get(id) + 1);
}

const silent = declared.filter((id) => hits.get(id) === 0);

for (const id of declared) {
  const n = hits.get(id);
  console.log(`${n > 0 ? "✔" : "✖"} ${id} — ${n} canary hit${n === 1 ? "" : "s"}`);
}

if (silent.length) {
  console.error(
    `\n✖ ${silent.length} rule(s) matched nothing in ${CANARY_DIR}/: ${silent.join(", ")}\n` +
      `  Either the rule is broken, or it needs a canary. A rule that never fires\n` +
      `  is not protecting anything — see ${CANARY_DIR}/README.md.`,
  );
  process.exit(1);
}

console.log(`\n✔ all ${declared.length} rules fire on canaries`);
