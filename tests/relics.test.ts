// docs/19 E12–E13: the relics, HoMM3's combination artifacts — four of 4–6 parts each, of the artifacts already in the
// sea and of parts found only as such, with the item art already painted; worn whole they assemble (their parts'
// slots their own) and give a great gift held under the endgame's caps; the parts drop in the seals' depths, the
// Abyss and (for the citadels' helper) relicPartDrop. And the island's anvil: an artifact's primaries spread anew or
// a forged line rolled anew, for the land's resources, pearls and silver reckoned in hours at sea, the new work beside
// the old until she chooses.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARTIFACTS, ARTIFACT_IDS, FORGE_LINE, RELICS, RELIC_CAP, RELIC_IDS, abyssPartChance, artTotals, forgeSpan, makeArtifact, rollArtifact, sealPartChance,
} from '../shared/src/data/artifacts.ts';
import type { RelicId } from '../shared/src/data/artifacts.ts';
import { FORGE_HOURS, FORGE_RISE_MAX, forgeCost, forgeRoll } from '../shared/src/data/forge.ts';
import { ITEM_BASES } from '../shared/src/data/items.ts';
import type { Item } from '../shared/src/data/items.ts';
import { seaHourOf } from '../shared/src/data/seamarks.ts';
import { Rng } from '../shared/src/rng.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import { parkNear, quietAdv } from '../server/src/game/advmap.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { h3Message } from '../server/src/game/h3.ts';
import { heroView } from '../server/src/game/hero.ts';
import { landStore } from '../server/src/game/landecon.ts';
import { mineSites } from '../server/src/game/mines.ts';
import { pickPart, relicPartDrop } from '../server/src/game/relics.ts';
import { townState } from '../server/src/game/town.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import { serverText } from '../client/src/lang/server.ts';
import { setLang } from '../client/src/i18n.ts';
import { kitShare } from './balance/relics.ts';
import { join, makeGame, onHull, steps } from './helpers.ts';

const manifest = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8')) as { assets: Record<string, unknown> };
const slots = (r: RelicId) => RELICS[r].parts.map((id) => ARTIFACTS[id].slot);

test('four relics of 4–6 parts: real artifacts in distinct slots, painted with the item art already there, named in Russian', () => {
  assert.deepEqual(RELIC_IDS, ['crown_of_the_deep', 'storm_orb', 'boarding_union', 'throne_compass']);
  for (const r of RELIC_IDS) {
    const d = RELICS[r];
    assert.ok(d.parts.length >= 4 && d.parts.length <= 6, `${r}: ${d.parts.length} parts`);
    assert.equal(new Set(slots(r)).size, d.parts.length, `${r}: a slot each`);
    assert.ok(/[а-яё]/i.test(d.name[1]) && /[а-яё]/i.test(d.text[1]), `${r}: in Russian`);
    for (const id of d.parts) {
      const a = ARTIFACTS[id];
      assert.equal(a?.part, r, `${id} is a part of ${r}`);
      assert.ok(`icon.${a.icon}` in manifest.assets && a.icon.startsWith('item_'), `${id}: ${a.icon} painted`);
      assert.equal(ITEM_BASES[a.base as keyof typeof ITEM_BASES]?.slot, a.slot, `${id}: its base in its slot`);
      assert.ok(!/skull|bone|blood/.test(a.icon), `${id}: no skulls nor bones`);
    }
    assert.ok(d.parts.some((id) => ARTIFACTS[id].only) && d.parts.some((id) => !ARTIFACTS[id].only), `${r}: its own parts and the sea's`);
  }
  // HoMM3's choice: two pairs fill the ten slots; any other pair shares one.
  const share = (a: RelicId, b: RelicId) => slots(a).some((x) => slots(b).includes(x));
  assert.ok(!share('boarding_union', 'crown_of_the_deep') && !share('storm_orb', 'throne_compass'));
  for (const [a, b] of [['boarding_union', 'storm_orb'], ['boarding_union', 'throne_compass'], ['crown_of_the_deep', 'storm_orb'], ['crown_of_the_deep', 'throne_compass']] as [RelicId, RelicId][]) assert.ok(share(a, b), `${a} × ${b}`);
  // A relic's own parts never come from a boss, a hoard, a guard or a merchant.
  const rng = new Rng(7);
  for (let i = 0; i < 4000; i++) for (const src of ['boss', 'chest', 'guard', 'shop'] as const) assert.ok(!ARTIFACTS[rollArtifact(rng, src)].only);
});

