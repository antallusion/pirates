// The website shop's thing window (owner, 2026-10-21: «на тапу или нажатию я хочу видеть модалку красивую с иконками и
// описанием всех существ, кораблей, пекеджей. должны быть подробные характеристики»; shared/src/data/webdetail.ts, GET
// /api/site/shop/item, site/js/shop.js): every item of the catalogue has its whole card with the blocks of its kind, the
// card's numbers are the game's tables', every picture is on disk, both languages are whole, and the page opens the
// window by its address.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join as pjoin } from 'node:path';
import { UNITS } from '../shared/src/data/army.ts';
import { armySlots } from '../shared/src/data/army.ts';
import { CAPTAINS } from '../shared/src/data/captains.ts';
import type { CaptainId } from '../shared/src/data/captains.ts';
import { DOUBLOON_PACKS } from '../shared/src/data/premium.ts';
import { OFFERS, dayOf, dealOf, worthOf } from '../shared/src/data/shop.ts';
import { SHIP_CLASSES } from '../shared/src/data/ships.ts';
import { giftOf } from '../shared/src/data/shipgifts.ts';
import { captainLevelFor, levelRange } from '../shared/src/data/shiplevel.ts';
import { skillOf } from '../shared/src/data/creatureskills.ts';
import { WEB_ITEMS } from '../shared/src/data/webshop.ts';
import { webDetail } from '../shared/src/data/webdetail.ts';
import type { DBlock, WebDetail } from '../shared/src/data/webdetail.ts';
import { SiteRating } from '../server/src/game/siterating.ts';
import { WebShop, manifestArt } from '../server/src/game/webshop.ts';
import { siteRoutes } from '../server/src/http/site-routes.ts';
import { makeGame } from './helpers.ts';

const ROOT = pjoin(import.meta.dirname, '..');
const DEAL = { offer: 'sp_590', rub: 354 };
const ALL: [string, WebDetail][] = WEB_ITEMS.map((x) => [x.id, webDetail(x.id, manifestArt, DEAL)!]);
const blocks = (d: WebDetail): DBlock[] => d.tabs.flatMap((t) => t.blocks);
const block = <T extends DBlock['t']>(d: WebDetail, t: T, k: string) => blocks(d).find((b) => b.t === t && b.k === k) as Extract<DBlock, { t: T }> | undefined;
/** Every [en, ru] pair of a card (the words), wherever it stands. */
function pairs(v: unknown, out: [string, string][] = []): [string, string][] {
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string' && !/^#|^radial|^linear/.test(v[0])) out.push([v[0], v[1]]);
    else for (const y of v) pairs(y, out);
  } else if (v && typeof v === 'object') for (const [k, y] of Object.entries(v)) if (k !== 'c') pairs(y, out);
  return out;
}
/** Every picture's address of a card. */
function pics(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) for (const y of v) pics(y, out);
  else if (v && typeof v === 'object') for (const [k, y] of Object.entries(v)) {
    if (['icon', 'art', 'alt', 'plate', 'face', 'emblem', 'ship'].includes(k) && typeof y === 'string') out.push(y);
    else pics(y, out);
  }
  return out;
}

