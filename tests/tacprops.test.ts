// Owner, 2026-10-18 (the boarding pack): a boarding's decks drawn anew each battle from its seed — a FEW things, cover
// and obstacles, a little clutter, a way round everything and the deployment columns open — the same for both
// captains; the barricades cover as the barrels do (−25%), the obstacles bar the way and cover nothing; a gangplank's
// picture by its span (shared/src/data/tacprops.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Rng } from '../shared/src/rng.ts';
import { TAC_BLOCKING, TAC_DECK_COVER, TAC_GAP, TAC_H, deckCover, deployZone, hexIndex, hexMirror, hexNeighbors, hexX, tacFlagHex, threatHexes } from '../shared/src/data/tactical.ts';
import type { TacCell } from '../shared/src/data/tactical.ts';
import { DECK_ART, DECK_PROPS, PLANKS, deckTheme, dressDeck, plankArt, plankRuns, plankWant } from '../shared/src/data/tacprops.ts';
import { blowParts, coverAt, makeField, newBattle, previewBlow, reachOf, scarDeck, viewOf } from '../server/src/game/tacbattle.ts';
import type { TacBattle } from '../server/src/game/tacbattle.ts';
import { sidesAt } from './balance/boardlen.ts';

const STAND = 'CBKQL';
const left = (i: number) => hexX(i) < TAC_GAP;

const pvp = (seed: number, hulls: [string, string] = ['frigate', 'ghost_ship']): TacBattle => {
  const [a, b] = sidesAt(30, true, 'corsair', 'reaver', seed);
  return newBattle({ ...a, hull: hulls[0] }, { ...b, hull: hulls[1] }, seed, 0, new Rng(seed ^ 0x7ac7), { len: 'board', level: 30 });
};

/** Every hex a stack may stand on (no fire) reaches every other: the decks are one through the planks. */
function oneDeck(cells: readonly string[]): boolean {
  const walk = (i: number) => !TAC_BLOCKING.has(cells[i] as TacCell) && cells[i] !== 'F';
  const all = cells.map((_, i) => i).filter(walk);
  const seen = new Set([all[0]]);
  const q = [all[0]];
  while (q.length) for (const j of hexNeighbors(q.pop()!)) if (!seen.has(j) && walk(j)) {
    seen.add(j);
    q.push(j);
  }
  return all.every((i) => seen.has(i));
}

test('deck props: laid from the seed, the same for both captains, mirrored cells, each deck her own pictures', () => {
  for (const seed of [1, 2, 3, 77, 1234]) {
    assert.deepEqual(makeField(seed), makeField(seed), 'one seed, one field');
    const p = pvp(seed), q = pvp(seed);
    assert.deepEqual(p.cells, q.cells);
    assert.deepEqual(p.props, q.props);
    assert.deepEqual(p.planks, q.planks);
    const v0 = viewOf(p, 0, 0, false), v1 = viewOf(p, 1, 0, false);
    assert.deepEqual(v0.props, v1.props, 'both sides see one deck');
    assert.deepEqual(v0.planks, v1.planks);
    assert.equal(v0.cells, v1.cells);
    for (let i = 0; i < p.cells.length; i++) if (STAND.includes(p.cells[i])) assert.equal(p.cells[hexMirror(i)], p.cells[i], 'mirrored: neither side the better ground');
    // A warship's deck and a ghost's: each her own pictures.
    for (const pr of p.props!) {
      const c = p.cells[pr.h];
      const kind = c === '.' ? 'd' : c;
      const th = left(pr.h) ? 'war' : 'cursed';
      assert.ok((DECK_ART as Record<string, Record<string, readonly string[]>>)[kind][th].includes(pr.a), `${pr.a} on ${c} of a ${th} deck`);
    }
  }
  // Different seeds, different decks.
  const shapes = new Set(Array.from({ length: 40 }, (_, k) => makeField(k * 7 + 1).join('')));
  assert.ok(shapes.size >= 30, `varied: ${shapes.size} of 40`);
});