test('worn whole, a relic assembles: its gift on top of its parts’, none short of one part; the relics’ lines under RELIC_CAP', () => {
  for (const r of RELIC_IDS) {
    const all = RELICS[r].parts.map((id, i) => makeArtifact(id, i + 1));
    const whole = artTotals(all), short = artTotals(all.slice(1));
    assert.deepEqual(whole.relics, [r]);
    assert.deepEqual(short.relics, []);
    const pr = (t: typeof whole) => t.prim.atk + t.prim.def + t.prim.pow + t.prim.will;
    assert.ok(pr(whole) - pr(short) > Object.values(ARTIFACTS[RELICS[r].parts[0]].prim ?? {}).reduce((a, b) => a + (b ?? 0), 0), `${r}: the whole gives more than its last part`);
  }
  const both = artTotals([...RELICS.boarding_union.parts, ...RELICS.crown_of_the_deep.parts].map((id, i) => makeArtifact(id, i + 1)));
  assert.deepEqual(both.relics.sort(), ['boarding_union', 'crown_of_the_deep']);
  const own = (k: keyof typeof RELIC_CAP) => RELIC_IDS.filter((r) => both.relics.includes(r)).reduce((n, r) => n + (RELICS[r].battle?.[k] ?? 0), 0);
  for (const k of Object.keys(RELIC_CAP) as (keyof typeof RELIC_CAP)[]) assert.ok(own(k) <= RELIC_CAP[k] + 1e-9, `${k} under its cap`);
});

test('balance at the cap: a pair of relics over the old best kit some 60%, the two pairs even, the anvil’s ceiling a few points', () => {
  const n = 40;
  const uc = kitShare('union_crown', 'sets', n), oc = kitShare('orb_compass', 'sets', n), pair = kitShare('union_crown', 'orb_compass', n), forged = kitShare('forged', 'sets', n);
  assert.ok(uc >= 0.52 && uc <= 0.68, `Union + Crown vs the sets: ${uc}`);
  assert.ok(oc >= 0.5 && oc <= 0.66, `Orb + Compass vs the sets: ${oc}`);
  assert.ok(pair >= 0.4 && pair <= 0.62, `the two pairs: ${pair}`);
  assert.ok(forged >= 0.48 && forged <= 0.62, `every piece forged at its top vs the sets: ${forged}`);
});

test('the odds of a part: the seals’ depths by the seal, the Abyss’s tiers by the share', () => {
  assert.equal(Math.round(sealPartChance(2) * 1000), 32);
  assert.equal(Math.round(sealPartChance(10) * 1000), 80);
  assert.equal(Math.round(sealPartChance(20) * 1000), 140);
  // Five even hands: about one part a week each over the seven tiers.
  let week = 0;
  for (let t = 1; t <= 7; t++) week += abyssPartChance(t, 0.2);
  assert.ok(week > 0.85 && week < 1.15, `${week}`);
  assert.equal(abyssPartChance(7, 1), 0.4);
});

// ------------------------------------------------------------------ on the server

function world(): Game {
  const { game } = makeGame();
  clearOutposts(game);
  quietAdv(game, false);
  return game;
}

function captain(game: Game, name: string): PlayerSession {
  join(game, name);
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'man_o_war', 10);
  runAdmin(game, s, '/level 60');
  return s;
}

const conn = (s: PlayerSession) => (s as unknown as { conn: { push(m: unknown): void } }).conn;
const inbox = (s: PlayerSession) => (s as unknown as { conn: { inbox: { t: string; msg?: string }[] } }).conn.inbox;
const said = (s: PlayerSession, from: number) => inbox(s).slice(from).filter((m) => m.t === 'toast').map((m) => m.msg ?? '');

test('relicPartDrop: a part she lacks first, into her locker with its relic named; the drops go her way', () => {
  const game = world();
  const s = captain(game, 'Relic Hunter');
  const p = s.profile!;
  // All the Union but one of its own parts: the drops find the gap far sooner than chance.
  for (const id of RELICS.boarding_union.parts.slice(1)) p.stash.push(makeArtifact(id, p.itemSeq++));
  const rng = new Rng(3);
  let hit = 0;
  for (let i = 0; i < 400; i++) if (pickPart(rng, p, 'boarding_union') === 'union_pike') hit++;
  assert.ok(hit / 400 > 0.6, `the lacking part ${hit}/400`);
  const n = inbox(s).length;
  const id = relicPartDrop(game, s, 'citadel', 1);
  assert.ok(id && ARTIFACTS[id].part, `${id}`);
  assert.ok(p.stash.some((it) => it.art === id));
  assert.ok(said(s, n).some((m) => /^A part of the .+: .+ \(\d\/\d\)\.$/.test(m)), said(s, n).join(' | '));
  assert.equal(relicPartDrop(game, s, 'citadel', 0), null, 'no luck, no part');
  assert.equal(p.relics?.drops, 1);
});

