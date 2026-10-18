// The owner, 2026-10-18 — three things on the phone held sideways:
//  «иконка +- и к кораблю не выровнены по вертикали, они все чуть вниз смещены, надо на всем поправить»: the buttons'
//  small signs drawn (dom.ts glyphSvg), each centred on its 24-unit box; the check of it in the browser is
//  tools/mobile/ux/align.mjs (every HUD button's content centre within 1 px of its own);
//  «кнопки осмотреть, штурм и так далее отличаются от кнопки атаковать, надо все эти кнопки внизу справа одного дизайна
//  делать»: one action button (seahud.ts actBtnClass, seahud.css .tc-actb), the gold one only its colour and glow;
//  «все предложения в магазине должны иметь в первую очередь цену в рублях или в звездах и только рядом цену в
//  дублонах»: ui/price.ts — the real money first (roubles on the website, Stars in Telegram at the top-up's ¾), the
//  doubloons beside it; short of doubloons a Buy tops up the tier that covers it and the purchase goes by itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOUBLOON_PACKS, STARS_PER_DOUBLOON } from '../shared/src/data/premium.ts';
import { OFFERS } from '../shared/src/data/shop.ts';
import type { ShopView } from '../shared/src/premiumproto.ts';
import type { ClientMsg } from '../shared/src/protocol.ts';
import { setLang } from '../client/src/i18n.ts';
import { EN as P_EN, RU as P_RU } from '../client/src/lang/ui/premium.ts';
import { dropPending, heardDoubloons, packFor, packPrice, payIn, pendingBuy, priceHtml, priceText, priceView, realOf, realText, waitForTopUp } from '../client/src/ui/price.ts';
import { offerBtn } from '../client/src/ui/premium.ts';
import { glyphSvg } from '../client/src/ui/dom.ts';
import type { GlyphKind } from '../client/src/ui/dom.ts';
import { actBtnClass } from '../client/src/ui/seahud.ts';

const NB = '\u00a0';
const ru = <T>(f: () => T): T => {
  setLang('ru');
  try {
    return f();
  } finally {
    setLang('en');
  }
};

// ------------------------------------------------------------------------------------------------ the price's words

test('a price in real money first: roubles one to one on the website, Stars at the top-up\'s rate in Telegram', () => {
  assert.equal(STARS_PER_DOUBLOON, 0.75);
  assert.equal(realOf(290, 'rub'), 290);
  assert.equal(realOf(290, 'stars'), 218); // (217.5 → 218: the owner's example)
  assert.equal(realOf(9900, 'stars'), 7425);
  // the top-up's own tiers: the Stars on a pack are the price the shop shows for as many doubloons
  for (const p of DOUBLOON_PACKS) assert.equal(realOf(p.n, 'stars'), p.stars, p.id);
  ru(() => {
    assert.equal(priceText(290, 'rub'), `290${NB}₽ · 290 ◉`);
    assert.equal(priceText(290, 'stars'), `218${NB}⭐ · 290 ◉`);
    assert.equal(priceText(9900, 'rub'), `9${NB}900${NB}₽ · 9${NB}900 ◉`);
    assert.equal(realText(1990, 'stars'), `1${NB}493${NB}⭐`);
  });
  assert.equal(priceText(9900, 'rub'), `9,900${NB}₽ · 9,900 ◉`);
  assert.equal(priceText(590, 'stars'), `443${NB}⭐ · 590 ◉`);
  // (no Telegram here: the website's roubles)
  assert.equal(payIn(), 'rub');
});

test('the price drawn: the real money first and bold, the doubloons after it; Stars with Telegram\'s star', () => {
  const rub = priceHtml(590, { cur: 'rub', cls: 'sh-p' });
  assert.match(rub, /^<span class="rp sh-p" title="590.₽ · 590 ◉"><b class="rp-real">590.₽<\/b><span class="rp-dbl">.*590<\/span><\/span>$/);
  assert.ok(rub.indexOf('rp-real') < rub.indexOf('rp-dbl'));
  const st = priceHtml(590, { cur: 'stars' });
  assert.match(st, /<b class="rp-real"><svg class="tg-star"[^]*<\/svg>443<\/b><span class="rp-dbl">/);
  // an old price struck through before the new one, in the same money
  const was = priceHtml(790, { cur: 'stars', was: 990 });
  assert.ok(was.indexOf('<s class="rp-was">') < was.indexOf('rp-real'));
  assert.match(was, /<s class="rp-was"><svg class="tg-star"[^]*<\/svg>743<\/s>/);
  assert.ok(!priceHtml(790, { cur: 'rub', was: 500 }).includes('rp-was'), 'no old price below the new one');
});

