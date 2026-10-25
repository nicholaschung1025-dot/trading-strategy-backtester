/* Lightweight lint: syntax check every script and look for common mistakes. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const problems = [];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return [full];
  });
}

const files = walk(ROOT).filter((f) => /\.(m?js)$/.test(f));

for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  if (source.charCodeAt(0) === 0xfeff) problems.push(`${rel}: has a UTF-8 BOM`);
  if (rel !== SELF) {
    if (/\bdebugger\b/.test(source)) problems.push(`${rel}: contains a debugger statement`);
    if (/\bconsole\.log\(/.test(source) && !rel.startsWith('tests/')) {
      problems.push(`${rel}: contains console.log`);
    }
  }
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems.push(`${rel}: ${String(err.stderr || err.message).split('\n')[0]}`);
  }
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const m of html.matchAll(/<script src="([^"]+)"/g)) {
  const target = path.join(ROOT, m[1]);
  if (!fs.existsSync(target)) problems.push(`index.html: missing script ${m[1]}`);
}
for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
  const target = path.join(ROOT, m[1]);
  if (!fs.existsSync(target)) problems.push(`index.html: missing stylesheet ${m[1]}`);
}
if (/<style[\s>]/.test(html)) problems.push('index.html: inline <style> block found (move it to styles.css)');
if (/\son[a-z]+=/.test(html)) problems.push('index.html: inline event handler found');

if (problems.length) {
  console.error('lint failed:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log(`lint ok — ${files.length} scripts checked`);
