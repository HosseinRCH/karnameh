#!/usr/bin/env node
/**
 * RTL guard: fails if physical (direction-specific) Tailwind utilities appear in
 * the web source. Karnameh is RTL-first — use logical properties instead:
 *   ms-* / me-* / ps-* / pe-* / start-* / end-* / text-start / text-end
 *   border-s / border-e / rounded-s / rounded-e
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', 'apps', 'web', 'src');

const RULES = [
  { re: /\b(?:pl|pr|ml|mr)-\d/g, msg: 'physical padding/margin (use ps/pe/ms/me)' },
  { re: /\btext-(?:left|right)\b/g, msg: 'physical text-align (use text-start/text-end)' },
  { re: /\b(?:left|right)-\d/g, msg: 'physical inset (use start-*/end-*)' },
  { re: /\bborder-(?:l|r)\b/g, msg: 'physical border (use border-s/border-e)' },
  { re: /\brounded-(?:l|r)\b/g, msg: 'physical radius (use rounded-s/rounded-e)' },
  { re: /\bfloat-(?:left|right)\b/g, msg: 'physical float' },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (['.ts', '.tsx'].includes(extname(full))) yield full;
  }
}

let violations = 0;
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      if (rule.re.test(line)) {
        violations += 1;
        console.error(`${file}:${i + 1}  ${rule.msg}  ->  ${line.trim()}`);
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nRTL check failed: ${violations} physical-direction utilit(ies) found.`);
  process.exit(1);
}
console.log('RTL check passed: no physical-direction utilities.');