// ------------------------------------------------------------------------------------------------ the view model

test('short of doubloons: how many, and the smallest tier of the top-up that covers them', () => {
  assert.equal(packFor(1).id, 'd290');
  assert.equal(packFor(290).id, 'd290');
  assert.equal(packFor(291).id, 'd590');
  assert.equal(packFor(620).id, 'd590'); // (590 and its 30 bonus)
  assert.equal(packFor(621).id, 'd990');
  assert.equal(packFor(1_000_000).id, 'd9900'); // (the largest when none covers it)
  const v = priceView(990, 300, 'stars');
  assert.deepEqual({ dbl: v.dbl, real: v.real, short: v.short, pack: v.pack?.id }, { dbl: 990, real: 743, short: 690, pack: 'd990' });
  const ok = priceView(290, 290, 'rub');
  assert.equal(ok.short, 0);
  assert.equal(ok.pack, null);
  assert.equal(packPrice(DOUBLOON_PACKS[0], 'stars'), `218${NB}⭐`);
  assert.equal(packPrice(DOUBLOON_PACKS[0], 'rub'), `290${NB}₽`);
});

test('the top-up came in: the purchase it was for is sent once, and not after it has waited too long', () => {
  const sent: ClientMsg[] = [];
  const send = (m: ClientMsg) => void sent.push(m);
  const msg: ClientMsg = { t: 'premium', action: 'shop', offer: 'ammo_1', pid: 'ptest1' };
  dropPending();
  assert.equal(heardDoubloons(5000, send), false, 'nothing waits');
  const t0 = 1_000_000;
  waitForTopUp(290, msg, 'Ящики ядер', t0);
  assert.equal(heardDoubloons(100, send, undefined, t0 + 1000), false, 'not enough yet');
  const toasts: string[] = [];
  assert.equal(heardDoubloons(290, send, (x) => void toasts.push(x), t0 + 2000), true);
  assert.deepEqual(sent, [msg]);
  assert.equal(toasts.length, 1);
  assert.equal(heardDoubloons(2000, send, undefined, t0 + 3000), false, 'sent once');
  assert.equal(sent.length, 1);
  waitForTopUp(290, msg, 'x', t0);
  assert.equal(heardDoubloons(5000, send, undefined, t0 + 16 * 60_000), false, 'a quarter of an hour passed: it waits no more');
  assert.equal(sent.length, 1);
  assert.equal(pendingBuy(), null);
});

