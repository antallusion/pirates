// Installs a `tools/balance-paths.ts --balance/--pairs --state=<dir>` state (edge_L.json) into the code: the tool's EDGE
// literal and shared/src/data/paths.ts PATH_KNOBS and MOVE_KNOBS (the figures the book shows). Run from the repo root:
//   node --disable-warning=ExperimentalWarning tools/balance-paths-install.ts <state dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { CAPTAIN_IDS } from '../shared/src/data/captains.ts';
import { MOVE_KNOBS, PATH_KNOBS } from '../shared/src/data/paths.ts';
import { EDGE, fitPower, loadState } from './balance-paths.ts';
const dir = process.argv[2];
loadState(dir);
fitPower();
const crlf = (s: string) => s.includes('\r\n');
// EDGE literal
let tool = readFileSync('tools/balance-paths.ts', 'utf8');
const nl = crlf(tool) ? '\r\n' : '\n';
const t = tool.replace(/\r\n/g, '\n');
const a = t.indexOf('export const EDGE: Record<CaptainId, Edge> = {');
const b = t.indexOf('\n};', a) + 3;
const arr = (x: number[]) => `[${x.join(', ')}]`;
const edge = `export const EDGE: Record<CaptainId, Edge> = {\n${CAPTAIN_IDS.map((p) => `  ${p}: { page: ${arr(EDGE[p].page)}, buff: ${EDGE[p].buff}, move: ${arr(EDGE[p].move)}, mbuff: ${EDGE[p].mbuff}, mmend: ${arr(EDGE[p].mmend)}, order: ONES },`).join('\n')}\n};`;
writeFileSync('tools/balance-paths.ts', (t.slice(0, a) + edge + t.slice(b)).replace(/\n/g, nl));
// knobs
const pth = readFileSync('shared/src/data/paths.ts', 'utf8');
const nl2 = crlf(pth) ? '\r\n' : '\n';
let s = pth.replace(/\r\n/g, '\n');
const knobs = (name: string, k: typeof PATH_KNOBS) => {
  const i = s.indexOf(`export const ${name}: Record<CaptainId, PathKnobs> = {`);
  const j = s.indexOf('\n};', i) + 3;
  s = s.slice(0, i) + `export const ${name}: Record<CaptainId, PathKnobs> = {\n${CAPTAIN_IDS.map((c) => `  ${c}: { power: ${arr(k[c].power as number[])}, mend: ${arr(k[c].mend as number[])}, buff: ${k[c].buff}, pts: ${k[c].pts} },`).join('\n')}\n};` + s.slice(j);
};
knobs('PATH_KNOBS', PATH_KNOBS);
knobs('MOVE_KNOBS', MOVE_KNOBS);
writeFileSync('shared/src/data/paths.ts', s.replace(/\n/g, nl2));
console.log('installed from', dir);
