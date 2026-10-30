// Cosmetics other captains see (owner, 2026-10-19; shared/src/data/cosmetics.ts, server/src/game/cosmetics.ts,
// docs/32 §12): the catalogue on the shop's ladder, every thing its picture, a purchase through the shop's own path
// (the ledger's row, the purchase id once, nothing twice), wearing it, the wire's round trip and another captain seeing
// it on her ship's card, the earned things from her stats, the seasonal bundles' dates, the emotes' pace, both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  BUNDLES, CLOTHS, COS_EMOTES, COS_KINDS, COS_TABLES, EMBLEMS, EMOTE_PACKS, EQUIP_SLOTS, FRAMES, FREE_KEYS, NO_EQUIP, PLATES, TITLES, TRAILS,
  bundleWorth, cosArt, cosItem, cosKey, cosPrice, decodeCos, encodeCos, expandKeys,
} from '../shared/src/data/cosmetics.ts';
import type { CosEquip } from '../shared/src/data/cosmetics.ts';
import { LADDER, OFFERS, PRICE_MAX, PRICE_MIN, SHOP, TAB_SECS } from '../shared/src/data/shop.ts';
import { CAMPAIGN_SIZE } from '../shared/src/data/campaign/plan.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { buyOffer, forgetShop } from '../server/src/game/shop.ts';
import { forgetArena } from '../server/src/game/arena.ts';
import { checkEarned, cosState, earnMet, emotePace, equipCos, forgetCos, ownsCos, sendEmote } from '../server/src/game/cosmetics.ts';
import type { Game } from '../server/src/game/Game.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { Database } from '../server/src/persistence/db.ts';
import type { ShipInfo } from '../shared/src/protocol.ts';
import { serverTable, serverText } from '../client/src/lang/server.ts';
import { EN as C_EN, RU as C_RU } from '../client/src/lang/ui/cosmetics.ts';
import { setLang } from '../client/src/i18n.ts';
import { join, makeGame, steps } from './helpers.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { FakeConn } from './helpers.ts';

let n = 0;
const pid = () => `cos${++n}test`;
const OCT_20 = Date.UTC(2026, 9, 20, 12);

function world(clock = OCT_20): { game: Game; db: Database } {
  const w = makeGame();
  w.game.wallNow = () => clock;
  forgetShop(w.game);
  forgetCos(w.game);
  return w;
}

function captain(game: Game, name: string, dbl = 0): { s: PlayerSession; c: FakeConn } {
  const c = join(game, name, 'corsair');
  const s = game.sessionByName(name)!;
  if (dbl) assert.ok(creditPremium(game, s.accountId, dbl, 'admin', 'test') !== null);
  return { s, c };
}

/** Open water near (x, y). */
function openWater(game: Game, x: number, y: number): { x: number; y: number } {
  for (let r = 1200; r < 6000; r += 300) for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const px = x + Math.sin(a) * r, py = y - Math.cos(a) * r;
    if (!isLand(game.world, px, py) && !isLand(game.world, px + 160, py) && !isLand(game.world, px - 40, py)) return { x: px, y: py };
  }
  throw new Error('no water');
}

function toSea(game: Game, s: PlayerSession, x: number, y: number): void {
  const ship = s.ship!;
  ship.docked = null;
  ship.state.x = x;
  ship.state.y = y;
  ship.state.speed = 0;
  ship.protectedUntil = 0;
  game.grid.upsert(ship.id, x, y);
}

function buys(db: Database, account: number): { amount: number; detail: string }[] {
  const raw = (db as unknown as { db: DatabaseSync }).db.prepare(`SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = 'doubloons_buy' ORDER BY id`).all(account) as { amount: number; detail: string }[];
  return raw.map((r) => ({ amount: Number(r.amount), detail: String(r.detail) }));
}

// ------------------------------------------------------------------------------------------------ the catalogue

