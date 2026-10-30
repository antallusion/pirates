// The detail card (owner, 2026-10-30: «вообще у всего в игре описания при нажатии должны быть … нажал — тултип а-ля
// модалка и крестик чтоб закрыть»): every kind the player sees as an icon resolves to a card with a name in both tongues
// and something to read (every creature, good, land resource, hull, gun, mount, fitting, figurehead, shot, skill,
// order, talent, tattoo, pet, set, relic, artifact and item base); the creatures' numbers carry their icons; a good
// says where it is had; and the windows carry the one attribute the one listener answers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DETAIL_KINDS, allDetailKeys, detailCard, itemDetail } from '../shared/src/data/detail.ts';
import { UNITS } from '../shared/src/data/army.ts';
import { GOOD_IDS } from '../shared/src/data/goods.ts';
import { GUNS, MODULES, MOUNTS, SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { ITEM_BASES, makeItem } from '../shared/src/data/items.ts';
import { ARTIFACTS, makeArtifact } from '../shared/src/data/artifacts.ts';
import { TITLES } from '../shared/src/data/cosmetics.ts';
import { EN, RU } from '../client/src/lang/ui/detail.ts';
import { Rng } from '../shared/src/rng.ts';

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const filled = (t: [string, string] | undefined) => !!t && t[0].trim().length > 0 && t[1].trim().length > 0;

test('every key of every kind resolves to a card with a name in both tongues and something to read', () => {
  const keys = allDetailKeys();
  const kinds = new Set(keys.map((k) => k.split(':')[0]));
  for (const k of ['unit', 'good', 'lres', 'hull', 'gun', 'mount', 'module', 'fh', 'ammo', 'skill', 'order', 'talent', 'tattoo', 'pet', 'gset', 'relic', 'aset', 'art', 'base']) assert.ok(kinds.has(k), `no keys of ${k}`);
  for (const k of kinds) assert.ok((DETAIL_KINDS as readonly string[]).includes(k), `${k} is not a kind`);
  assert.ok(keys.length >= Object.keys(UNITS).length + GOOD_IDS.length + Object.keys(ITEM_BASES).length);
  for (const key of keys) {
    const c = detailCard(key);
    assert.ok(c, `${key}: no card`);
    assert.ok(filled(c.name), `${key}: no name`);
    assert.ok((c.rows?.length ?? 0) + (c.notes?.length ?? 0) > 0, `${key}: nothing to read`);
    for (const r of c.rows ?? []) assert.ok(filled(r.k) && filled(r.v), `${key}: an empty line`);
    for (const n of c.notes ?? []) assert.ok(filled(n.t), `${key}: an empty note`);
    assert.ok(!JSON.stringify(c).includes('undefined') && !JSON.stringify(c).includes('NaN'), `${key}: undefined or NaN`);
  }
});

test('a creature: tier, its six numbers with their icons and bars, its power; ×n names the stack', () => {
  for (const u of Object.keys(UNITS)) {
    const c = detailCard(`unit:${u}`)!;
    assert.equal(c.fig, 'unit');
    assert.ok(filled(c.sub));
    const icons = (c.rows ?? []).filter((r) => r.icon);
    assert.ok(icons.length >= 6, `${u}: ${icons.length} numbers with icons`);
  }
  const c = detailCard('unit:musketeer:12')!;
  assert.match(c.name[1], /×12/);
  assert.ok(c.rows!.some((r) => r.k[1].startsWith('Сила')));
});

test('a good: its category, room, base price, its picture, and where it is had', () => {
  for (const g of GOOD_IDS) {
    const c = detailCard(`good:${g}`)!;
    assert.equal(c.src, `g:${g}`);
    assert.equal(c.art, `icon.good_${g}`);
    assert.ok(c.rows!.some((r) => r.k[0] === 'Base price'));
    assert.ok(c.rows!.some((r) => r.k[0].startsWith('Room')));
  }
});

test('hulls, guns, mounts and fittings each have their own card; a hull its numbers and picture (the ship tree may reuse `hull:<classId>`)', () => {
  for (const id of Object.keys(SHIP_CLASSES)) {
    const c = detailCard(`hull:${id}`)!;
    assert.equal(c.fig, 'ship');
    assert.ok(c.rows!.length >= 10, id);
  }
  for (const id of Object.keys(GUNS)) assert.ok(detailCard(`gun:${id}`)!.rows!.length >= 4, id);
  for (const id of Object.keys(MOUNTS)) assert.ok(detailCard(`mount:${id}`), id);
  for (const id of Object.keys(MODULES)) {
    assert.ok(detailCard(`module:${id}:1`), id);
    assert.ok(detailCard(`module:${id}:2`)!.sub![0].includes('2/'), id);
  }
});

test('an item as she has it: its rarity, lines and wear; an artifact its gifts; a cosmetic how it is had', () => {
  const rng = new Rng(7);
  for (let i = 0; i < 40; i++) {
    const it = makeItem(rng, i + 1, { ilvl: 1 + (i % 10), rarity: (i % 5) as 0 });
    const c = itemDetail(it);
    assert.ok(filled(c.name) && c.color && c.art, `item ${i}`);
    assert.ok((c.rows?.length ?? 0) > 0, `item ${i}: no lines`);
  }
  for (const id of Object.keys(ARTIFACTS)) assert.ok(itemDetail(makeArtifact(id)).notes!.length > 0, id);
  for (const t of TITLES) assert.ok(detailCard(`cos:title:${t.id}`), t.id);
  assert.equal(detailCard('nothing:here'), undefined);
  assert.equal(detailCard('unit:no_such_kind'), undefined);
});

test('the card\'s words are complete in both tongues', () => {
  assert.deepEqual(Object.keys(RU).sort(), Object.keys(EN).sort());
  for (const [k, v] of Object.entries(RU)) assert.ok(!/[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, '')), `RU ${k}: ${v}`);
});

