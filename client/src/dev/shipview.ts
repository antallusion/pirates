// The ships' look page (client/shipview.html, the owner 2026-11-21: «дашь прям посмотреть какой-то корабль на
// локальной машине»): any mastless hull drawn large with her masts exactly as the sea draws them (render/masts.ts),
// the sails set, reefed, furled or bare and the yards braced to a wind you turn; beside her the old painting.
// Local tool only: open http://localhost:58521/shipview.html (or the admin server's port).

import { SHIP_CLASSES, SHIP_CLASS_IDS } from '../../../shared/src/data/ships.ts';
import { MAST_STEPS, MAST_TINT } from '../../../shared/src/data/maststeps.ts';
import { DATA_RU } from '../lang/data.ts';
import { drawMastSet, dyeMast } from '../render/masts.ts';

type Entry = { key: string; name: string; tier: number };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const manifest = (await (await fetch('/assets/manifest.json')).json()) as { assets: Record<string, { local: string }> };
const imgs = new Map<string, HTMLImageElement>();
function img(id: string): HTMLImageElement | null {
  let im = imgs.get(id);
  if (!im) {
    const a = manifest.assets[id];
    if (!a) return null;
    im = new Image();
    im.src = '/assets/' + a.local;
    imgs.set(id, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}
const dyes = new Map<string, HTMLCanvasElement>();
function look(id: string, tint?: string) {
  const im = img(id);
  if (!im) return null;
  if (!tint) return { img: im, w: im.naturalWidth, h: im.naturalHeight };
  let c = dyes.get(id + tint);
  if (!c) dyes.set(id + tint, (c = dyeMast(im, tint)));
  return { img: c, w: im.naturalWidth, h: im.naturalHeight };
}

// every hull with masts: the classes (named as in the game), then the zone bosses' own hulls
const seen = new Set<string>();
const entries: Entry[] = [];
for (const id of SHIP_CLASS_IDS) {
  const def = SHIP_CLASSES[id];
  const key = def.sprite.slice(5);
  if (!MAST_STEPS[key] || seen.has(key)) continue;
  seen.add(key);
  entries.push({ key, name: DATA_RU[`ships.SHIP_CLASSES.${id}.name`] ?? def.name, tier: def.tier });
}
for (const key of Object.keys(MAST_STEPS)) if (!seen.has(key)) entries.push({ key, name: key.replace(/^zb_/, 'босс: ').replace(/_/g, ' '), tier: 9 });
entries.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, 'ru'));

let current = entries.find((e) => e.key === 'sloop') ?? entries[0];
let all = false;
let sailWant = 1, sail = 1, auto = false, brace = 0;
const SAILS: [string, number][] = [['Голые реи', 0], ['Убраны', 1 / 3], ['Рифы', 2 / 3], ['Полные', 1]];

function list(): void {
  const q = $<HTMLInputElement>('q').value.trim().toLowerCase();
  $('list').innerHTML = entries
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.key.includes(q))
    .map((e) => `<button data-k="${e.key}" class="${e.key === current.key && !all ? 'on' : ''}">${e.name} <small>${e.tier < 9 ? `ур. ${e.tier}` : ''}</small></button>`)
    .join('');
}
$('list').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-k]');
  if (!b) return;
  current = entries.find((e) => e.key === b.dataset.k)!;
  all = false;
  $('all').classList.remove('on');
  list();
});
$('q').addEventListener('input', list);
$('all').addEventListener('click', () => {
  all = !all;
  $('all').classList.toggle('on', all);
  list();
});
$('sails').innerHTML = SAILS.map(([n], i) => `<button data-s="${i}">${n}</button>`).join('') + '<button data-s="auto">Авто</button>';
$('sails').addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-s]');
  if (!b) return;
  auto = b.dataset.s === 'auto';
  if (!auto) sailWant = SAILS[Number(b.dataset.s)][1];
  for (const x of $('sails').querySelectorAll('button')) x.classList.toggle('on', x === b);
});
$('sails').querySelector<HTMLElement>('[data-s="3"]')!.classList.add('on');
list();

const cv = $<HTMLCanvasElement>('cv');
const g = cv.getContext('2d')!;

/** One ship at (x, y) (her middle), `h` px tall; the old painting `oldAt` px to the right when shown. */
function ship(e: Entry, x: number, y: number, h: number, t: number, oldAt: number | null): void {
  const hull = img(`ship.${e.key}_hull`);
  if (!hull) return;
  const w = (hull.naturalWidth / hull.naturalHeight) * h;
  g.save();
  g.translate(x, y);
  g.drawImage(hull, -w / 2, -h / 2, w, h);
  const breathe = Math.sin(t * 1.7) * 0.015 * sail;
  drawMastSet(g, (id) => look(id, MAST_TINT[e.key]), MAST_STEPS[e.key], w, h, 0.5, sail, brace, breathe);
  g.restore();
  const old = oldAt !== null ? img(`ship.${e.key}`) : null;
  if (old) {
    const ow = (old.naturalWidth / old.naturalHeight) * h;
    g.drawImage(old, x + oldAt! - ow / 2, y - h / 2, ow, h);
  }
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  if (auto) sailWant = 0.5 - 0.5 * Math.cos(t * 0.6);
  sail += (sailWant - sail) * Math.min(1, dt * 1.6);
  const rel = (Number($<HTMLInputElement>('wind').value) * Math.PI) / 180;
  const want = Math.max(-0.62, Math.min(0.62, Math.sin(rel) * 0.55));
  brace += (want - brace) * Math.min(1, dt * 0.9);
  const view = $('view');
  const zoom = Number($<HTMLInputElement>('zoom').value) / 100;
  const W = view.clientWidth;
  if (all) {
    const h = 260 * zoom, cell = h * 0.62, cols = Math.max(1, Math.floor(W / cell));
    const rows = Math.ceil(entries.length / cols);
    cv.width = W;
    cv.height = rows * (h + 26) + 10;
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#d8c9a6';
    g.font = '12px Georgia, serif';
    g.textAlign = 'center';
    entries.forEach((e, i) => {
      const cx = (i % cols) * cell + cell / 2, cy = Math.floor(i / cols) * (h + 26) + h / 2 + 6;
      ship(e, cx, cy, h, t, null);
      g.fillText(e.name, cx, cy + h / 2 + 16);
    });
    $('title').textContent = `Все корабли: ${entries.length}`;
  } else {
    const h = Math.max(200, view.clientHeight - 30) * zoom;
    const old = $<HTMLInputElement>('old').checked;
    cv.width = W;
    cv.height = Math.max(view.clientHeight, h + 30);
    g.clearRect(0, 0, cv.width, cv.height);
    const gap = h * 0.55;
    ship(current, old ? W / 2 - gap / 2 : W / 2, cv.height / 2, h, t, old ? gap : null);
    $('title').textContent = current.name;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
