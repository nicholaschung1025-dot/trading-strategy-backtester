import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './helpers.mjs';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const app = read('src/app.js');
const charts = read('src/charts.js');
const engine = read('src/engine.js');
const util = read('src/util.js');
const server = read('server.py');
const fn = read('functions/api/yahoo.js');
const appSources = { 'src/app.js': app, 'src/charts.js': charts, 'src/engine.js': engine, 'src/util.js': util };

test('no analytics, beacons or third party endpoints', () => {
  const banned = [
    /googletagmanager/i, /google-analytics/i, /gtag\(/i, /segment\.io/i,
    /mixpanel/i, /sentry\.io/i, /hotjar/i, /navigator\.sendBeacon/i,
    /new\s+WebSocket/i, /EventSource/i, /document\.cookie/i,
  ];
  Object.entries({ ...appSources, 'index.html': html, 'functions/api/yahoo.js': fn }).forEach(([file, src]) => {
    banned.forEach((re) => {
      assert.equal(re.test(src), false, `${file} must not use ${re}`);
    });
  });
});

test('the only network call is the Yahoo proxy', () => {
  const calls = [...app.matchAll(/fetch\(([^)]*)\)/g)].map((m) => m[1]);
  assert.equal(calls.length, 1, 'exactly one fetch call is expected');
  assert.match(calls[0], /endpoint/, 'the fetch must go through the resolved proxy endpoint');
  // no hard coded hosts in the shipped code (comments are ignored)
  const code = Object.values(appSources).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const hosts = [...code.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((m) => m[0]);
  const allowed = ['https://127.0.0.1:8765', 'http://127.0.0.1:8765'];
  hosts.forEach((h) => {
    assert.ok(allowed.includes(h), `unexpected hard coded host: ${h}`);
  });
});

test('local storage only holds the three known preferences', () => {
  const code = Object.values(appSources).join('\n');
  const constants = new Map([...code.matchAll(/([A-Z_]+_KEY)\s*=\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  const keys = new Set();
  Object.values(appSources).forEach((src) => {
    [...src.matchAll(/localStorage\.(setItem|getItem|removeItem)\(([^)]*)\)/g)].forEach((m) => {
      let key = m[2].split(',')[0].trim().replace(/^['"]|['"]$/g, '');
      if (constants.has(key)) key = constants.get(key);
      if (key) keys.add(key);
    });
  });
  const allowed = ['falcon-theme', 'falcon-bg-anim', 'falcon-api-base'];
  keys.forEach((k) => {
    assert.ok(allowed.includes(k), `unexpected localStorage key: ${k}`);
  });
  allowed.forEach((k) => {
    assert.ok([...constants.values()].includes(k), `expected preference key ${k}`);
  });
});

test('CSV files are read in the browser and never uploaded', () => {
  assert.match(app, /new FileReader\(\)/, 'CSV must be read with FileReader');
  assert.match(app, /readAsText/, 'CSV must be read as text');
  assert.equal(/FormData|multipart|XMLHttpRequest|\/upload/.test(app), false, 'no upload path may exist');
});

test('the server never logs query strings and hashes client addresses', () => {
  assert.match(server, /def log_message/, 'log_message must be overridden');
  assert.match(server, /split\("\?", 1\)\[0\]/, 'the query string must be stripped before logging');
  assert.match(server, /client_key/, 'the rate limiter must use a pseudonymous key');
  assert.match(server, /hashlib\.sha256/, 'client keys must be hashed');
  assert.equal(/self\.client_address\[0\]\s*\)\s*$/.test(server), false);
  assert.match(server, /rate_limited\(client_key\(client\)\)/, 'the raw address must not reach the limiter');
});

test('the server sends hardening headers', () => {
  ['Content-Security-Policy', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Frame-Options', 'Permissions-Policy']
    .forEach((h) => assert.match(server, new RegExp(h), `missing header ${h}`));
  assert.match(server, /frame-ancestors 'none'/);
});

test('the Pages function caches nothing and logs nothing', () => {
  assert.match(fn, /'Cache-Control': 'no-store'/);
  assert.equal(/console\./.test(fn), false, 'the function must not log');
  assert.match(fn, /SYMBOL_RE/, 'symbols must be validated');
  assert.match(fn, /PERIOD_YEARS/, 'periods must be validated');
});

test('the page has no inline script, style attribute or event handler', () => {
  assert.equal(/<script(?![^>]*\bsrc=)/i.test(html), false, 'no inline script block may remain');
  assert.equal(/\son[a-z]+=/i.test(html), false, 'no inline event handler may remain');
  assert.equal(/\sstyle="/i.test(html), false, 'no inline style attribute may remain');
});

test('untrusted values are escaped before they reach innerHTML', () => {
  // the file name of an uploaded CSV ends up in state.meta - it is the only
  // value in the app that comes from outside.
  const sinks = [...app.matchAll(/innerHTML\s*=\s*([^;]+);/g)].map((m) => m[1]);
  sinks.filter((expr) => /state\.meta/.test(expr)).forEach((expr) => {
    assert.match(expr, /esc\(/, `unescaped state.meta interpolation: ${expr.slice(0, 80)}`);
  });
  // every renderer that builds markup from data escapes it
  assert.match(app, /function statTile\([\s\S]*?esc\(k\)/, 'statTile must escape its label');
  assert.match(app, /esc\(t\.reason\)/, 'trade rows must escape the reason');
  assert.match(app, /esc\(state\.meta\.ticker\)/, 'the compare note must escape the ticker');
  assert.match(charts, /esc\(h\)/, 'data table headers must be escaped');
  assert.match(charts, /esc\(c\)/, 'data table cells must be escaped');
  assert.match(charts, /esc\(tr\.reason\)/, 'the chart tooltip must escape the reason');
  assert.match(util, /function esc/, 'an escape helper must exist');
});