test('deck props: a FEW — her two guns and 1–3 things a deck, 1–2 pieces of clutter, six at most, none crowding, none beside a plank', () => {
  const seen = { Q: 0, B: 0, K: 0, L: 0 } as Record<string, number>;
  let decorSeen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const bt = pvp(seed, ['fluyt', 'treasure_fluyt']);
    const c = bt.cells;
    for (const side of [0, 1] as const) {
      const mine = (i: number) => (side ? hexX(i) > TAC_GAP : hexX(i) < TAC_GAP);
      const stands = c.map((x, i) => (mine(i) && STAND.includes(x) ? i : -1)).filter((i) => i >= 0);
      const guns = stands.filter((i) => c[i] === 'C').length;
      assert.equal(guns, 2, 'her guns at the bow and the stern');
      assert.ok(stands.length >= 2 + DECK_PROPS.items[0] && stands.length <= 2 + DECK_PROPS.items[1], `seed ${seed}: ${stands.length} things`);
      assert.equal(c.filter((x, i) => mine(i) && x === 'M').length, 1, 'her mast');
      const decor = bt.props!.filter((p) => mine(p.h) && c[p.h] === '.');
      assert.ok(decor.length <= DECK_PROPS.decor[1], `seed ${seed}: ${decor.length} clutter`);
      decorSeen += decor.length;
      const total = stands.length + decor.length;
      assert.ok(total >= 3 && total <= DECK_PROPS.most, `seed ${seed}: ${total} props beside the mast`);
      for (const i of [...stands, ...decor.map((p) => p.h)]) {
        assert.ok(!hexNeighbors(i).some((j) => c[j] === '='), 'never beside a plank');
        if (c[i] !== 'C') assert.ok(!hexNeighbors(i).some((j) => 'MCBKQL'.includes(c[j])), `seed ${seed}: ${i} crowds another`);
      }
      for (const p of decor) assert.ok(!TAC_BLOCKING.has(c[p.h] as TacCell) && p.h !== tacFlagHex(0) && p.h !== tacFlagHex(1), 'clutter on open deck only');
      for (const i of stands) if (c[i] !== 'C') seen[c[i]]++;
    }
  }
  assert.ok(seen.Q > 0 && seen.B > 0 && seen.K > 0 && seen.L > 0, JSON.stringify(seen));
  assert.ok(decorSeen / 800 >= 1, `clutter: ${decorSeen / 800} a deck`);
  // Cover is most of it, obstacles a third or so.
  const all = seen.Q + seen.B + seen.K + seen.L;
  assert.ok(seen.L / all > 0.2 && seen.L / all < 0.5, JSON.stringify(seen));
});

test('deck props: the deployment columns open, one deck from rail to rail, even with the guns\' holes and a fire', () => {
  for (let seed = 1; seed <= 400; seed++) {
    const cells = makeField(seed);
    for (const side of [0, 1] as const) assert.ok(deployZone(cells, side).length >= DECK_PROPS.deployMin, `seed ${seed}: ${deployZone(cells, side).length}`);
    assert.ok(oneDeck(cells), `seed ${seed}: a deck cut off`);
    scarDeck(cells, 0, 4, true, seed);
    scarDeck(cells, 1, 4, true, seed);
    assert.ok(oneDeck(cells), `seed ${seed}: cut off once scarred`);
    for (const side of [0, 1] as const) assert.ok(deployZone(cells, side).length >= 16, `seed ${seed}: scarred zone`);
  }
});

test('deck props: a barricade covers −25% as the barrels do; an obstacle bars the way and covers nothing; the preview and the threat zones know both', () => {
  const bt = pvp(5);
  const s = bt.stacks.find((x) => x.side === 0 && x.shots > 0)!;
  const t = bt.stacks.find((x) => x.side === 1)!;
  for (let i = 0; i < bt.cells.length; i++) if ('MBKCQL'.includes(bt.cells[i])) bt.cells[i] = '.';
  for (const o of bt.stacks) if (o !== s && o !== t) o.hex = -1;
  s.hex = hexIndex(1, 4);
  t.hex = hexIndex(8, 4);
  const bare = blowParts(bt, s, t, 'shot').mul;
  bt.cells[hexIndex(7, 4)] = 'L';
  assert.equal(deckCover(bt.cells, t.hex, s.hex), -1, 'an obstacle is no cover');
  assert.equal(blowParts(bt, s, t, 'shot').mul, bare);
  bt.cells[hexIndex(7, 4)] = 'Q';
  assert.equal(coverAt(bt, t.hex, s.hex), hexIndex(7, 4), 'a barricade beside her on the shooter\'s side');
  assert.ok(Math.abs(blowParts(bt, s, t, 'shot').mul / bare - TAC_DECK_COVER) < 1e-9, 'a quarter off');
  assert.equal(previewBlow(bt, s, t, 'shot').cov, true, 'the preview says so');
  bt.cells[hexIndex(7, 4)] = '.';
  bt.cells[hexIndex(3, 4)] = 'Q';
  assert.ok(coverAt(bt, t.hex, s.hex) >= 0, 'through it on the shot\'s line');
  // Both bar the way: the stride goes round them, as the threat zone does.
  for (const c of ['Q', 'L'] as const) {
    bt.cells[hexIndex(3, 4)] = c;
    s.hex = hexIndex(2, 4);
    const reach = reachOf(bt, s);
    assert.ok(!reach.has(hexIndex(3, 4)), `${c} is no footing`);
    const th = threatHexes(bt.cells, new Set(), s.hex, { speed: s.speed });
    assert.ok(!th.move.includes(hexIndex(3, 4)));
  }
});

