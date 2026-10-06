// docs/23 phase 0, item 1 (design-system audit, and phase 9's «after»): what the stylesheets and the screens' inline
// styles are made of — how many different colours, font sizes, radii, spacings, durations, shadows, breakpoints and
// !important — and how much of it goes through the tokens (var(--…)) rather than a literal. Numbers, not taste.
//
//   node --disable-warning=ExperimentalWarning tools/mobile/css-audit.ts [--json out.json]

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : ''; };

const css: Record<string, string> = {};
for (const f of ['client/styles.css', 'client/minigame.css', 'client/src/ui/kit/kit.css']) {
  try { css[f] = readFileSync(join(root, f), 'utf8'); } catch { /* not there yet */ }
}
// Inline style="…" and .style.x = in the screens' code.
let inline = '';
let inlineCount = 0;
for (const dir of ['client/src/ui', 'client/src']) {
  for (const f of readdirSync(join(root, dir))) {
    if (!f.endsWith('.ts')) continue;
    const s = readFileSync(join(root, dir, f), 'utf8');
    for (const m of s.matchAll(/style="([^"]*)"/g)) { inline += m[1] + ';'; inlineCount++; }
  }
}

const count = (re: RegExp, s: string) => { const m = new Map<string, number>(); for (const x of s.matchAll(re)) { const k = (x[1] ?? x[0]).toLowerCase().replace(/\s+/g, ''); m.set(k, (m.get(k) ?? 0) + 1); } return m; };
const top = (m: Map<string, number>, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

function audit(s: string) {
  const decls = s.match(/[a-z-]+\s*:[^;{}]+/g) ?? [];
  const colors = count(/(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\))/gi, s);
  const colorDecls = decls.filter((d) => /^(color|background|background-color|border(-\w+)?(-color)?|box-shadow|outline(-color)?|fill|stroke|text-shadow)\s*:/.test(d));
  const tokenColor = colorDecls.filter((d) => /var\(--/.test(d) && !/#[0-9a-f]{3,8}\b|rgba?\(/i.test(d)).length;
  const fontSizes = count(/font-size\s*:\s*([^;}]+)/g, s);
  for (const m of s.matchAll(/font\s*:\s*(?:italic\s+|normal\s+)?(?:\d{3}\s+)?(\d+(?:\.\d+)?px)/g)) fontSizes.set(m[1], (fontSizes.get(m[1]) ?? 0) + 1);
  const radii = count(/border-radius\s*:\s*([^;}]+)/g, s);
  const spacing = new Map<string, number>();
  for (const m of s.matchAll(/(?:^|[;{\s])(?:padding|margin|gap)(?:-\w+)?\s*:\s*([^;}]+)/g)) for (const v of m[1].match(/-?\d+(?:\.\d+)?px/g) ?? []) spacing.set(v, (spacing.get(v) ?? 0) + 1);
  const durations = new Map<string, number>();
  for (const m of s.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*([^;}]+)/g)) for (const v of m[1].match(/\d*\.?\d+m?s\b/g) ?? []) { const ms = v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000; durations.set(`${Math.round(ms)}ms`, (durations.get(`${Math.round(ms)}ms`) ?? 0) + 1); }
  const easings = count(/(cubic-bezier\([^)]*\)|ease-in-out|ease-out|ease-in|\blinear\b|\bease\b)/g, s.replace(/[^{}]*\{|\}/g, (x) => x));
  const shadows = count(/box-shadow\s*:\s*([^;}]+)/g, s);
  const z = count(/z-index\s*:\s*(-?\d+)/g, s);
  const media = count(/@media\s*([^{]+)/g, s);
  const important = (s.match(/!important/g) ?? []).length;
  const vars = count(/var\((--[\w-]+)/g, s);
  const defs = count(/(--[\w-]+)\s*:/g, s);
  const reduced = (s.match(/prefers-reduced-motion/g) ?? []).length;
  const focus = (s.match(/:focus-visible/g) ?? []).length;
  const rules = (s.match(/\{/g) ?? []).length;
  return {
    rules, declarations: decls.length, important,
    colors: { distinct: colors.size, colorDecls: colorDecls.length, viaTokens: tokenColor, tokenShare: +(tokenColor / Math.max(1, colorDecls.length)).toFixed(2), top: top(colors) },
    fontSizes: { distinct: fontSizes.size, top: top(fontSizes, 20) },
    radii: { distinct: radii.size, top: top(radii) },
    spacing: { distinct: spacing.size, offGrid4: [...spacing.keys()].filter((v) => parseFloat(v) % 4 !== 0).length, top: top(spacing, 20) },
    durations: { distinct: durations.size, top: top(durations) },
    easings: { distinct: easings.size, top: top(easings) },
    shadows: { distinct: shadows.size },
    zIndex: { distinct: z.size, max: Math.max(0, ...[...z.keys()].map(Number)) },
    media: { distinct: media.size, top: top(media, 8) },
    tokens: { defined: defs.size, used: vars.size, uses: [...vars.values()].reduce((a, b) => a + b, 0) },
    reducedMotionRules: reduced, focusVisibleRules: focus,
  };
}

const all = Object.values(css).join('\n');
const out = { at: new Date().toISOString(), files: Object.fromEntries(Object.entries(css).map(([f, s]) => [f, s.split('\n').length])), all: audit(all), inline: { count: inlineCount, ...audit(inline) } };
const a = out.all;
console.log(`lines ${JSON.stringify(out.files)}  rules ${a.rules}  declarations ${a.declarations}  !important ${a.important}`);
console.log(`colours: ${a.colors.distinct} distinct literals; ${a.colors.viaTokens}/${a.colors.colorDecls} colour declarations through tokens (${Math.round(a.colors.tokenShare * 100)}%)`);
console.log(`font sizes ${a.fontSizes.distinct} · radii ${a.radii.distinct} · spacing values ${a.spacing.distinct} (${a.spacing.offGrid4} off the 4-px grid) · durations ${a.durations.distinct} · easings ${a.easings.distinct} · shadows ${a.shadows.distinct} · z-index ${a.zIndex.distinct} (max ${a.zIndex.max}) · media queries ${a.media.distinct}`);
console.log(`tokens: ${a.tokens.defined} defined, ${a.tokens.used} used ${a.tokens.uses}×; reduced-motion rules ${a.reducedMotionRules}; :focus-visible rules ${a.focusVisibleRules}`);
console.log(`inline style="" in the screens' code: ${out.inline.count} (${out.inline.colors.distinct} colours, ${out.inline.fontSizes.distinct} font sizes)`);
console.log(`top font sizes: ${a.fontSizes.top.map(([k, n]) => `${k}×${n}`).join(' ')}`);
console.log(`top radii: ${a.radii.top.map(([k, n]) => `${k}×${n}`).join(' ')}`);
console.log(`top durations: ${a.durations.top.map(([k, n]) => `${k}×${n}`).join(' ')}`);
if (arg('json')) writeFileSync(arg('json'), JSON.stringify(out, null, 1));