test('an offer\'s button: the real money before the doubloons; short of doubloons it stays open (it tops up first)', () => {
  const found = OFFERS.get('ammo_1') ?? [...OFFERS.values()].find((x) => x.offer.price >= 290)!;
  const id = found.offer.id;
  const sv = { why: {}, left: {}, price: {}, sale: {} } as unknown as ShopView;
  const open = offerBtn(found.fam, found.offer, sv);
  assert.ok(!open.includes(' disabled'), open);
  assert.ok(open.indexOf('rp-real') < open.indexOf('rp-dbl'));
  const poor = offerBtn(found.fam, found.offer, { ...sv, why: { [id]: 'poor' } } as ShopView);
  assert.ok(!poor.includes(' disabled'), 'short of doubloons: still a Buy');
  assert.match(poor, /class="sh-off on short/);
  const shut = offerBtn(found.fam, found.offer, { ...sv, why: { [id]: 'limit' } } as ShopView);
  assert.match(shut, / disabled title=/);
  // the questions and the top-up's words in both languages; every Russian one in Russian words
  for (const k of ['short.ask', 'short.go', 'short.open', 'short.no', 'short.done', 'short.buy', 'pr.real'] as const) {
    assert.ok(P_EN[k] && /[а-яё]/i.test(P_RU[k]), k);
  }
  assert.ok(!/дубл\.\?/.test(P_RU['ask.offer']) && P_RU['ask.offer'].includes('{n}'), 'the question names the whole price');
});

// ------------------------------------------------------------------------------------------------ one action button

test('the action buttons are one component: the same base, the gold one only its colour and glow', () => {
  const p = actBtnClass(true).split(' '), s = actBtnClass(false).split(' ');
  const base = ['k-btn', 'k-btn--secondary', 'tc-actb'];
  for (const c of base) assert.ok(p.includes(c) && s.includes(c), c);
  assert.ok(p.includes('tc-actb--primary') && p.includes('tc-act') && !s.includes('tc-actb--primary'));
  assert.ok(s.includes('tc-act2'), 'the small ones keep their hook (seahud.ts fitActs, frames.mjs)');
  assert.ok(!p.includes('k-btn--lg') && !p.includes('k-btn--primary'), 'no bigger kit button for the gold one');
  const css = readFileSync('client/seahud.css', 'utf8');
  const rules = [...css.matchAll(/([^{}]*\.tc-actb--primary[^{}]*)\{([^}]*)\}/g)];
  assert.ok(rules.length >= 1);
  const props = rules.flatMap((r) => r[2].split(';').map((d) => d.split(':')[0].trim()).filter(Boolean));
  const sizeish = props.filter((x) => /^(height|min-height|padding|font-size|font|width|border-width|border-image|gap)/.test(x));
  assert.deepEqual(sizeish, [], 'the gold one is not sized apart');
  assert.match(css, /#touch > \.tc-actrow > \.tc-actb \{[^}]*background: rgba\(11, 13, 16, 0\.82\)/);
  const ts = readFileSync('client/src/ui/seahud.ts', 'utf8');
  assert.ok(!/k-btn--primary k-btn--lg tc-act/.test(ts) && ts.includes('actBtnClass(true)') && ts.includes('actBtnClass(false)'));
  // the desk's bar in the same frame
  assert.match(readFileSync('client/styles.css', 'utf8'), /\.skinned \.act-btn \{[^}]*border-image: var\(--ui-button\)/);
});

// ------------------------------------------------------------------------------------------------ the signs drawn

/** The box of a path of M/L/l/h/v moves (its arcs are a circle round the middle: left out). */
function pathBox(d: string): { x: number; y: number } {
  let x = 0, y = 0;
  const xs: number[] = [], ys: number[] = [];
  for (const m of d.matchAll(/([MLlhvHVza])([^MLlhvHVza]*)/g)) {
    const n = (m[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    const at = () => (xs.push(x), ys.push(y));
    switch (m[1]) {
      case 'M': case 'L': for (let i = 0; i + 1 < n.length; i += 2) (x = n[i], y = n[i + 1], at()); break;
      case 'l': for (let i = 0; i + 1 < n.length; i += 2) (x += n[i], y += n[i + 1], at()); break;
      case 'h': x += n[0]; at(); break;
      case 'v': y += n[0]; at(); break;
      case 'a': x += n[5]; y += n[6]; break;
    }
  }
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

test('the buttons\' small signs are drawn on the middle of their box (no letter sitting on its font\'s baseline)', () => {
  for (const k of ['plus', 'minus', 'close', 'prev', 'next', 'up', 'down', 'aim'] as GlyphKind[]) {
    const svg = glyphSvg(k);
    assert.match(svg, /^<svg class="g-svg g-[a-z]+" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="[^"]+"\/><\/svg>$/);
    const c = pathBox(svg.match(/d="([^"]+)"/)![1]);
    assert.ok(Math.abs(c.x - 12) < 0.01 && Math.abs(c.y - 12) < 0.01, `${k}: ${c.x},${c.y}`);
  }
  // the sail's «+» «−», the sheets' ✕, the offers' × ‹ ›: drawn
  const src = (f: string) => readFileSync(f, 'utf8');
  assert.ok(src('client/src/touch.ts').includes("glyphSvg(glyph)") && !/b\(1, '\+'\)/.test(src('client/src/touch.ts')));
  assert.ok(!src('client/src/ui/kit/sheet.ts').includes('>✕<'));
  const promo = src('client/src/ui/promo.ts');
  assert.ok(!/>[×‹›]<\/button>/.test(promo), 'the offers\' cards');
  assert.match(src('client/styles.css'), /\.g-svg \{ display: block; flex: none; width: 1em; height: 1em; margin: auto;/);
  // «Остров» and «К кораблю» in their pictures once the art is in (main.ts)
  assert.match(src('client/src/main.ts'), /\[\[isleBtn, 'ui_lighthouse'\], \[homeBtn, 'map_ship'\]\]/);
  // the check itself, kept as a tool: the HUD at the three sizes, 1 px
  const tool = src('tools/mobile/ux/align.mjs');
  assert.match(tool, /const TOL = Number\(process\.env\.TOL \?\? 1\);/);
  assert.match(tool, /844x390,480x270,1440x900/);
  assert.match(tool, /actualBoundingBoxAscent/);
});
