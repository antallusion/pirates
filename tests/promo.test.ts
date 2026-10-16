// Her personal offers (owner, 2026-10-15; server/src/game/promo.ts): drawn from her context's shelves at 10–30 % off on the
// shop's grid within 290–9 900; each runs out and, after a rest, a new one rolls in; bought at the offer's own price,
// once, through the shop's checks; closed where it shows; the island's offer only for a captain with an island; the
// entry carousel once a day; the owner's figures; every word in both languages.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { BASE_RES } from '../shared/src/data/base.ts';
import { OFFERS, PRICE_MAX, PRICE_MIN } from '../shared/src/data/shop.ts';
import type { PromoView } from '../shared/src/premiumproto.ts';
import { lairIsland } from '../server/src/game/wanted.ts';
import type { Island } from '../shared/src/world/worldgen.ts';
import { isLand } from '../shared/src/world/worldgen.ts';
import type { Game } from '../server/src/game/Game.ts';
import { yardOf } from '../server/src/game/base.ts';
import { buyIsland, clearOutposts, ownIsland } from '../server/src/game/estate.ts';
import { creditPremium } from '../server/src/game/premium.ts';
import { PROMO_CTXS, PROMO_OFFS, PROMO_POOL, buyPromo, closePromo, forgetPromo, promoMessage, promoPrice, promoStats, promoView, rotatePromos, seenPromo } from '../server/src/game/promo.ts';
import { runAdmin } from '../server/src/game/admin.ts';
import type { PlayerSession } from '../server/src/game/player.ts';
import type { ShipEntity } from '../server/src/game/ship.ts';
import type { Database } from '../server/src/persistence/db.ts';
import { extract } from '../tools/i18n-server.ts';
import { serverTable } from '../client/src/lang/server.ts';
import { SERVER_RU_ADMIN } from '../client/src/lang/server.ru.admin.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/promo.ts';
import { join, makeGame, onHull } from './helpers.ts';

const DAY = 86_400_000;
const H = 3_600_000;
let clock = 20_000 * DAY + 3 * H;
let n = 0;
const pid = () => `promo${++n}xyz`;

function world(): { game: Game; db: Database } {
  const w = makeGame();
  clock = 20_000 * DAY + 3 * H;
  w.game.wallNow = () => clock;
  clearOutposts(w.game);
  return w;
}

function offShore(game: Game, ship: ShipEntity, is: Island): void {
  ship.docked = null;
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    const x = is.x + Math.sin(a) * (is.radius + 120), y = is.y - Math.cos(a) * (is.radius + 120);
    if (isLand(game.world, x, y)) continue;
    ship.state.x = x;
    ship.state.y = y;
    break;
  }
  ship.state.speed = 0;
  ship.region = is.region;
  game.grid.upsert(ship.id, ship.state.x, ship.state.y);
}

function captain(game: Game, name: string, dbl = 0, isle = false): PlayerSession {
  join(game, name, 'admiral');
  const s = game.sessionByName(name)!;
  onHull(game, s.ship!, 'brig', 5);
  s.profile!.level = 30;
  if (dbl) creditPremium(game, s.accountId, dbl, 'admin', 'test');
  if (isle) {
    const home = game.world.islands.find((i) => !i.portId && i.region === 'gravewater' && i.radius > 150 && !game.holdings.get(game, i.id) && !lairIsland(game, i.id))!;
    offShore(game, s.ship!, home);
    assert.equal(buyIsland(game, s, home.id), null);
    const y = yardOf(game, ownIsland(game, s.accountId)!);
    for (const g of BASE_RES) y.res[g] = 1000;
  }
  return s;
}

const mine = (v: PromoView) => v.cards.filter((c) => !c.special);

