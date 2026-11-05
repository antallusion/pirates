// VK moderation 4.2.4 (2026-11-05): «на старте в интерфейсе важно оставить минимальное число функций и механик для
// первого опыта в режиме обучения. Остальное важно последовательно вводить через постепенное обучение, прогрессию,
// кривую сложности»; owner: «начало игры полностью переделать и скрыть часть интерфейса, покупки можно предлагать
// постепенно тоже а не сразу пачкой». The ladder of features (shared/src/data/ladder.ts), its offers' pace (promo.ts),
// the campaign after the First Watch (campaign.ts), the quay's one «В море» (main.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PROTOCOL_VERSION } from '../shared/src/constants.ts';
import { LADDER, RUNG, SHOP_LEVEL, featureOpen, ladderLocked, promoRung } from '../shared/src/data/ladder.ts';
import { GUIDE } from '../shared/src/data/guide/index.ts';
import { pacedCards, promoView } from '../server/src/game/promo.ts';
import { LESSONS, SCHOOL, SCHOOL_SAIL, onboardingView, sanitizeTutorial } from '../server/src/game/onboarding.ts';
import { closestOnPolygon } from '../shared/src/math.ts';
import type { PromoCard } from '../shared/src/premiumproto.ts';
import type { WsConnection } from '../server/src/net/websocket.ts';
import { FakeConn, makeGame, steps } from './helpers.ts';

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('ladder: every rung named in both tongues, a line, things to hide, a real article; the levels climb', () => {
  const ids = new Set(GUIDE.map((a) => a.id));
  let last = 0;
  for (const r of LADDER) {
    assert.ok(r.name[0] && r.name[1] && r.line[0] && r.line[1], r.id);
    assert.ok(!/[A-Za-z]{3,}/.test(r.name[1] + r.line[1]), `${r.id}: Latin in the Russian`);
    assert.ok(r.hide.length > 0, r.id);
    if (r.article) assert.ok(ids.has(r.article), `${r.id}: article ${r.article}`);
    assert.ok(r.level >= last, `${r.id} climbs`);
    last = r.level;
  }
  assert.equal(ladderLocked(1).length, LADDER.length, 'level 1: everything on the ladder shut');
  assert.deepEqual(ladderLocked(60), []);
  assert.ok(featureOpen('shop', 1, false), 'a captain off the ladder has it all');
  assert.ok(!featureOpen('shop', 4, true) && featureOpen('shop', 5, true));
});

test('ladder: the campaign asks come at their rungs or before (a chart at level 4, a prize court at 8); the island is never laddered', () => {
  assert.ok(RUNG.charts.level <= 4);
  assert.ok(RUNG.colours.level <= 8);
  assert.ok(!LADDER.some((r) => (r.id as string) === 'isle'));
});

test('ladder: the shop pace — nothing before its rung, then one card, the rest by level', () => {
  assert.equal(promoRung(SHOP_LEVEL - 1).cards, 0);
  assert.equal(promoRung(SHOP_LEVEL).cards, 1);
  assert.ok(!promoRung(SHOP_LEVEL).carousel && !promoRung(10).carousel, 'no carousel of offers at the start');
  assert.ok(promoRung(20).cards > 5 && promoRung(20).carousel);
  const card = (id: string, special?: PromoCard['special'], ctx: PromoCard['ctx'] = 'all'): PromoCard => ({ id, offer: id, ctx, price: 290, was: 390, off: 25, until: 0, why: null, closed: [], ...(special ? { special } : {}) });
  const all = [card('po:a', undefined, 'sea'), card('po:b', undefined, 'board'), card('po:c', undefined, 'isle'), card('sp:first', 'first'), card('sp:starter', 'starter'), card('sp:weekly', 'weekly'), card('sp:sub30', 'sub')];
  assert.deepEqual(pacedCards(all, promoRung(1)), []);
  assert.deepEqual(pacedCards(all, promoRung(5)).map((c) => c.id), ['sp:starter']);
  assert.equal(pacedCards(all, promoRung(9)).length, 1);
  assert.ok(pacedCards(all, promoRung(9)).every((c) => c.special || c.ctx === 'sea'));
  assert.equal(pacedCards(all, promoRung(30)).length, all.length);
});

function newcomer(game: ReturnType<typeof makeGame>['game'], name: string, tutorial: boolean) {
  const c = new FakeConn();
  game.attach(c as unknown as WsConnection);
  c.push({ t: 'hello', v: PROTOCOL_VERSION, name });
  c.push({ t: 'create_captain', captain: 'corsair', shipName: 'Lad', tutorial });
  return { c, s: game.sessionByName(name)! };
}

test('ladder: a captain made now is on it, one made before is not; the campaign waits for the First Watch', () => {
  const { game } = makeGame();
  const { c, s } = newcomer(game, 'Lad Newcomer', true);
  const p = s.profile!;
  assert.equal(p.tutorial.ladder, true);
  const v = onboardingView(p);
  assert.ok(v.ladder && v.locked!.includes('shop') && v.locked!.includes('chat') && v.locked!.includes('abilities'));
  assert.equal(c.all('campaign_new').length, 0, 'no «Портовые лавки» over «Плывите»');
  assert.ok(!p.quests.active.some((q) => q.id.startsWith('c01_')), 'no campaign quest in the watch');
  c.push({ t: 'onboarding', action: 'skip_all' });
  steps(game, 2);
  assert.ok(c.all('campaign_new').length > 0 || p.quests.active.some((q) => q.id.startsWith('c01_')), 'the campaign comes when the watch is behind her');
  // nothing for doubloons at level 1
  assert.equal(promoView(game, s).cards.length, 0);
  assert.equal(promoView(game, s).carousel, false);
  // an old profile (no ladder mark): everything open, as before
  const old = { ...p, tutorial: { ...p.tutorial, ladder: undefined, played: undefined } } as typeof p;
  sanitizeTutorial(old);
  assert.ok(!onboardingView(old).ladder);
  assert.ok(!onboardingView(old).locked!.includes('shop'));
});

