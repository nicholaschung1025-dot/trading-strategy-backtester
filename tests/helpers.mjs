import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..');

/**
 * Load the browser modules in a sandbox so the engine can be unit tested in
 * Node. Only the pure modules are loaded (no DOM, no canvas).
 */
export function loadFalcon() {
  const sandbox = {
    console, setTimeout, clearTimeout, setInterval, clearInterval,
    Math, Date, JSON, Number, String, Array, Object, Boolean, Error,
    isNaN, isFinite, parseInt, parseFloat, RegExp, Promise, Map, Set,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  ['src/util.js', 'src/indicators.js', 'src/state.js', 'src/engine.js'].forEach((file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  });
  return sandbox.Falcon;
}

/** Relative luminance per WCAG 2.1. Accepts a parsed colour. */
export function luminance(color) {
  const [r, g, b] = parseColor(color).slice(0, 3).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Composite a translucent colour over an opaque backdrop. */
export function composite(fg, bg) {
  const [fr, fg2, fb, fa = 1] = parseColor(fg);
  const [br, bg2, bb, ba = 1] = parseColor(bg);
  const a = fa * ba;
  return [
    (fr * fa + br * (1 - fa)) / (a || 1),
    (fg2 * fa + bg2 * (1 - fa)) / (a || 1),
    (fb * fa + bb * (1 - fa)) / (a || 1),
    1,
  ];
}

/** Contrast ratio between two colours; translucent colours are composited over `over`. */
export function contrast(a, b, over = '#ffffff') {
  const la = luminance(composite(a, over));
  const lb = luminance(composite(b, over));
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Parse #rgb, #rrggbb, rgb(a b c) and rgb(a,b,c) into [r,g,b,a] 0..1. */
export function parseColor(value) {
  if (Array.isArray(value)) return value;
  const v = String(value).trim().toLowerCase();
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).concat(1);
  }
  const nums = v.match(/[\d.]+/g);
  if (!nums) throw new Error(`unsupported color: ${value}`);
  const parts = nums.map(Number);
  const alpha = parts.length > 3 ? parts[3] : 1;
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, alpha];
}

/** Parse the token blocks out of styles.css: { theme: { token: value } }. */
export function readThemeTokens(css) {
  const themes = {};
  const blockRe = /(:root|\[data-theme="([a-z]+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(css))) {
    const name = m[2] || 'ember';
    const tokens = {};
    m[3].replace(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi, (_, k, v) => {
      tokens[k] = v.trim();
      return '';
    });
    themes[name] = Object.assign(themes[name] || {}, tokens);
  }
  return themes;
}
