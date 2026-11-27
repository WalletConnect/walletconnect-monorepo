#!/usr/bin/env node
// Upsert one agent-owned block into a PR description.
//
// Usage: node upsert-pr-block.mjs <pr-number> <block-file>
//
// The block file declares which block it is with its own markers, e.g.
// `<!-- system-recap:start -->` ... `<!-- system-recap:end -->`. Known blocks,
// in the order they must appear in a description:
//
//   references    -> links backing the change
//   system-recap  -> the recap diagram
//   agent-context -> collapsed details for future agents
//
// Replaces the content between that pair of markers, or inserts the block in
// the right position on first run. Never touches text outside the markers.
// Requires `gh` authenticated against the repo; `gh` is run from the repo root
// resolved off this script's own location, so the caller's cwd does not matter.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..', '..', '..', '..');

const BLOCKS = ['references', 'system-recap', 'agent-context'];

const start = (name) => `<!-- ${name}:start -->`;
const end = (name) => `<!-- ${name}:end -->`;

function gh(args, opts = {}) {
  return execFileSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8', ...opts });
}

function countOccurrences(haystack, needle) {
  let n = 0;
  let idx = haystack.indexOf(needle);
  while (idx >= 0) {
    n += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return n;
}

const [prNumber, blockFile] = process.argv.slice(2);
if (!prNumber || !blockFile) {
  console.error('usage: upsert-pr-block.mjs <pr-number> <block-file>');
  process.exit(2);
}

const block = readFileSync(blockFile, 'utf8').trim();
const declared = /^<!--\s*([a-z0-9-]+):start\s*-->/.exec(block)?.[1];
if (!declared || !BLOCKS.includes(declared)) {
  console.error(`block file must start with one of: ${BLOCKS.map(start).join(', ')}`);
  process.exit(2);
}
const [START, END] = [start(declared), end(declared)];
if (!block.endsWith(END)) {
  console.error(`block file opens with "${START}" but does not end with "${END}"`);
  process.exit(2);
}

let body;
try {
  body = gh(['pr', 'view', prNumber, '--json', 'body', '--jq', '.body']);
} catch (err) {
  console.error(`upsert-pr-block: failed to read PR #${prNumber} body: ${err?.message ?? err}`);
  process.exit(1);
}

for (const marker of [START, END]) {
  if (countOccurrences(body, marker) > 1) {
    console.error(`PR body contains "${marker}" more than once; block markers must be unique. Fix the body manually first.`);
    process.exit(1);
  }
}

const startIdx = body.indexOf(START);
const endIdx = body.indexOf(END);
let newBody;
let action;
if (startIdx >= 0 && endIdx > startIdx) {
  newBody = body.slice(0, startIdx) + block + body.slice(endIdx + END.length);
  action = 'updated';
} else if (startIdx >= 0 || endIdx >= 0) {
  console.error(`PR body has a dangling "${declared}" marker; fix the body manually first.`);
  process.exit(1);
} else {
  const successor = BLOCKS.slice(BLOCKS.indexOf(declared) + 1)
    .map((name) => body.indexOf(start(name)))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];
  if (successor === undefined) {
    const existing = body.trimEnd();
    newBody = existing ? `${existing}\n\n${block}\n` : `${block}\n`;
    action = 'appended';
  } else {
    newBody = `${body.slice(0, successor).trimEnd()}\n\n${block}\n\n${body.slice(successor)}`;
    action = 'inserted';
  }
}

try {
  gh(['pr', 'edit', prNumber, '--body-file', '-'], { input: newBody });
} catch (err) {
  console.error(`upsert-pr-block: failed to update PR #${prNumber}: ${err?.message ?? err}`);
  process.exit(1);
}
console.log(`${action} ${declared} block in PR #${prNumber}`);
