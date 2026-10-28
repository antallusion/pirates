// The website's captain card (owner, 2026-10-28: «нажимая на капитана я хочу видеть его армию, корабль и все что вообще
// только есть, кроме количества валюты»; server/src/game/siteprofile.ts, GET /api/site/captain/<name>): her army, ship,
// hero, island and feats in both tongues — and never a coin, nothing private: no silver, doubloons, bank, loan, cargo,
// warehouses, trade profit, price intel, no e-mail, token, account id, position, friends or letters. Only a captain the
// rating shows; the unknown and the hidden are a 404; the door has its own limit per address.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { SiteRating } from '../server/src/game/siterating.ts';
import { SiteProfile } from '../server/src/game/siteprofile.ts';
import type { CaptainProfile } from '../server/src/game/siteprofile.ts';
import { newProfile } from '../server/src/game/player.ts';
import { siteRoutes, SITE_LIMITS } from '../server/src/http/site-routes.ts';
import type { WebShop } from '../server/src/game/webshop.ts';
import { makeGame } from './helpers.ts';
import { TALENTS_BY_ID } from '../shared/src/data/talents.ts';

type G = ReturnType<typeof makeGame>;

/** A rich saved captain: money everywhere, private bits everywhere, an army and gear. */
function rich(g: G, name: string): number {
  const id = g.db.createAccount(name, `h-${name}`);
  g.db.setEmail(id, `secret.mail+${id}@example.com`, 'pass-hash-xyz');
  const p = newProfile('corsair', 'Sea Wolf', 'port_royal', 1) as unknown as Record<string, unknown> & ReturnType<typeof newProfile>;
  Object.assign(p, {
    level: 12, xp: 500, gold: 987654, bank: 555111, infamy: 30,
    loan: { amount: 424242, due: 1 }, cargo: { rum: 77 }, warehouses: { port_royal: { sugar: 31337 } },
    priceIntel: { port_royal: { t: 1, sell: { rum: 99999 } } }, costBasis: { rum: 88888 },
    friends: [{ id: 999, name: 'Secret Friend' }], ignored: [{ id: 998, name: 'Hidden Foe' }],
    army: [{ u: 'deckhand', n: 40 }, { u: 'musketeer', n: 12 }],
    stats: { sunk: 9, boarded: 4, tradeProfit: 123456, distance: 81000, sold: 7, fogContraband: 0, harpoonContracts: 0, recruited: 50 },
    titles: ['Friend of the Crown'], title: 'Friend of the Crown', deeds: ['deed_first_prize'], regionsSeen: ['black_coast', 'visited:port_royal'],
    pets: { owned: ['cat'], deck: 'cat' }, beasts: { shark: 3 }, campaign: { at: 12 },
  });
  p.trade.voyageProfit = 7777;
  g.db.saveCaptain(id, p, 12345.5, 67890.25, 1);
  return id;
}

const FORBIDDEN_KEYS = ['gold', 'silver', 'doubloons', 'bank', 'loan', 'cargo', 'warehouses', 'tradeProfit', 'voyageProfit', 'priceIntel', 'costBasis', 'treasury', 'email', 'token', 'token_hash', 'pass_hash', 'acc', 'accountId', 'account_id', 'oauth', 'friends', 'ignored', 'letters', 'x', 'y', 'heading', 'hearsay', 'sightings'];

function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => keysOf(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, out); }
  return out;
}

test('a captain’s card shows her army, ship, hero and feats in both tongues — and no coin, nothing private', () => {
  const g = makeGame();
  rich(g, 'Grace Brine');
  const prof = new SiteProfile(g.game, new SiteRating(g.game));
  const v = prof.get('grace brine') as CaptainProfile;
  assert.ok(v, 'found by her name, case aside');
  assert.equal(v.name, 'Grace Brine');
  assert.equal(v.level, 12);
  assert.equal(v.army.stacks.length, 2);
  assert.equal(v.army.stacks[0].u, 'musketeer', 'the higher tier first');
  assert.ok(v.army.power > 0 && v.army.stacks.every((s) => s.power > 0 && s.name[1] && s.tier >= 1));
  assert.ok(v.ship && v.ship.cls && v.ship.hullMax > 0 && v.ship.clsName[1]);
  assert.ok(v.hero.prim.length === 4);
  assert.deepEqual(v.titles[0], ['Friend of the Crown', 'Друг Короны']);
  assert.equal(v.feats.deeds[0].id, 'deed_first_prize');
  assert.deepEqual(v.feats.regions.map((r) => r[0]), ['The Black Coast'], 'the seas only, no port visits');
  assert.equal(v.feats.pets[0].deck, true);
  assert.equal(v.stats.sunk, 9);
  assert.equal(v.online, false);
  assert.equal(v.sea, null, 'no sea while ashore');
  const json = JSON.stringify(v);
  const keys = keysOf(v);
  for (const k of FORBIDDEN_KEYS) assert.ok(!keys.has(k), `no «${k}» on the wire`);
  for (const n of ['987654', '555111', '424242', '31337', '99999', '88888', '123456', '7777', '12345.5', '67890.25']) assert.ok(!json.includes(n), `no ${n} (money or position) on the wire`);
  for (const s of ['secret.mail', 'example.com', 'pass-hash', 'h-Grace', 'Secret Friend', 'Hidden Foe']) assert.ok(!json.includes(s), `no ${s} on the wire`);
  assert.doesNotMatch(json, /doubloon|дублон|серебр|silver/i);
});

