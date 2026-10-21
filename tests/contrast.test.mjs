import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, contrast, readThemeTokens } from './helpers.mjs';

const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const themes = readThemeTokens(css);

/** Pairs that must be readable as body text (WCAG AA: 4.5:1). */
const TEXT_PAIRS = [
  ['ink', 'surface'],
  ['ink-2', 'surface'],
  ['muted', 'surface'],
  ['faint', 'surface'],
  ['accent-ui', 'surface'],
  ['accent-ink', 'surface'],
  ['accent-deep', 'surface'],
  ['accent-text', 'surface'],
  ['warn', 'surface'],
  ['on-accent', 'solid-bg'],
  ['on-accent', 'solid-bg-hover'],
  ['accent-deep', 'accent-soft-2'],
  ['accent-ink', 'accent-soft'],
];

/** Pairs that only need to be distinguishable as UI (WCAG AA: 3:1). */
const UI_PAIRS = [
  ['faint-2', 'surface'],
  ['control-border', 'surface'],
  ['accent-ui', 'track'],
];

const EXPECTED_THEMES = ['ember', 'slate', 'forest', 'midnight'];

test('every theme defines the full token set', () => {
  EXPECTED_THEMES.forEach((name) => {
    assert.ok(themes[name], `theme ${name} is missing`);
    ['surface', 'ink', 'muted', 'faint', 'accent', 'accent-ui', 'on-accent', 'solid-bg'].forEach((token) => {
      assert.ok(themes[name][`--${token}`], `${name} is missing --${token}`);
    });
    assert.ok(themes[name]['--control-border'], `${name} is missing --control-border`);
  });
});

test('text colours meet WCAG AA in every theme', () => {
  EXPECTED_THEMES.forEach((name) => {
    const t = themes[name];
    TEXT_PAIRS.forEach(([fg, bg]) => {
      const ratio = contrast(t[`--${fg}`], t[`--${bg}`]);
      assert.ok(
        ratio >= 4.5,
        `${name}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1 (needs 4.5:1)`
      );
    });
  });
});

test('UI colours meet WCAG AA in every theme', () => {
  EXPECTED_THEMES.forEach((name) => {
    const t = themes[name];
    UI_PAIRS.forEach(([fg, bg]) => {
      const ratio = contrast(t[`--${fg}`], t[`--${bg}`]);
      assert.ok(
        ratio >= 3,
        `${name}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1 (needs 3:1)`
      );
    });
  });
});

test('no raw hex colours are hard coded outside the token blocks', () => {
  const body = css.replace(/:root\s*\{[^}]*\}/g, '').replace(/\[data-theme="[a-z]+"\]\s*\{[^}]*\}/g, '');
  const hardCoded = body.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  assert.deepEqual(hardCoded, [], 'hard coded colours bypass the theme system');
});