test('every item of the catalogue has its card, with the blocks of its kind', () => {
  assert.equal(ALL.length, WEB_ITEMS.length);
  for (const [id, d] of ALL) {
    assert.ok(d, `${id}: a card`);
    assert.ok(d.hero.title[0] && d.hero.title[1] && d.hero.lead[1], `${id}: its name and line`);
    assert.ok(d.tabs.length >= 1 && d.tabs.every((t) => t.blocks.length), `${id}: tabs, none empty`);
    assert.ok(d.tabs.length <= 3, `${id}: three tabs at most (a phone's row)`);
    const x = WEB_ITEMS.find((y) => y.id === id)!;
    switch (x.kind) {
      case 'ship': {
        assert.equal(d.view, 'ship');
        assert.ok(d.hero.art, `${id}: her hull's picture`);
        assert.deepEqual(block(d, 'bars', 'ship')!.rows.map((r) => r.k), ['hull', 'sails', 'speed', 'turn', 'guns', 'crew', 'hold', 'armor'], id);
        assert.deepEqual(block(d, 'tiles', 'more')!.rows.map((r) => r.k), ['slots', 'chasers', 'crewmin', 'level'], id);
        const ab = block(d, 'abil', 'ship')!.rows;
        assert.ok(ab.some((a) => a.k === 'trait'), `${id}: her trait`);
        if (giftOf(x.ship!)) assert.ok(ab[0].k.startsWith('gift_') && ab[0].tag && ab[0].text[1], `${id}: her gift, its kind and what it does`);
        if (SHIP_CLASSES[x.ship!].premium!.beasts?.length) assert.ok(block(d, 'units', 'beasts')!.rows.every((u) => u.art && u.n && u.stats.length >= 6), `${id}: her creatures`);
        assert.match(block(d, 'text', 'deliver')!.body[1], /Вручается в порту, прежний корабль остаётся у причала/);
        break;
      }
      case 'unit': {
        assert.equal(d.view, 'unit');
        assert.ok(d.hero.art, `${id}: its figure`);
        assert.deepEqual(block(d, 'bars', 'unit')!.rows.slice(0, 6).map((r) => r.k), ['hp', 'atk', 'def', 'dmg', 'speed', 'init'], id);
        assert.ok(block(d, 'chips', 'attack')!.rows[0].k.match(/^(melee|ranged)$/), `${id}: ranged or melee`);
        if (skillOf(x.unit!)) assert.ok(block(d, 'abil', 'skill')!.rows[0].icon?.includes('/sk_'), `${id}: its ability with its own icon`);
        assert.ok(block(d, 'tiles', 'pack')!.rows.find((r) => r.k === 'per'), `${id}: a head's price`);
        break;
      }
      case 'captain': {
        assert.equal(d.view, 'captain');
        assert.equal(block(d, 'abil', 'abilities')!.rows.length, 4, `${id}: four abilities`);
        assert.ok(block(d, 'abil', 'abilities')!.rows.every((a) => a.icon && a.nums && a.nums.length >= 2), `${id}: their icons and numbers`);
        assert.ok(block(d, 'abil', 'trait')!.rows[0].text[1], `${id}: her trait`);
        assert.ok(block(d, 'text', 'bio')!.body[1], `${id}: her story`);
        assert.ok(block(d, 'lines', 'start')!.rows.length >= 5, `${id}: what she starts with`);
        break;
      }
      case 'pack':
        assert.equal(d.view, 'pack');
        assert.ok(block(d, 'tiles', 'pack') && block(d, 'lines', 'buys')!.rows.length >= 1, `${id}: the amount and what it buys`);
        break;
      default: {
        if (x.tab === 'cos') {
          assert.equal(d.view, 'cos');
          const prev = block(d, 'cos', 'preview')!.rows;
          assert.ok(prev.length >= 1, `${id}: a preview`);
          for (const c of prev) {
            if (c.k === 'title' || c.k === 'plate') assert.ok(c.plate && c.words, `${id}: the plate with its words`);
            if (c.k === 'frame') assert.ok(c.art && c.face && c.scale, `${id}: the frame round a face`);
            if (c.k === 'emblem' || c.k === 'cloth') assert.ok(c.rgb && c.emblem && c.ship, `${id}: the flag on a ship`);
            if (c.k === 'trail') assert.ok(c.c && c.ship, `${id}: the wake`);
            if (c.k === 'emote') assert.ok(c.emotes!.length && c.emotes!.every((e) => e.art), `${id}: the emotes`);
          }
          assert.ok(block(d, 'text', 'how'), `${id}: how it is had`);
        } else {
          assert.equal(d.view, 'set');
          const items = block(d, 'lines', 'items')!;
          assert.ok(items.rows.length >= 1 && items.rows.every((r) => r.name[1] && r.qty[1]), `${id}: every good inside with its quantity`);
        }
      }
    }
  }
});