test('worn part by part, the relic is whole: told once, the chronicle once; the hero window shows its parts', () => {
  const game = world();
  const s = captain(game, 'Union Bearer');
  const p = s.profile!;
  runAdmin(game, s, '/relic parts boarding_union');
  const uids = p.stash.filter((it) => ARTIFACTS[it.art ?? '']?.part === 'boarding_union').map((it) => it.uid);
  assert.equal(uids.length, 6);
  const n = inbox(s).length;
  for (const uid of uids) conn(s).push({ t: 'gear', action: 'equip', uid });
  assert.ok(said(s, n).includes('The Boarding Union is whole: its parts are one relic.'), said(s, n).join(' | '));
  assert.deepEqual(p.relics?.on, ['boarding_union']);
  assert.deepEqual(p.relics?.made, ['boarding_union']);
  const v = heroView(p).relics!.find((r) => r.id === 'boarding_union')!;
  assert.equal(v.worn.length, 6);
  assert.ok(heroView(p).artPrim.atk >= 8, 'the Union’s Attack');
  // Off and on again: apart, then whole, the chronicle not twice.
  conn(s).push({ t: 'gear', action: 'unequip', slot: 'blade' });
  assert.deepEqual(p.relics?.on, []);
  conn(s).push({ t: 'gear', action: 'equip', uid: p.stash.find((it) => it.art === 'union_pike')!.uid });
  assert.deepEqual(p.relics?.on, ['boarding_union']);
  const lines = (game.db.getKv<{ msg: string }[]>('world_chronicle') ?? []).filter((c) => c.msg.includes('Boarding Union'));
  assert.equal(lines.length, 1);
});

test('the Abyss’s Master: the top hand takes a relic’s part for sure', () => {
  const game = world();
  const s = captain(game, 'Maw Diver');
  runAdmin(game, s, '/maw tier 7');
  const before = s.profile!.stash.filter((it) => ARTIFACTS[it.art ?? '']?.part).length;
  runAdmin(game, s, '/maw win');
  steps(game, 2);
  const after = s.profile!.stash.filter((it) => ARTIFACTS[it.art ?? '']?.part).length;
  assert.ok(after >= before + 1, `${before} → ${after}`);
});

// ------------------------------------------------------------------ the anvil (docs/19 E13)

test('the anvil’s cost: hours at sea at ⚓10 by class, half again the first each time, three times at the most', () => {
  const major = makeArtifact('mercy_medal', 1);
  const c0 = forgeCost(major);
  assert.equal(c0.hours, FORGE_HOURS.major);
  const worth = (c: typeof c0) => c.silver + c.pearls * 220 + (c.land.shell ?? 0) * 40 + (c.land.bone ?? 0) * 30 + (c.land.venom ?? 0) * 60;
  assert.ok(Math.abs(worth(c0) / seaHourOf(10) - 0.2) < 0.02, `${worth(c0)} silver’s worth`);
  major.forge = { n: 2 };
  assert.equal(forgeCost(major).hours, Math.round(FORGE_HOURS.major * 2 * 100) / 100);
  major.forge = { n: 99 };
  assert.equal(forgeCost(major).hours, Math.round(FORGE_HOURS.major * (1 + 0.5 * FORGE_RISE_MAX) * 100) / 100);
  assert.ok(forgeCost(makeArtifact('first_mate_cutlass', 2)).silver < c0.silver, 'a treasure is cheaper');
});

test('the anvil’s rolls: the primaries keep their points; a line within its class’s span; the forged lines under their caps', () => {
  const rng = new Rng(11);
  const it = makeArtifact('admirals_signet', 1);
  for (let i = 0; i < 200; i++) {
    const f = forgeRoll(rng, it, 'prim');
    assert.equal(Object.values(f.p ?? {}).reduce((a, b) => a + (b ?? 0), 0), 4);
    const g = forgeRoll(rng, it, 'line');
    const [lo, hi] = forgeSpan('admirals_signet', g.k!);
    assert.ok(g.v! >= lo - 1e-9 && g.v! <= hi + 1e-9, `${g.k} ${g.v}`);
  }
  // Ten pieces all forged with melee at the top: the sum stops at the cap.
  const ten: Item[] = ['drowned_bicorne', 'kelp_coat', 'needle_of_the_deep', 'red_hook_axe', 'hook_brace', 'bloodied_baldric', 'squall_glass', 'deck_grip_boots', 'ring_of_the_gale', 'mercy_medal'].map((id, i) => {
    const x = makeArtifact(id, i + 1);
    x.forge = { n: 1, k: 'melee', v: forgeSpan(id, 'melee')[1] };
    return x;
  });
  const plain = artTotals(ten.map((x) => ({ ...x, forge: undefined })));
  assert.ok(Math.abs(artTotals(ten).battle.melee - plain.battle.melee - FORGE_LINE.melee.cap) < 1e-9);
});