test('an offer is drawn from its context\'s shelves at 10–30 % off, on the shop\'s grid within 290–9 900', () => {
  for (const ctx of PROMO_CTXS) {
    assert.ok(PROMO_POOL[ctx].length >= 5, `${ctx}: a pool to draw from`);
    for (const id of PROMO_POOL[ctx]) {
      const { fam, offer } = OFFERS.get(id)!;
      assert.ok(!offer.limit && fam.sec !== 'deals', id);
      assert.equal(ctx === 'isle' ? fam.tabs[0] === 'isle' : ctx === 'board' ? fam.tabs[0] === 'board' : fam.tabs[0] === 'sea', true, `${id} is the ${ctx}'s`);
      for (const off of PROMO_OFFS) {
        const p = promoPrice(offer.price, off);
        assert.ok(p.price >= PRICE_MIN && p.price <= PRICE_MAX, `${id} −${off}%: ${p.price}`);
        assert.ok(p.price < offer.price && p.off >= 5 && p.off <= 30, `${id} −${off}%: ${p.price} of ${offer.price} (${p.off}%)`);
        assert.equal(p.price % 100, 90, 'on the grid');
      }
    }
  }
});

test('three offers, one a context; each runs out, the context rests, and a new one rolls in; the dice are hers', () => {
  const { game } = world();
  const s = captain(game, 'Rotor', 0, true);
  const v = promoView(game, s);
  assert.deepEqual(mine(v).map((c) => c.ctx).sort(), ['board', 'isle', 'sea']);
  for (const c of mine(v)) {
    assert.ok(c.until - clock >= 2 * H && c.until - clock <= 24 * H, 'two to twenty-four hours');
    assert.equal(OFFERS.get(c.offer)!.offer.price, c.was);
  }
  const ids = mine(v).map((c) => c.id);
  // the same view again: nothing new
  assert.deepEqual(mine(promoView(game, s)).map((c) => c.id), ids);
  // reloaded from the database: the same offers
  forgetPromo(game);
  assert.deepEqual(mine(promoView(game, s)).map((c) => c.id), ids);
  // a day on: all run out, the contexts rest
  clock += 25 * H;
  assert.equal(rotatePromos(game, s), true);
  assert.equal(mine(promoView(game, s)).length, 0, 'resting');
  clock += 61 * 60_000;
  const w = mine(promoView(game, s));
  assert.equal(w.length, 3, 'new ones rolled in');
  assert.ok(w.every((c) => !ids.includes(c.id)));
});

test('the island\'s offer only for a captain with an island; the context\'s own goods', () => {
  const { game } = world();
  const s = captain(game, 'Landless Lou');
  const v = mine(promoView(game, s));
  assert.ok(!v.some((c) => c.ctx === 'isle'), 'no island: no island offer');
  assert.ok(v.some((c) => c.ctx === 'sea') && v.some((c) => c.ctx === 'board'));
  for (const c of v) assert.ok(PROMO_POOL[c.ctx as 'sea'].includes(c.offer));
});

test('bought at the offer\'s own price, once, through the shop\'s checks; the context rests after', () => {
  const { game, db } = world();
  const s = captain(game, 'Bargain Bea', 0, true);
  const card = mine(promoView(game, s)).find((c) => c.ctx === 'isle')!;
  assert.match(buyPromo(game, s, card.id, pid())!, /Not enough doubloons/);
  creditPremium(game, s.accountId, card.price, 'admin', 'exact');
  const id = pid();
  assert.equal(buyPromo(game, s, card.id, id), null);
  assert.equal(db.doubloons(s.accountId), 0, 'the offer\'s price, not the shelf\'s');
  const rows = (db as unknown as { db: DatabaseSync }).db.prepare(`SELECT amount, detail FROM ledger WHERE account_id = ? AND kind = 'doubloons_buy'`).all(s.accountId) as { amount: number; detail: string }[];
  assert.deepEqual(rows.map((r) => [Number(r.amount), String(r.detail)]), [[-card.price, `shop:promo:${card.id}:${id}`]]);
  assert.equal(buyPromo(game, s, card.id, id), 'This offer is gone.', 'once');
  creditPremium(game, s.accountId, 9900, 'admin', 'more');
  assert.equal(buyPromo(game, s, card.id, pid()), 'This offer is gone.');
  assert.ok(!mine(promoView(game, s)).some((c) => c.ctx === 'isle'), 'the island\'s context rests');
  assert.match(promoStats(game), new RegExp(`po:${card.offer} 0/0/1/${card.price}`));
});