test('the catalogue: the owner\'s sets (24+ titles, 8 plates, 9 frames, 15 emblems, 10 colours, 6 trails, 16 emotes), ids unique, both languages', () => {
  assert.ok(TITLES.length >= 24, `titles: ${TITLES.length}`);
  assert.equal(PLATES.length, 8);
  assert.equal(FRAMES.length, 9);
  assert.equal(EMBLEMS.length, 15, 'sixteen painted, the shark\'s jaws not kept (a bone)');
  assert.ok(!EMBLEMS.some((e) => /jaw|shark/i.test(e.id)));
  // (the season card's own, owner 2026-10-30: two cloths and two wakes more, `only: 'spass'`)
  assert.ok(CLOTHS.filter((c) => c.only !== 'spass').length >= 8 && CLOTHS.filter((c) => c.only !== 'spass').length <= 11, 'ten colours and the PvP season’s banner (pvprank.ts)');
  assert.deepEqual(TRAILS.filter((t) => t.only !== 'spass').map((t) => t.id).sort(), ['fire', 'frost', 'gold', 'ink', 'mist', 'plankton']);
  assert.deepEqual(TRAILS.filter((t) => t.only === 'spass').map((t) => t.id).sort(), ['aurora', 'storm']);
  assert.equal(COS_EMOTES.length, 16);
  for (const k of COS_KINDS) {
    const ids = COS_TABLES[k].map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${k}: unique ids`);
    for (const x of COS_TABLES[k]) {
      assert.ok(/[а-яё]/i.test(x.name[1]), `${k}:${x.id} in Russian`);
      assert.ok(!/[A-Za-z]/.test(x.name[1]), `${k}:${x.id}: no Latin in the Russian (${x.name[1]})`);
      assert.ok(x.name[0].length > 1);
      const ways = [x.price !== undefined, !!x.earn, !!x.only, !!(x as { pack?: string }).pack].filter(Boolean).length;
      assert.equal(ways, 1, `${k}:${x.id}: free, bought (alone or in a pack), earned or a bundle's own — one of them`);
    }
  }
  // emotes: two free, two earned, the rest in packs of four
  assert.equal(COS_EMOTES.filter((e) => e.price === 0).length, 2);
  assert.equal(COS_EMOTES.filter((e) => e.earn).length, 2);
  for (const p of EMOTE_PACKS) assert.equal(COS_EMOTES.filter((e) => e.pack === p.id).length, 4, p.id);
  // plates and emblems: the higher the tier, the dearer
  for (const list of [PLATES, FRAMES, EMBLEMS, TITLES]) {
    const sold = list.filter((x) => cosPrice(x));
    for (const a of sold) for (const b of sold) if (a.tier > b.tier) assert.ok(cosPrice(a)! >= cosPrice(b)!, `${a.id} (${a.tier}) not cheaper than ${b.id} (${b.tier})`);
  }
  // every bundle key names a thing; a bundle is worth more than its price
  for (const b of BUNDLES) {
    for (const k of expandKeys(b.keys)) assert.ok(cosItem(k), `${b.id}: ${k}`);
    assert.ok(bundleWorth(b) > b.price, `${b.id}: worth ${bundleWorth(b)}`);
    assert.ok(/[а-яё]/i.test(b.name[1] + b.text[1]) && !/[A-Za-z]{2,}/.test(b.name[1] + b.text[1]), b.id);
  }
  // the seasonal bundles are dated: Halloween to 3 November 2026
  assert.equal(BUNDLES.find((b) => b.id === 'cos_halloween')!.until, Date.UTC(2026, 10, 3));
});

test('the prices on the shop\'s ladder: things 290 / 590 / 990 by tier, the legendary 4 990, bundles 1 990 — and on the shelves of the «Косметика» tab', () => {
  const single = new Set([290, 590, 990, 4990]);
  for (const k of COS_KINDS) for (const x of COS_TABLES[k]) {
    const p = cosPrice(x);
    if (p) assert.ok(single.has(p), `${k}:${x.id} ${p}`);
    if (p === 4990) assert.equal(x.tier, 4, `${x.id}: only the legendary at 4 990`);
  }
  for (const b of BUNDLES) assert.equal(b.price, 1990);
  for (const p of EMOTE_PACKS) assert.ok(single.has(p.price));
  const fams = SHOP.filter((f) => f.tabs[0] === 'cos');
  assert.ok(fams.length >= 50, `families: ${fams.length}`);
  for (const f of fams) {
    assert.ok(TAB_SECS.cos.includes(f.sec), f.id);
    for (const o of f.offers) {
      assert.ok(LADDER.includes(o.price), `${o.id}: ${o.price} on the ladder`);
      assert.ok(o.price >= PRICE_MIN && o.price <= PRICE_MAX);
      assert.deepEqual(o.limit, { n: 1, per: 'ever' });
      assert.ok(o.grants.every((g) => g.k === 'cos'));
    }
  }
  // the free and the earned are never on a shelf
  for (const k of FREE_KEYS) assert.ok(!OFFERS.has(`cos_${k.replace(':', '_')}`), k);
  assert.ok(!OFFERS.has('cos_frame_kraken') && !OFFERS.has('cos_plate_corsair') && !OFFERS.has('cos_title_tide'));
});