test('the numbers are the game’s', () => {
  for (const [id, d] of ALL) {
    const x = WEB_ITEMS.find((y) => y.id === id)!;
    const f = d.facts;
    if (x.kind === 'ship') {
      const s = SHIP_CLASSES[x.ship!];
      assert.deepEqual([f.hull, f.sails, f.speed, f.turn, f.guns, f.crew, f.hold, f.armor, f.slots], [s.hull, s.sailHp, s.maxSpeed, s.turnRate, s.gunPortsPerSide, s.crewMax, s.holdVolume, s.armor, armySlots(s.tier)], id);
      assert.equal(f.lv, captainLevelFor(levelRange(x.ship!)[0]), id);
      assert.equal(f.lv, x.lv, `${id}: the card's level`);
      for (const r of block(d, 'bars', 'ship')!.rows) assert.ok(r.lo! <= r.n! && r.n! <= r.hi!, `${id}.${r.k} within its list`);
      for (const b of SHIP_CLASSES[x.ship!].premium!.beasts ?? []) {
        const u = block(d, 'units', 'beasts')!.rows.find((y) => y.id === b.u)!;
        assert.equal(u.n, b.n, `${id}: ${b.u} ×${b.n}`);
        assert.equal(u.stats.find((s) => s.k === 'hp')!.n, UNITS[b.u].hp);
      }
    }
    if (x.kind === 'unit') {
      const u = UNITS[x.unit!];
      assert.deepEqual([f.hp, f.atk, f.def, f.dmin, f.dmax, f.speed, f.init, f.shots, f.tier], [u.hp, u.atk, u.def, u.dmin, u.dmax, u.speed, u.init, u.shots, u.tier], id);
      assert.equal(f.n, x.n, `${id}: the pack's count`);
      assert.equal(f.per, Math.round(x.rub / x.n!), `${id}: a head's price`);
      assert.equal(f.ranged, u.shots > 0);
    }
    if (x.kind === 'captain') {
      const c = CAPTAINS[x.captain as CaptainId];
      assert.deepEqual([f.crew, f.gold, f.ship], [c.start.crew, c.start.gold, c.start.ship], id);
      const ab = block(d, 'abil', 'abilities')!.rows;
      c.abilities.forEach((a, i) => assert.equal(ab[i].nums!.find((n) => n.name[0] === 'Cooldown')!.v[0], `${a.cooldown} s`, `${id}.${a.id}`));
    }
    if (x.kind === 'pack') {
      const p = DOUBLOON_PACKS.find((y) => y.id === id)!;
      assert.deepEqual([f.doubloons, f.base, f.bonus], [p.n + p.bonus, p.n, p.bonus], id);
    }
    if (x.kind === 'offer') {
      const o = OFFERS.get(x.offer!)!.offer;
      const worth = o.worth ?? worthOf(o.grants);
      if (worth > o.price) assert.equal(f.save, Math.round((worth / o.price - 1) * 100), `${id}: «выгода N %»`);
      else assert.equal(f.save, 0, id);
    }
  }
  // the deal of the day: its own offer, its price against the usual
  const deal = webDetail('deal', manifestArt, DEAL)!;
  assert.equal(deal.facts.offer, 'sp_590');
  assert.equal(deal.facts.worth, OFFERS.get('sp_590')!.offer.price);
});

test('every picture of every card is on disk', () => {
  const seen = new Set<string>();
  for (const [id, d] of ALL) {
    for (const p of pics([d.hero, d.tabs])) {
      if (seen.has(p)) continue;
      seen.add(p);
      assert.ok(p.startsWith('/assets/') || p.startsWith('/site/img/'), `${id}: ${p}`);
      assert.ok(existsSync(pjoin(ROOT, p.startsWith('/assets/') ? p.slice(1) : p.slice(1))), `${id}: ${p} on disk`);
    }
    // nothing left unpainted where a picture is promised: the abilities' and the goods' icons
    for (const b of blocks(d)) {
      if (b.t === 'abil') for (const a of b.rows) assert.ok(a.icon, `${id}: ${a.k} icon`);
      if (b.t === 'bars' || b.t === 'tiles') for (const r of b.rows) assert.ok(r.icon, `${id}: ${r.k} icon`);
    }
  }
});

test('both languages, whole: every word of every card in English and in Russian', () => {
  for (const [id, d] of ALL) {
    for (const [en, ru] of pairs(d)) {
      assert.ok(en.trim() !== '' || ru.trim() === '', `${id}: an English word for «${ru}»`);
      assert.ok(ru.trim() !== '' || en.trim() === '', `${id}: a Russian word for «${en}»`);
      assert.ok(!/[A-Za-z]{3,}/.test(ru.replace(/GRAVETIDE/g, '')), `${id}: Russian «${ru}»`);
      assert.ok(!/[А-Яа-яЁё]/.test(en), `${id}: English «${en}»`);
      assert.ok(!/\{\w+\}/.test(en + ru), `${id}: no placeholder left: ${en} / ${ru}`);
    }
  }
});