test('the card: one delegated listener, ✕, Esc (a layer), a tap beside it; a ship\'s card with «Цель / Атаковать / Плыть»', () => {
  const src = read('client/src/ui/detail.ts');
  assert.match(src, /document\.addEventListener\('click'/);
  assert.match(src, /data-dcx/);
  assert.match(src, /class="dc-scrim" data-dcx/);
  assert.match(src, /pushLayer\(layer\)/);
  assert.match(src, /onEscape: closeDetail/);
  assert.match(src, /contextmenu/);
  for (const a of ['lock', 'fight', 'pursue']) assert.ok(EN[`act.${a}` as keyof typeof EN]);
  assert.equal(RU['act.lock'], 'Цель');
  assert.equal(RU['act.fight'], 'Атаковать');
  assert.equal(RU['act.pursue'], 'Плыть');
  const main = read('client/src/main.ts');
  assert.match(main, /mountDetail\(\{/);
  assert.match(main, /info: true,/);
  assert.match(read('client/src/ui/targetmenu.ts'), /class="tm-extra"[^`]*data-tm="info"/);
  assert.match(main, /openDetail\(`ship:\$\{n\}`\)/);
  assert.match(read('client/src/ui/targetmenu.ts'), /'info'/);
  assert.match(read('client/index.html'), /\/detail\.css/);
});

test('the main surfaces carry the attribute', () => {
  const want: [string, RegExp[]][] = [
    ['client/src/ui/hud.ts', [/detailAttr\(`ship:\$\{id\}`\)/]],
    ['client/src/ui/army.ts', [/detailAttr\(`unit:\$\{s\.u\}:\$\{s\.n\}`\)/, /detailAttr\(`unit:\$\{u\}`, \{ hold: true \}\)/, /infoBtn\(/]],
    ['client/src/ui/recruit.ts', [/detailAttr\(`unit:\$\{u\}`\)/]],
    ['client/src/ui/port.ts', [/detailAttr\(`good:\$\{r\.good\}`, \{ buy: r\.buy, sell: r\.sell \}\)/, /`gun:\$\{gdef\.gun\}`/, /`mount:\$\{m\.mount\}`/, /`module:\$\{m\.module\}/, /`hull:\$\{s\.classId\}`/, /`ammo:\$\{a\}`/]],
    ['client/src/ui/dialogs.ts', [/`good:\$\{g\}`/, /`gun:\$\{self\.loadout\.guns\.port\}`/, /`hull:\$\{cls\.id\}`/, /`ammo:\$\{a\}`/]],
    ['client/src/ui/gear.ts', [/itemDetailAttr\(it, \{ hold: true \}\)/]],
    ['client/src/ui/hero.ts', [/`skill:\$\{x\.id\}:\$\{x\.r\}`/, /`order:\$\{id\}`/, /`relic:\$\{r\.id\}/, /`art:\$\{w\.art\}`/, /`aset:\$\{id\}`/]],
    ['client/src/ui/talents.ts', [/`talent:\$\{x\.id\}/, /`deed:\$\{d\.id\}`/]],
    ['client/src/ui/cosmetics.ts', [/`cos:\$\{cosKey\(x\)\}`/]],
    ['client/src/ui/companion.ts', [/`pet:\$\{pet\}`/]],
    ['client/src/ui/tattoos.ts', [/`tattoo:\$\{id\}`/]],
    ['client/src/ui/seasonpass.ts', [/registerDetail\(`pass:/]],
    ['client/src/ui/advcard.ts', [/`unit:\$\{u\}`/]],
    ['client/src/ui/tactical.ts', [/`good:\$\{g\.g\}`/]],
    ['client/src/ui/islescene.ts', [/`good:\$\{r\.good\}`/]],
    ['client/src/ui/srctip.ts', [/detailAttr\(kind === 'g'/]],
    ['client/src/ui/bazaar.ts', [/itemDetailAttr\(it\.item\)/]],
    ['client/src/ui/inspect.ts', [/itemDetailAttr\(it\)/]],
    ['client/src/ui/dom.ts', [/data-detail-hold="good:/]],
  ];
  for (const [f, res] of want) {
    const s = read(f);
    for (const re of res) assert.match(s, re, `${f}: ${re}`);
  }
});