test('ladder: «Я знаю море» skips the lessons, never the ladder', () => {
  const { game } = makeGame();
  const { s } = newcomer(game, 'Lad Oldhand', false);
  assert.equal(s.profile!.tutorial.ladder, true);
  assert.ok(onboardingView(s.profile!).locked!.includes('shop'));
});

test('ladder: the client — its style from the table, the rungs told as they open, the quay one «В море», the keys of hidden things dead', () => {
  const onb = src('client/src/ui/onboarding.ts');
  assert.match(onb, /LADDER\.map\(\(r\) => `\$\{r\.hide\.map\(\(h\) => `body\.lock-\$\{r\.id\}/);
  assert.match(onb, /if \(v\.ladder && this\.shut\) for \(const f of this\.shut\) if \(!locked\.has\(f\)/);
  const main = src('client/src/main.ts');
  assert.match(main, /onboarding\.onUnlock = \(f\) => guideTips\.announce\(f\)/);
  assert.match(main, /m\.view && modal === null && !isleScene\.isOpen && !watchQuay\(\)\) openModal\('port'\)/);
  assert.match(main, /if \(keyLocked\(act\)\) return;/);
  assert.match(src('client/feel.css'), /body\.watch-quay #tc-act/);
  assert.match(src('client/src/ui/guidetip.ts'), /announce\(f: Feature\)/);
});

test('sea school: the quay with nothing but «В море», then a control a lesson — sails, wheel, dash, course, island — each with its piece of the HUD; a skip takes one lesson; «Без обучения» all', () => {
  SCHOOL.on = true;
  try {
    const { game } = makeGame();
    const { c, s } = newcomer(game, 'School Pupil', true);
    const p = s.profile!, ship = s.ship!;
    const view = () => c.last('onboarding')!.view;
    assert.equal(p.tutorial.lesson, 0);
    assert.equal(view().lesson, 'cast');
    assert.ok(view().school);
    assert.deepEqual(view().hud, [], 'the quay: nothing but the gold «В море»');
    assert.equal(view().of, 5 + LESSONS.length - 1);
    c.push({ t: 'undock' });
    steps(game, 25);
    assert.equal(view().lesson, 'sails');
    assert.ok(ship.input.sailTarget <= SCHOOL_SAIL + 1e-9, 'she leaves under a quarter of canvas');
    assert.deepEqual(view().hud, ['nav']);
    ship.input.sailTarget = 0.75;
    steps(game, 25);
    assert.equal(view().lesson, 'helm');
    for (let i = 0; i < 12 && view().lesson === 'helm'; i++) {
      ship.state.heading += 0.2;
      steps(game, 25);
    }
    assert.equal(view().lesson, 'dash');
    assert.ok(view().hud!.includes('dash'));
    // (the tests' little world has no island by the start: she is set a kilometre off one before «Курс» picks it)
    const isle = game.world.islands.find((x, i) => !game.world.ports.some((pt) => pt.islandId === i) && x.poly.length > 6)!;
    const edge = closestOnPolygon(isle.x + 5000, isle.y, isle.poly);
    ship.state.x = edge.x + 1000;
    ship.state.y = edge.y;
    c.push({ t: 'dash' });
    steps(game, 25);
    assert.equal(view().lesson, 'course');
    assert.ok(view().hud!.includes('minimap'));
    const g = view().goal!;
    assert.ok(g && g.name, 'the island to sail to, its beacon');
    // she is brought to its shore (the helmsman's run, done here by hand)
    const is = game.world.islands[p.tutorial.lessonIsle!];
    const near = closestOnPolygon(ship.state.x, ship.state.y, is.poly);
    const k = 200 / Math.max(1, Math.sqrt(near.d2));
    ship.state.x = near.x + (ship.state.x - near.x) * k;
    ship.state.y = near.y + (ship.state.y - near.y) * k;
    steps(game, 25);
    steps(game, 25);
    assert.equal(view().stage, 'attack', 'the school done: the watch goes on to «Атаковать»');
    assert.ok(view().hud!.includes('act') && view().hud!.includes('captain') && view().hud!.includes('target'));
    assert.ok(c.all('onb').filter((m) => m.kind === 'lesson').length >= 5, 'each lesson told done');
    // another pupil: «Пропустить» takes one lesson, «Без обучения» the whole watch
    const b = newcomer(game, 'School Skipper', true);
    b.c.push({ t: 'onboarding', action: 'skip_stage' });
    steps(game, 25);
    assert.equal(b.c.last('onboarding')!.view.lesson, 'sails');
    b.c.push({ t: 'onboarding', action: 'skip_all' });
    steps(game, 25);
    assert.equal(b.c.last('onboarding')!.view.stage, null);
  } finally {
    SCHOOL.on = false;
  }
});