test('closed where it shows: it hides there, the server keeps it; a special closed for the session; seen counted once', () => {
  const { game } = world();
  const s = captain(game, 'Closer', 0, true);
  const v = promoView(game, s);
  const sea = mine(v).find((c) => c.ctx === 'sea')!;
  closePromo(game, s, sea.id, 'sea');
  closePromo(game, s, sea.id, 'sea');
  forgetPromo(game);
  assert.deepEqual(promoView(game, s).cards.find((c) => c.id === sea.id)!.closed, ['sea']);
  const first = v.cards.find((c) => c.special === 'first')!;
  assert.ok(first, 'the first top-up\'s double among the specials');
  assert.ok(v.cards.some((c) => c.special === 'starter') && v.cards.some((c) => c.special === 'sub'));
  closePromo(game, s, first.id, 'entry');
  assert.deepEqual(promoView(game, s).cards.find((c) => c.id === first.id)!.closed, ['entry']);
  seenPromo(game, s, sea.id, 'port');
  seenPromo(game, s, sea.id, 'port');
  assert.match(promoStats(game), new RegExp(`po:${sea.offer} 1/1/0/0`), 'seen once, closed once');
  closePromo(game, s, 'po999', 'sea');
  closePromo(game, s, sea.id, 'nowhere' as 'sea');
});

test('the entry carousel once a day', () => {
  const { game } = world();
  const s = captain(game, 'Carousel');
  assert.equal(promoView(game, s).carousel, true);
  promoMessage(game, s, { action: 'promo_carousel' });
  assert.equal(promoView(game, s).carousel, false);
  clock += 6 * H;
  assert.equal(promoView(game, s).carousel, false, 'the same day');
  clock += DAY;
  assert.equal(promoView(game, s).carousel, true, 'the next day');
});

test('/offers: the owner\'s figures and the tester\'s roll, in HELP in both languages; every word in both', () => {
  const { game } = world();
  process.env.GRAVETIDE_ADMIN = '1';
  try {
    const s = captain(game, 'Owner Olga');
    assert.equal(runAdmin(game, s, '/offers stats'), 'Offers: nothing shown yet.');
    const before = mine(promoView(game, s)).map((c) => c.id);
    assert.match(runAdmin(game, s, '/offers roll')!, /^Offers: /);
    assert.ok(mine(promoView(game, s)).every((c) => !before.includes(c.id)), 'rolled anew');
    const help = runAdmin(game, s, '/help')!;
    assert.ok(help.includes('/offers [stats|roll|carousel]'));
    assert.ok(SERVER_RU_ADMIN[help]?.includes('/offers [stats|roll|carousel]'), 'the Russian HELP');
  } finally {
    delete process.env.GRAVETIDE_ADMIN;
  }
  const table = serverTable();
  for (const x of extract('server/src/game').filter((x) => /^Offers/.test(x))) assert.ok(table[x] !== undefined, `untranslated: ${x}`);
  assert.deepEqual(Object.keys(P_RU).sort(), Object.keys(P_EN).sort());
  for (const k of Object.keys(P_EN) as (keyof typeof P_EN)[]) assert.ok(/[а-яё]/i.test(P_RU[k]), k);
});

test('the offer card lists what is inside, each shot its own picture; the entry carousel waits for an open window (2026-10-15)', async () => {
  const { insideOf } = await import('../client/src/ui/promo.ts');
  const crate = insideOf('ammo2_590');
  assert.deepEqual(crate.map((x) => x.art), ['ammo_incendiary', 'ammo_heavy', 'ammo_long_shot']);
  assert.deepEqual(crate.map((x) => x.q), ['×760', '×760', '×380']);
  assert.ok(insideOf('starter').length >= 3, 'a bundle lists its things');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../client/src/ui/promo.ts', import.meta.url), 'utf8');
  assert.ok(src.includes("if (this.over && this.overPlace === 'entry' && this.windowUp()) {"), 'steps down under a window');
});