test('every hoverable thing carries the game’s own card: gear, ship fittings, creatures, skills — and no coin in it', () => {
  const g = makeGame();
  const id = rich(g, 'Tip Tester');
  const row = g.db.loadCaptain(id)!;
  const p = JSON.parse(row.data) as ReturnType<typeof newProfile>;
  p.captainGear = { ...(p.captainGear ?? {}), hat: { uid: 9001, base: 'tricorne', ilvl: 14, rarity: 1, affixes: [], dur: 87 } as never };
  p.loadout.gear = { ...(p.loadout.gear ?? {}), sails: { uid: 9002, base: 'canvas_sails', ilvl: 10, rarity: 2, affixes: [], dur: 100, set: 'bounty_hunter' } as never };
  p.loadout.modules = { ...(p.loadout.modules ?? {}), rudder: 2 } as never;
  p.talents = { ...(p.talents ?? {}), [Object.keys(TALENTS_BY_ID)[0]]: 1 };
  g.db.saveCaptain(id, p, 1, 1, 1);
  const v = new SiteProfile(g.game, new SiteRating(g.game)).get('Tip Tester') as CaptainProfile;
  const hat = v.hero.gear.find((x) => x.slot === 'hat');
  assert.ok(hat?.tip, 'the hat has its card');
  assert.equal(hat.tip.color, hat.color, 'its name in its rarity’s colour');
  assert.match(hat.tip.sub![1], /Добротный · Шляпа · уровень 14/);
  assert.ok(hat.tip.rows!.some((r) => r.k[1] === 'Лидерство' && /^\+\d+$/.test(r.v[0])), 'its lines, as the game writes them');
  assert.ok(hat.tip.notes!.some((n) => n.t[1] === 'Прочность 87%'), 'its wear');
  const sails = v.ship!.gear.find((x) => x.slot === 'sails');
  assert.ok(sails?.tip?.notes!.some((n) => n.tone === 'head' && /\(1\/\d\)/.test(n.t[0])), 'a set piece shows its set and how much of it is worn');
  assert.ok(v.ship!.guns.length && v.ship!.guns.every((x) => x.tip && x.tip.rows!.length >= 5 && x.tip.notes![0].t[1]), 'a gun: its numbers and its words');
  const rud = v.ship!.modules.find((m) => m.id === 'rudder');
  assert.ok(rud?.tip && /2\/2/.test(rud.tip.sub![0]) && rud.tip.rows![0].v[0] === '+16%', 'a fitting at its level');
  assert.ok(v.army.stacks.every((s) => s.tip && s.tip.rows!.some((r) => r.k[0] === 'Health') && s.tip.name[0].includes(`×${s.n}`)), 'a creature: its numbers');
  assert.ok(v.hero.skills.every((s) => s.tip && s.tip.notes!.some((n) => n.tone === 'on')), 'a skill: her rank lit');
  assert.ok(v.hero.orders.every((o) => o.tip && o.tip.notes![0].t[0]), 'an order: what it does');
  assert.ok(v.hero.talents.length > 0 && v.hero.talents.every((t) => t.tip && t.tip.notes![0].t[1]), 'a talent: what it does');
  assert.ok(v.feats.deeds[0].tip && v.feats.pets[0].tip, 'a deed and a pet');
  const json = JSON.stringify(v);
  assert.doesNotMatch(json, /doubloon|дублон|серебр|silver|"price"|"cost"|upkeep/i, 'no coin in any card');
});

test('the unknown and the hidden are none; the card is kept half a minute', () => {
  const g = makeGame();
  rich(g, 'Open Sail');
  rich(g, 'Bot q1w2e3');
  rich(g, 'Hidden Hand');
  g.db.setKv('site_hidden', ['hidden hand']);
  let now = 1_000_000;
  const prof = new SiteProfile(g.game, new SiteRating(g.game, { now: () => now }), { now: () => now });
  assert.equal(prof.get('Nobody Here'), null);
  assert.equal(prof.get('Bot q1w2e3'), null, 'a load-test bot is not shown');
  assert.equal(prof.get('Hidden Hand'), null, 'the owner’s list is not shown');
  const a = prof.get('Open Sail');
  assert.ok(a);
  assert.equal(prof.get('open sail'), a, 'the same card within the half minute');
  now += 31_000;
  assert.notEqual(prof.get('Open Sail'), a, 'read afresh after it');
});

test('GET /api/site/captain/<name>: the card, a 404, a bad name, the limit per address', async () => {
  const g = makeGame();
  rich(g, 'Мара Квилл');
  const rating = new SiteRating(g.game);
  const handle = siteRoutes({ rating, profile: new SiteProfile(g.game, rating), shop: {} as WebShop, publicUrl: 'https://gravetidegame.com' });
  const srv = createServer((req, res) => void handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  const get = (path: string) => new Promise<{ status: number; body: string }>((ok, bad) => {
    request({ host: '127.0.0.1', port, path }, (rs) => { let b = ''; rs.setEncoding('utf8'); rs.on('data', (c) => (b += c)); rs.on('end', () => ok({ status: rs.statusCode ?? 0, body: b })); }).on('error', bad).end();
  });
  try {
    const r = await get(`/api/site/captain/${encodeURIComponent('мара квилл')}`);
    assert.equal(r.status, 200);
    const v = JSON.parse(r.body) as CaptainProfile;
    assert.equal(v.name, 'Мара Квилл');
    assert.ok(!r.body.includes('987654') && !r.body.includes('secret.mail'));
    assert.equal((await get('/api/site/captain/Nobody%20At%20All')).status, 404);
    assert.equal((await get('/api/site/captain/x')).status, 400);
    const max = SITE_LIMITS.profile[0][0];
    let last = 0;
    for (let i = 0; i < max + 2; i++) last = (await get('/api/site/captain/Nobody%20At%20All')).status;
    assert.equal(last, 429, 'the limit per address');
  } finally {
    srv.close();
  }
});