/** A captain at the cap with an island of her own, a market in its town, lying off it, the anvil's means at hand. */
function atAnvil(game: Game): PlayerSession {
  const s = captain(game, 'Smith Captain');
  const home = game.world.islands.find((i) => !i.portId && !i.minor && !i.raft && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id) && !mineSites(game).some((m) => m.islandId === i.id))!;
  parkNear(game, s, home.x, home.y, home.radius + 120);
  s.profile!.gold = 1_000_000;
  assert.equal(buyIsland(game, s, home.id), null);
  townState(yardOf(game, ownIsland(game, s.accountId)!)).b.market = 1;
  s.ship!.cargo.pearls = 60;
  runAdmin(game, s, '/landecon cap');
  return s;
}

test('at the anvil: paid, the new work beside the old, kept or the old back; a second strike waits for the choice', () => {
  setLang('en');
  const game = world();
  const s = atAnvil(game);
  const p = s.profile!;
  const it = makeArtifact('admirals_signet', p.itemSeq++);
  p.stash.push(it);
  const c = forgeCost(it);
  const gold = p.gold, shell = landStore(p).shell;
  h3Message(game, s, { t: 'h3', action: 'forge', uid: it.uid, what: 'line' });
  assert.equal(p.gold, gold - c.silver);
  assert.equal(landStore(p).shell, shell - (c.land.shell ?? 0));
  assert.equal(s.ship!.cargo.pearls, 60 - c.pearls);
  assert.ok(it.forge?.k && it.forge.n === 1 && it.forgeWas, JSON.stringify(it));
  // A second strike before she chooses: refused, nothing paid.
  const n = inbox(s).length;
  h3Message(game, s, { t: 'h3', action: 'forge', uid: it.uid, what: 'prim' });
  assert.ok(said(s, n).includes('Choose first: the new roll or the old one.'), said(s, n).join(' | '));
  assert.equal(p.gold, gold - c.silver);
  // The old back: no line, the count kept; the next strike dearer.
  h3Message(game, s, { t: 'h3', action: 'forgekeep', uid: it.uid, keep: 'old' });
  assert.equal(it.forge?.k, undefined);
  assert.equal(it.forge?.n, 1);
  assert.equal(it.forgeWas, undefined);
  assert.ok(forgeCost(it).silver > c.silver);
  h3Message(game, s, { t: 'h3', action: 'forge', uid: it.uid, what: 'prim' });
  h3Message(game, s, { t: 'h3', action: 'forgekeep', uid: it.uid, keep: 'new' });
  assert.equal(it.forge?.n, 2);
  assert.equal(Object.values(it.forge?.p ?? {}).reduce((a, b) => a + (b ?? 0), 0), 4);
  // Away from the island: refused.
  parkNear(game, s, s.ship!.state.x + 9000, s.ship!.state.y, 0);
  const m = inbox(s).length;
  h3Message(game, s, { t: 'h3', action: 'forge', uid: it.uid, what: 'line' });
  assert.ok(said(s, m).includes('Lie off your island: its workshop forges it.'), said(s, m).join(' | '));
});

test('every new word in Russian: the relics’ and the anvil’s lines', () => {
  setLang('ru');
  try {
    for (const line of [
      'A part of the Crown of the Deep: Bell of the Deep (1/4).', 'The Storm Orb is whole: its parts are one relic.', 'The Compass of the Throne comes apart into its parts.',
      'Anna assembles the Boarding Union.', 'Only an artifact goes to the anvil.', 'It has no primaries to spread.', 'Build a market in your town first: its workshop keeps the anvil.',
      'Lie off your island: its workshop forges it.', 'Choose first: the new roll or the old one.', 'The anvil rings over the Storm Glass: keep the new work or the old.',
      'Nothing waits at the anvil.', 'The Thunder Horn keeps its old work.', 'The Pike of the Boarding Union takes its new work.',
      'Relic parts: 3 worn, 2 in the locker, 4 dropped; relics assembled: 0.', 'Parts dropped: 2 of 3.', 'Every relic part is gone.', 'The Storm Orb: its parts are in the locker.', 'The Storm Orb is worn.',
    ]) {
      const ru = serverText(line);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/Anna/g, '')), `${line} → ${ru}`);
    }
    for (const id of ARTIFACT_IDS) assert.ok(/[а-яё]/i.test(serverText(ARTIFACTS[id].name[0])), id);
  } finally {
    setLang('en');
  }
});