test('gangplanks: the field\'s runs of one hex each take a broad plank by the seed; a longer run a long one', () => {
  const ratio = (a: string) => PLANKS.find((p) => p.a === a)!.r;
  const picks = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const runs = plankRuns(makeField(seed), seed);
    assert.equal(runs.length, 3, 'three planks');
    assert.equal(new Set(runs.map((r) => r.a)).size, 1, 'one kind of plank a battle');
    for (const r of runs) {
      const k = ratio(r.a) / plankWant(1);
      assert.ok(k >= 0.8 && k <= 1.4, `${r.a}: ${ratio(r.a)} for a hex of water`);
      picks.add(r.a);
    }
    assert.equal(plankArt(seed, 1), runs[0].a, 'by the seed');
    const long = plankArt(seed, 2);
    assert.ok(ratio(long) >= 4.4, `${long}: ${ratio(long)} for two hexes of water`);
  }
  assert.ok(picks.size >= 10, `varied: ${[...picks]}`);
  // A run of two hexes (a plank over an odd row's two hexes of water) is one run, drawn as one.
  const cells = makeField(1);
  cells[hexIndex(TAC_GAP - 1, 1)] = '=';
  cells[hexIndex(TAC_GAP, 1)] = '=';
  const two = plankRuns(cells, 1).find((r) => r.h === hexIndex(TAC_GAP - 1, 1))!;
  assert.ok(ratio(two.a) >= 4.4);
});

test('deck props: dressing by the ship, and every picture is in the manifest (no shell, no anchor: skull-like)', () => {
  assert.equal(deckTheme('ghost_ship'), 'cursed');
  assert.equal(deckTheme('coral_hulk'), 'cursed');
  assert.equal(deckTheme('brig', 'ghost'), 'cursed');
  assert.equal(deckTheme('treasure_fluyt'), 'rich');
  assert.equal(deckTheme('golden_carrack'), 'rich');
  assert.equal(deckTheme('fluyt'), 'cargo');
  assert.equal(deckTheme('sloop', 'merchant'), 'cargo');
  assert.equal(deckTheme('frigate'), 'war');
  assert.equal(deckTheme('man_o_war'), 'war');
  assert.equal(deckTheme('sloop'), 'plain');
  const m = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')).assets as Record<string, unknown>;
  const used = new Set<string>();
  for (const k of Object.values(DECK_ART)) for (const list of Object.values(k)) for (const a of list) used.add(a);
  for (const a of [...used, ...PLANKS.map((p) => p.a)]) assert.ok(m[`prop.${a}`], `prop.${a}`);
  const pack = Object.keys(m).filter((id) => id.startsWith('prop.bd_')).map((id) => id.slice(5));
  assert.equal(pack.length, 46);
  for (const a of pack) assert.ok(used.has(a), `${a} is used on some deck`);
  assert.ok(!m['prop.bd_shell'] && !m['prop.bd_anchor'] && !m['prop.plank_l8']);
  // Ashore, in a siege and on the sand: none of it.
  const [a, b] = sidesAt(30, true, 'corsair', 'reaver', 3);
  const land = newBattle(a, b, 3, 0, new Rng(3), { land: 'rocky' });
  assert.ok(!land.props && !land.planks && !land.cells.some((c) => c === 'Q' || c === 'L'));
  const sand = newBattle(a, b, 3, 0, new Rng(3), { arena: true });
  assert.ok(!sand.props);
  // Every battle dresses its own way: the pictures differ between seeds on the same ships.
  const looks = new Set(Array.from({ length: 30 }, (_, k) => JSON.stringify(dressDeck(makeField(k + 1), k + 1, ['plain', 'plain']).map((p) => p.a))));
  assert.ok(looks.size >= 25);
  assert.ok(TAC_H === 9);
});