test("the offers are an icon under the captain's plate with a live clock, never sold inside the harbour's windows (owner, 2026-10-16)", async () => {
  const { bySoonest, clockShort } = await import('../client/src/ui/promo.ts');
  // the clock: mm:ss, h:mm:ss, a day or more in days and hours
  assert.equal(clockShort(42 * 60_000 + 7_000), '42:07');
  assert.equal(clockShort(3 * 3_600_000 + 59 * 60_000 + 12_000), '3:59:12');
  assert.equal(clockShort(-5), '00:00');
  assert.match(clockShort(2 * 86_400_000 + 4 * 3_600_000), /^2\s?(d|д) 4\s?(h|ч)$/);
  // the icon shows the soonest to end; one with no end last
  assert.deepEqual(bySoonest([{ id: 'a', until: 9_000 }, { id: 'b', until: 0 }, { id: 'c', until: 3_000 }]).map((x) => x.id), ['c', 'a', 'b']);
  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../client/${f}`, import.meta.url), 'utf8');
  const src = read('src/ui/promo.ts');
  // the icon: in the HUD's own layer (#touch), every context's offers, out of every fight, window and the island's scene
  assert.ok(src.includes("id: 'tc-offer'"), 'the round icon');
  assert.ok(src.includes("sea: ['sea', 'board', 'isle', 'all']"), 'every offer on the icon');
  assert.ok(/!this\.d\.modal\(\) && !this\.d\.busy\(\)/.test(src), 'never over a window or in a fight');
  assert.ok(src.includes("data-pofmt=\"hms\""), 'its clock ticks as mm:ss / h:mm:ss');
  // no chip at sea any more, no strip in the harbour
  assert.ok(!/promo-sea|promo-port|PROMO_PORT_SLOT|seaSpot/.test(src), 'the sea chip and the harbour strip are gone');
  const port = read('src/ui/port.ts');
  assert.ok(!/promo|PROMO|pshop|gravetide:shop/.test(port), "nothing sold in the harbour's window");
  // its place: the left row under the plate (the chat, «Остров», the offer), red in the last hour
  const css = read('seahud.css');
  assert.ok(css.includes('body.simple #hud #touch > #tc-offer { --lr-x: calc(var(--tr-c) + var(--lr-i)); }'), 'after «Остров» in the left row');
  assert.ok(read('promo.css').includes('.po-clock.urgent'), 'the clock red in its last hour');
  assert.ok(!read('promo.css').includes('.promo-port-slot'), 'no harbour strip styles');
});

test("the round buttons in two rows (two under the chart, the rest under the plate) and the sail's «−» «+» by the helm (owner, 2026-10-16)", async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../client/seahud.css', import.meta.url), 'utf8');
  assert.ok(css.includes('body.simple #hud #touch > :is(#tc-menu, #tc-news) { left: auto; top: var(--tr-top);'), 'the menu and the news under the chart, one row');
  assert.ok(css.includes('body.simple #hud #touch > :is(#tc-isle, #tc-offer) { right: auto; top: var(--lr-top);'), '«Остров» and the offer under the plate');
  assert.ok(css.includes('body.simple.touch:not(.chat-open):not(.tac) #hud-chat > .chat-toggle { top: var(--lr-top); left: calc(var(--sa-l) + 8px);'), 'the chat heads the left row');
  assert.ok(css.includes('body.simple.touch:not(.sea-docked) #touch > #tc-sail'), 'the sail buttons on a touch screen at sea');
  const touch = readFileSync(new URL('../client/src/touch.ts', import.meta.url), 'utf8');
  assert.ok(touch.includes('this.hooks.sail(want);'), 'the same input as the wheel and the keys');
  const { EN, RU } = await import('../client/src/lang/ui/seahud.ts');
  for (const k of ['sailUp', 'sailDown'] as const) {
    assert.ok(EN[k] && RU[k] && /[а-яё]/i.test(RU[k]) && !/[a-z]/i.test(RU[k].replace(/\{[a-z]+\}/g, '')), k);
  }
});