test('the window on the page: its dialog, its words in both languages, opened by ?item= and shut by Back', () => {
  for (const lang of ['ru', 'en']) {
    const html = readFileSync(pjoin(ROOT, 'site', lang === 'ru' ? '' : 'en', 'shop', 'index.html'), 'utf8');
    assert.match(html, /<div class="pd" role="dialog" aria-modal="true" aria-labelledby="pd-title" hidden>/, lang);
    assert.match(html, /data-pd-nav="-1"/);
    assert.match(html, /class="pd-foot"/);
    const t = JSON.parse(/<script type="application\/json" id="shop-data">(.*?)<\/script>/s.exec(html)![1]).t as Record<string, string>;
    for (const k of ['more', 'prev', 'next', 'save', 'worth', 'perHead', 'ends', 'starts', 'onlyHere', 'alone', 'copy', 'loadErr']) assert.ok(t[k], `${lang}: ${k}`);
  }
  const js = readFileSync(pjoin(ROOT, 'site', 'js', 'shop.js'), 'utf8');
  assert.match(js, /get\('item'\)/, 'the address opens it');
  assert.match(js, /history\.pushState\(\{ pd: id \}/, 'a tap puts it in the history, so Back shuts it');
  assert.match(js, /\/api\/site\/shop\/item\?id=/, 'its card from the server');
  assert.match(js, /e\.key === 'Escape'/);
  assert.match(js, /ArrowRight/);
  const css = readFileSync(pjoin(ROOT, 'site', 'css', 'shop.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.pd-back/, 'the window is still for reduced motion');
  assert.match(css, /safe-area-inset-bottom/);
});

test('GET /api/site/shop/item: the card and the item as sold now; an unknown id is 404; the deal is today’s', async () => {
  const g = makeGame();
  const shop = new WebShop(g.game, { provider: null, returnUrl: 'https://gravetidegame.com/site/shop/', payTest: true, log: () => {}, pumpMs: 0 });
  const handle = siteRoutes({ rating: new SiteRating(g.game), shop, publicUrl: 'https://gravetidegame.com' });
  const srv = createServer((req, res) => void handle(req, res).then((ok) => { if (!ok) res.writeHead(404).end(); }));
  await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as { port: number }).port;
  const get = (path: string) => new Promise<{ status: number; body: string; cache: string }>((ok, bad) => {
    const rq = request({ host: '127.0.0.1', port, method: 'GET', path, headers: { host: `127.0.0.1:${port}` } }, (rs) => {
      let b = '';
      rs.setEncoding('utf8');
      rs.on('data', (c) => (b += c));
      rs.on('end', () => ok({ status: rs.statusCode ?? 0, body: b, cache: String(rs.headers['cache-control'] ?? '') }));
    });
    rq.on('error', bad);
    rq.end();
  });
  try {
    const r = await get('/api/site/shop/item?id=ship_black_corsair');
    assert.equal(r.status, 200);
    assert.match(r.cache, /public/);
    const v = JSON.parse(r.body) as { item: { id: string; rub: number }; detail: WebDetail };
    assert.equal(v.item.id, 'ship_black_corsair');
    assert.equal(v.item.rub, SHIP_CLASSES.black_corsair.premium!.price);
    assert.equal(v.detail.facts.hull, SHIP_CLASSES.black_corsair.hull);
    assert.match(v.detail.hero.art!, /^\/assets\/ships\//);
    assert.ok(!/accountId|account_id|email|order/i.test(JSON.stringify(v.detail)), 'public things only');
    assert.equal((await get('/api/site/shop/item?id=nope')).status, 404);
    assert.equal((await get('/api/site/shop/item?id=__proto__')).status, 404);
    const deal = JSON.parse((await get('/api/site/shop/item?id=deal')).body) as { item: { offer: string; rub: number }; detail: WebDetail };
    const today = dealOf(dayOf(g.game.wallNow()));
    assert.equal(deal.item.offer, today.offer.id);
    assert.equal(deal.detail.facts.offer, today.offer.id);
    assert.equal(deal.item.rub, today.price);
    // made once and kept: the same card object for the same item
    assert.equal(shop.item('unit_sea_dragon_1')!.detail, shop.item('unit_sea_dragon_1')!.detail);
  } finally {
    srv.close();
  }
});