test('every cosmetic has its picture (the manifest\'s file, WebP and its size), the shop\'s sections their icons', () => {
  const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Record<string, { local: string }> };
  const size = (file: string): [number, number] => {
    const b = readFileSync(file);
    // a lossless or lossy WebP's canvas: VP8X carries it at 24..29
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    if (b.toString('ascii', 12, 16) === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (b.toString('ascii', 12, 16) === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  };
  const want: Record<string, [number, number]> = { plate: [512, 144], frame: [256, 256], emblem: [128, 128], emote: [128, 128] };
  for (const k of COS_KINDS) for (const x of COS_TABLES[k]) {
    const art = cosArt(x);
    if (!art) {
      assert.ok(['title', 'cloth', 'trail'].includes(k), `${k}: drawn by code`);
      continue;
    }
    const e = m.assets[art];
    assert.ok(e, `${art} in the manifest`);
    const file = `assets/${e.local}`;
    assert.ok(existsSync(file), file);
    assert.deepEqual(size(file), want[k], file);
  }
  for (const id of ['cos_titles', 'cos_frames', 'cos_flags', 'cos_trails', 'cos_emotes', 'cos_bundle', 'cos_halloween', 'cos_winter']) {
    assert.ok(m.assets[`icon.${id}`], id);
    assert.deepEqual(size(`assets/${m.assets[`icon.${id}`].local}`), [192, 192], id);
  }
  for (const f of SHOP.filter((x) => x.tabs[0] === 'cos')) assert.ok(m.assets[`icon.${f.icon}`], `${f.id}: icon.${f.icon}`);
});

// ------------------------------------------------------------------------------------------------ the wire

test('the wire: what she wears in at most 17 characters, read back the same; anything malformed is nothing', () => {
  const all: CosEquip[] = [{ ...NO_EQUIP }];
  for (const p of PLATES) for (const t of [TITLES[0], TITLES[TITLES.length - 1]]) all.push({ ...NO_EQUIP, plate: p.id, title: t.id, frame: FRAMES[PLATES.indexOf(p)]?.id ?? null, emblem: EMBLEMS[14].id, cloth: CLOTHS[9].id, trail: TRAILS[5].id });
  for (const e of all) {
    const w = encodeCos(e);
    assert.ok(w.length <= 17, w);
    assert.deepEqual(decodeCos(w), e);
  }
  for (const bad of ['', '1.2.3', 'zz.-.-.-.-.-', '0.0.0.0.0.0.0', 'x'.repeat(40), '-.-.-.-.-.Z', '-1.-.-.-.-.-', 42, null, '__proto__.-.-.-.-.-']) assert.equal(decodeCos(bad), null, String(bad));
  assert.deepEqual(decodeCos('-.-.-.-.-.-'), NO_EQUIP);
});

// ------------------------------------------------------------------------------------------------ buy, own, wear, seen

test('a purchase: the shop\'s path (its price, its ledger row, the purchase id once), owned for good, never twice; too poor: nothing moves', () => {
  const { game, db } = world();
  const { s } = captain(game, 'Bella', 5000);
  const before = game.db.doubloons(s.accountId);
  assert.ok(!ownsCos(game, s.accountId, 'plate:gold'));
  const p1 = pid();
  assert.equal(buyOffer(game, s, 'cos_plate_gold', p1), null);
  assert.equal(game.db.doubloons(s.accountId), before - 990);
  assert.equal(buyOffer(game, s, 'cos_plate_gold', p1), null, 'the same purchase id: bought once');
  assert.equal(game.db.doubloons(s.accountId), before - 990);
  assert.deepEqual(buys(db, s.accountId), [{ amount: -990, detail: `shop:cos_plate_gold:${p1}` }]);
  assert.ok(ownsCos(game, s.accountId, 'plate:gold'));
  assert.ok(buyOffer(game, s, 'cos_plate_gold', pid()), 'never twice');
  // kept on her account (the kv table), not in this process's memory
  forgetCos(game);
  assert.ok(ownsCos(game, s.accountId, 'plate:gold'));
  // an emote pack: its four
  assert.equal(buyOffer(game, s, 'cos_pack_powder', pid()), null);
  for (const e of COS_EMOTES.filter((x) => x.pack === 'powder')) assert.ok(ownsCos(game, s.accountId, cosKey(e)), e.id);
  // the free things need no purchase and are never sold
  assert.ok(ownsCos(game, s.accountId, 'plate:driftwood') && ownsCos(game, s.accountId, 'emote:parrot'));
  // too poor: a refusal, nothing charged
  const { s: poor } = captain(game, 'Pauper', 300);
  assert.match(buyOffer(game, poor, 'cos_plate_abyss', pid()) ?? '', /Not enough doubloons/);
  assert.equal(game.db.doubloons(poor.accountId), 300);
  assert.ok(!ownsCos(game, poor.accountId, 'plate:abyss'));
  // the Abyssal frame is the Super Pass's alone since 2026-10-30 (seasonpass.ts SUPER_FRAME): off the shelves
  assert.equal(buyOffer(game, captain(game, 'Croesus', 9000).s, 'cos_frame_abyss', pid()), 'Not for sale');
  // a bundle she has all of: refused; part of it: bought, the rest handed over
  const { s: rich } = captain(game, 'Midas', 9000);
  assert.equal(buyOffer(game, rich, 'cos_plate_silver', pid()), null);
  assert.equal(buyOffer(game, rich, 'cos_starter', pid()), null);
  for (const k of expandKeys(BUNDLES[0].keys)) assert.ok(ownsCos(game, rich.accountId, k), k);
});

test('the seasonal bundles: Halloween\'s on the shelf until 3 November, gone after; Winter\'s from 15 December', () => {
  const { game } = world(OCT_20);
  const { s } = captain(game, 'Hallow', 5000);
  assert.ok(buyOffer(game, s, 'cos_winter', pid()), 'winter not yet');
  assert.equal(buyOffer(game, s, 'cos_halloween', pid()), null);
  assert.ok(ownsCos(game, s.accountId, 'title:phantom'));
  const late = world(Date.UTC(2026, 10, 3, 0, 0, 1));
  const { s: s2 } = captain(late.game, 'Latecomer', 5000);
  assert.match(buyOffer(late.game, s2, 'cos_halloween', pid()) ?? '', /gone/);
  assert.equal(late.game.db.doubloons(s2.accountId), 5000);
  const dec = world(Date.UTC(2026, 11, 20));
  const { s: s3 } = captain(dec.game, 'Frosty', 5000);
  assert.equal(buyOffer(dec.game, s3, 'cos_winter', pid()), null);
});

test('wearing: only what she owns; a title brings its plate; another captain in sight sees it on her ship\'s card', () => {
  const { game } = world();
  const { s: a, c: ca } = captain(game, 'Anne', 5000);
  const { s: b, c: cb } = captain(game, 'Bonny', 0);
  // both out of the harbour, Bonny beside Anne
  const at = openWater(game, a.ship!.state.x, a.ship!.state.y);
  toSea(game, a, at.x, at.y);
  toSea(game, b, at.x + 120, at.y);
  steps(game, 4);
  assert.match(equipCos(game, a, 'frame', 'abyss') ?? '', /do not own/);
  assert.equal(buyOffer(game, a, 'cos_title_devil', pid()), null);
  assert.equal(buyOffer(game, a, 'cos_trail_fire', pid()), null);
  assert.equal(buyOffer(game, a, 'cos_emblem_raven', pid()), null);
  ca.push({ t: 'cos', action: 'equip', slot: 'title', id: 'devil' });
  ca.push({ t: 'cos', action: 'equip', slot: 'trail', id: 'fire' });
  ca.push({ t: 'cos', action: 'equip', slot: 'emblem', id: 'raven' });
  ca.push({ t: 'cos', action: 'equip', slot: 'cloth', id: 'crimson' });
  ca.push({ t: 'cos', action: 'equip', slot: 'frame', id: 'rope' });
  const eq = cosState(game, a.accountId).eq;
  assert.deepEqual(eq, { title: 'devil', plate: 'driftwood', frame: 'rope', emblem: 'raven', cloth: 'crimson', trail: 'fire' });
  assert.equal(ca.last('cos')!.view.eq.trail, 'fire', 'her wardrobe\'s view');
  // a malformed order: refused, nothing changes
  ca.push({ t: 'cos', action: 'equip', slot: '__proto__' as 'title', id: 'x' });
  ca.push({ t: 'cos', action: 'equip', slot: 'plate', id: 'abyss' });
  assert.equal(cosState(game, a.accountId).eq.plate, 'driftwood');
  // the ship's card as Bonny's client gets it
  const from = cb.inbox.length;
  steps(game, 6);
  const cards = cb.inbox.slice(from).filter((m) => m.t === 'info').flatMap((m) => (m as { list: ShipInfo[] }).list).filter((x) => x.kind === 'ship' && x.id === a.ship!.id);
  assert.ok(cards.length, 'her card re-sent after the change');
  const seen = decodeCos(cards[cards.length - 1].cos);
  assert.deepEqual(seen, eq, 'Bonny sees what Anne wears');
  // taken off: the card says so too
  ca.push({ t: 'cos', action: 'equip', slot: 'plate', id: null });
  assert.equal(cosState(game, a.accountId).eq.title, null);
  // a new captain sees it on first sight (the card a ship comes into sight with) — her frame in her chat line too
  ca.push({ t: 'chat', text: 'ahoy there', ch: 'local' });
  const line = cb.all('chat').find((m) => m.text === 'ahoy there');
  assert.equal(line?.fr, 'rope');
  // her card (inspect): the frame
  const card = a.ship!.info();
  assert.equal(decodeCos(card.cos)!.trail, 'fire');
});

// ------------------------------------------------------------------------------------------------ earned

test('earned things: her level, the campaign done, a hundred boardings won, the Colosseum\'s rating — hers for good, a toast each', () => {
  const { game } = world();
  const { s, c } = captain(game, 'Grace');
  const p = s.profile!;
  assert.ok(!ownsCos(game, s.accountId, 'frame:copper'));
  p.level = 20;
  assert.ok(checkEarned(game, s));
  assert.ok(ownsCos(game, s.accountId, 'frame:copper'));
  assert.ok(c.all('toast').some((t) => t.msg === 'Earned: Copper Porthole!'));
  assert.ok(!checkEarned(game, s), 'once');
  p.level = 30;
  checkEarned(game, s);
  assert.ok(ownsCos(game, s.accountId, 'emote:salute'));
  p.level = 60;
  checkEarned(game, s);
  assert.ok(ownsCos(game, s.accountId, 'title:admiral'));
  p.stats.boarded = 99;
  checkEarned(game, s);
  assert.ok(!ownsCos(game, s.accountId, 'plate:corsair'));
  p.stats.boarded = 100;
  checkEarned(game, s);
  assert.ok(ownsCos(game, s.accountId, 'plate:corsair') && ownsCos(game, s.accountId, 'title:boarder'));
  p.campaign = { ...(p.campaign ?? { picks: {}, started: 0, from: 0 }), at: CAMPAIGN_SIZE } as typeof p.campaign;
  checkEarned(game, s);
  assert.ok(ownsCos(game, s.accountId, 'title:tide') && ownsCos(game, s.accountId, 'frame:admiral'));
  // the Colosseum: her season's best on its table
  assert.ok(!earnMet({ k: 'arena', rating: 1200 }, { level: 1, boarded: 0, campaign: 0, campaignSize: 10, arena: 1199 }));
  assert.ok(earnMet({ k: 'arena', rating: 1200 }, { level: 1, boarded: 0, campaign: 0, campaignSize: 10, arena: 1260 }));
  {
    // (a world of its own: the Colosseum's table is read once and kept)
    const w2 = world();
    assert.ok(!w2.game.db.getKv('arena'), 'no table yet');
    const { s: g2 } = captain(w2.game, 'Gladia');
    w2.game.db.setKv('arena', { v: 1, season: 0, rows: { [g2.accountId]: { name: 'Gladia', path: 'corsair', r: 1210, n: 14, w: 10, best: 1240, at: 0 } }, pairs: { day: 0, n: {} }, hall: [], owed: {} });
    forgetArena(w2.game);
    checkEarned(w2.game, g2);
    assert.ok(ownsCos(w2.game, g2.accountId, 'frame:kraken') && ownsCos(w2.game, g2.accountId, 'title:arena') && ownsCos(w2.game, g2.accountId, 'emote:trophy'));
  }
  // hers for good: her level falling back (a new captain) takes nothing away
  p.level = 1;
  checkEarned(game, s);
  assert.ok(ownsCos(game, s.accountId, 'frame:copper'));
  // and the stepping game finds them by itself
  const { s: s3, c: c3 } = captain(game, 'Stepper');
  s3.profile!.level = 25;
  steps(game, 120);
  assert.ok(ownsCos(game, s3.accountId, 'frame:copper'));
  assert.ok(c3.last('cos')!.view.own.includes('frame:copper'));
});

// ------------------------------------------------------------------------------------------------ emotes

test('emotes: only her own, over her ship for the captains in sight and into the local chat; one every 2.5 s, four in 30 s', () => {
  const { game } = world();
  const { s: a, c: ca } = captain(game, 'Mary', 1000);
  const { s: b, c: cb } = captain(game, 'Read', 0);
  b.ship!.state.x = a.ship!.state.x + 150;
  b.ship!.state.y = a.ship!.state.y;
  game.grid.upsert(b.ship!.id, b.ship!.state.x, b.ship!.state.y);
  steps(game, 4);
  assert.match(sendEmote(game, a, 'cannon') ?? '', /do not own/);
  assert.match(sendEmote(game, a, 'nope') ?? '', /Not now/);
  const from = cb.inbox.length;
  ca.push({ t: 'cos', action: 'emote', id: 'parrot' });
  steps(game, 3);
  const evs = cb.inbox.slice(from).filter((m) => m.t === 'ev').flatMap((m) => (m as { list: { k: string; ship?: number; e?: string }[] }).list).filter((e) => e.k === 'emote');
  assert.deepEqual(evs.map((e) => [e.ship, e.e]), [[a.ship!.id, 'parrot']], 'Read sees it over Mary\'s ship');
  const line = cb.all('chat').find((m) => m.emo === 'parrot');
  assert.ok(line && line.from === 'Mary' && line.ch === 'local', 'and in the local chat');
  // the pace
  assert.match(sendEmote(game, a, 'hook') ?? '', /Not so fast/);
  game.now += 2.6;
  assert.equal(sendEmote(game, a, 'hook'), null);
  game.now += 2.6;
  assert.equal(sendEmote(game, a, 'parrot'), null);
  game.now += 2.6;
  assert.equal(sendEmote(game, a, 'parrot'), null);
  game.now += 2.6;
  assert.match(sendEmote(game, a, 'parrot') ?? '', /Not so fast/, 'four in thirty seconds');
  game.now += 30;
  assert.equal(sendEmote(game, a, 'parrot'), null);
  // a pace of its own per captain
  assert.ok(emotePace(game, b));
});

// ------------------------------------------------------------------------------------------------ both languages

test('every word in both languages: the window\'s dictionary (no Latin in the Russian), the server\'s lines', () => {
  assert.deepEqual(Object.keys(C_RU).sort(), Object.keys(C_EN).sort());
  for (const k of Object.keys(C_EN) as (keyof typeof C_EN)[]) {
    assert.ok(C_RU[k].trim(), k);
    assert.ok(!/[A-Za-z]/.test(C_RU[k].replace(/\{\w+\}/g, '')), `${k}: no Latin in «${C_RU[k]}»`);
  }
  const table = serverTable();
  for (const x of ['Earned: {0}!', 'Not so fast: one emote at a time.', 'You do not own this yet.']) assert.ok(table[x], x);
  setLang('ru');
  try {
    assert.equal(serverText('Earned: Copper Porthole!'), 'Получено: Медный иллюминатор!');
    assert.ok(!/[A-Za-z]{3,}/.test(serverText('Not so fast: one emote at a time.')));
  } finally {
    setLang('en');
  }
  void EQUIP_SLOTS;
});
