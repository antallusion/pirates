// docs/29 browser QA: the island as a city-builder, the claim and the move, two captains on one island, a harbour town.
//   GPORT=58993 OUT=docs/img/isles node tools/mobile/isles.mjs [flow|sizes]
import { browser, page, login, say, send, open, closeAll, shot, sleep } from './m0/lib.mjs';

const { generateWorld, isLand } = await import('../../shared/src/world/worldgen.ts');
const { WORLD_SEED } = await import('../../shared/src/constants.ts');
const world = generateWorld(WORLD_SEED);

const step = process.argv[2] ?? 'flow';
const RUN = Math.random().toString(36).slice(2, 5);
const SIZES = { phone: [844, 390], small: [480, 270], desk: [1500, 600] };
const report = [];
const note = (...a) => { console.log(...a); report.push(a.join(' ')); };

/** A wild island of a sea (no port, no town) and a point of water off her coast. */
function wildIsland(region, skip = []) {
  const towns = new Set(world.ports.map((p) => p.islandId));
  for (const is of world.islands) {
    if (is.region !== region || is.portId || is.minor || is.raft || is.slot || towns.has(is.id) || skip.includes(is.id) || is.radius < 250 || is.radius > 900) continue;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const x = is.x + Math.sin(a) * (is.radius + 260), y = is.y - Math.cos(a) * (is.radius + 260);
      if (!isLand(world, x, y) && !isLand(world, is.x + Math.sin(a) * (is.radius + 420), is.y - Math.cos(a) * (is.radius + 420))) return { is, x: Math.round(x), y: Math.round(y) };
    }
  }
  throw new Error('no wild island');
}

async function captain(b, size, name, lang = 'ru') {
  const p = await page(b, SIZES[size], { lang });
  await login(p, { name: `${name} ${RUN}`.slice(0, 15), know: true });
  await say(p, '/silver 3000000');
  await sleep(500);
  return p;
}

async function waitFor(p, sel, ms = 8000) {
  for (let t = 0; t < ms; t += 150) {
    const r = await p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? 1 : null; }, sel);
    if (r) return true;
    await sleep(150);
  }
  return false;
}

async function tap(p, sel) {
  const ok = await waitFor(p, sel);
  if (!ok) throw new Error(`no ${sel}`);
  await p.evaluate((s) => document.querySelector(s).click(), sel);
  await sleep(500);
}

async function baseWin(p) {
  await closeAll(p);
  await open(p, 'base');
  await waitFor(p, '#modal .base-board, #modal .base-body');
  await sleep(700);
}

async function islesTab(p) {
  await closeAll(p);
  await send(p, { t: 'estate', action: 'view' });
  await open(p, 'company');
  await waitFor(p, '#modal [data-jchip="isles"]');
  await p.evaluate(() => document.querySelector('#modal [data-jchip="isles"]')?.click());
  await sleep(900);
}

async function sailTo(p, x, y) {
  await say(p, `/tp ${x} ${y}`);
  await sleep(1200);
}

/** The window's numbers: anything sticking out of its panel sideways, and the panel's size. */
async function fits(p, label) {
  const r = await p.evaluate(() => {
    const panel = document.querySelector('#modal-panel');
    if (!panel) return null;
    const pb = panel.getBoundingClientRect();
    const out = [...panel.querySelectorAll('button, .bupcard, .bjob, .w-tile')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > pb.right + 1 || b.left < pb.left - 1); }).length;
    return { w: Math.round(pb.width), h: Math.round(pb.height), out, vw: innerWidth, vh: innerHeight };
  });
  note(label, JSON.stringify(r));
}

const b = await browser();
try {
  if (step === 'flow') {
    // (the second captain first, in a browser of her own: she waits at sea for step 4)
    const b2 = await browser();
    const B = await captain(b2, 'phone', 'Bea');
    await sleep(5000);
    // 1. Claim a free island (844×390, touch).
    const A = await captain(b, 'phone', 'Isa');
    const w1 = wildIsland('black_coast');
    await sailTo(A, w1.x, w1.y);
    await islesTab(A);
    await shot(A, '01_claim_card_phone_ru');
    await tap(A, '#modal [data-est="claim"]');
    await shot(A, '02_claim_confirm_phone_ru');
    await tap(A, '.confirm-panel [data-yes]');
    await sleep(800);
    note('claimed', await A.evaluate(() => JSON.stringify(globalThis.gravetide.state.estate?.isle && { island: globalThis.gravetide.state.estate.isle.name, hall: globalThis.gravetide.state.estate.isle.hall })));
    // 2. The board: the hall from the claim, the town round it to build.
    await say(A, '/yard 3000');
    await baseWin(A);
    await shot(A, '03_board_hall1_phone_ru');
    await fits(A, 'board phone');
    // The bunkhouse's card, built; the keep; the queue with its timers.
    await tap(A, '#modal .w-tile[data-town="dw1"]');
    await shot(A, '04_card_dw1_phone_ru');
    await tap(A, '#modal [data-tbuild="dw1"]');
    await sleep(800);
    await baseWin(A);
    await shot(A, '05_queue_phone_ru');
    await say(A, '/build finish');
    await sleep(800);
    await baseWin(A);
    await tap(A, '#modal .w-tile[data-town="keep"]');
    await tap(A, '#modal [data-tbuild="keep"]');
    await say(A, '/build finish');
    await sleep(600);
    // The hall's card: what its next level asks, ✓ and ✗.
    await baseWin(A);
    await tap(A, '#modal .w-tile[data-town="hall"]');
    await shot(A, '06_card_hall_needs_phone_ru');
    // The chain at hall 3: the hall's next asks the town at 3 (the tree raised by the admin to look at it).
    await say(A, '/build tree 3');
    await sleep(800);
    await baseWin(A);
    await shot(A, '07_board_tree3_phone_ru');
    await tap(A, '#modal .w-tile[data-town="dw4"]');
    await shot(A, '08_card_dw4_phone_ru');
    // 3. A second claim: the move, free (the confirm says what is pulled down).
    const w2 = wildIsland('black_coast', [w1.is.id]);
    await sailTo(A, w2.x, w2.y);
    await islesTab(A);
    await shot(A, '09_move_card_phone_ru');
    await tap(A, '#modal [data-est="claim"]');
    await waitFor(A, '.mv-panel');
    await sleep(700);
    await shot(A, '10_move_confirm_free_phone_ru');
    await tap(A, '.confirm-panel [data-yes]');
    await sleep(900);
    // …and the next move, paid: silver or doubloons.
    const w3 = wildIsland('black_coast', [w1.is.id, w2.is.id]);
    await sailTo(A, w3.x, w3.y);
    await islesTab(A);
    await tap(A, '#modal [data-est="claim"]');
    await waitFor(A, '.mv-panel');
    await sleep(700);
    await shot(A, '11_move_confirm_paid_phone_ru');
    const g0 = await A.evaluate(() => globalThis.gravetide.state.self.gold);
    await tap(A, '.confirm-panel [data-yes]');
    await sleep(1200);
    const g1 = await A.evaluate(() => globalThis.gravetide.state.self.gold);
    note('paid move: silver', g0, '→', g1);
    // 4. Two captains on the same island.
    await sailTo(B, w3.x, w3.y);
    await islesTab(B);
    await shot(B, '12_second_captain_card_phone_ru');
    await tap(B, '#modal [data-est="claim"]');
    await tap(B, '.confirm-panel [data-yes]');
    await sleep(900);
    await baseWin(B);
    await shot(B, '13_second_captain_board_phone_ru');
    await baseWin(A);
    await shot(A, '14_first_captain_sees_other_phone_ru');
    note('A others', await A.evaluate(() => JSON.stringify(globalThis.gravetide.state.base?.claim.others)));
    // 5. A harbour town of step 9: dock, mend, hire.
    const town = world.ports.find((pt) => /_t\d+$/.test(pt.id) && pt.region === 'black_coast');
    await closeAll(A);
    await say(A, `/tp ${town.id}`);
    await sleep(1500);
    await send(A, { t: 'dock', bribe: false });
    await sleep(2500);
    note('docked at', await A.evaluate(() => globalThis.gravetide.state.self?.dockedAt), 'town', town.id, town.name);
    await shot(A, '15_town_port_phone_ru');
    await say(A, '/hurt 40');
    await sleep(600);
    const gr0 = await A.evaluate(() => globalThis.gravetide.state.self.gold);
    await send(A, { t: 'repair', on: true });
    await sleep(900);
    const gr1 = await A.evaluate(() => globalThis.gravetide.state.self.gold);
    note('repaired at the town: silver', gr0, '→', gr1);
    const crew0 = await A.evaluate(() => globalThis.gravetide.state.self?.crew ?? globalThis.gravetide.state.ownShip?.crew);
    await send(A, { t: 'hire_crew', qty: 3 });
    await sleep(800);
    const crew1 = await A.evaluate(() => globalThis.gravetide.state.self?.crew ?? globalThis.gravetide.state.ownShip?.crew);
    note('hired', crew0, '→', crew1);
    await shot(A, '16_town_port_after_hire_phone_ru');
    note('errors A', JSON.stringify(A.errors), 'B', JSON.stringify(B.errors));
    await b2.close();
  }
  if (step === 'sizes') {
    for (const [size, lang] of [['phone', 'ru'], ['small', 'ru'], ['desk', 'ru'], ['phone', 'en'], ['desk', 'en']]) {
      const p = await captain(b, size, `S${size[0]}${lang}`, lang);
      const w = wildIsland('gravewater');
      await sailTo(p, w.x, w.y);
      await send(p, { t: 'estate', action: 'buy', island: w.is.id });
      await sleep(900);
      await say(p, '/yard 3000');
      await say(p, '/build tree 2');
      await sleep(800);
      await send(p, { t: 'h3', action: 'build', id: 'dw3' });
      await sleep(600);
      await baseWin(p);
      await shot(p, `20_board_${size}_${lang}`);
      await fits(p, `board ${size} ${lang}`);
      await tap(p, '#modal .w-tile[data-town="hall"]');
      await shot(p, `21_card_hall_${size}_${lang}`);
      await fits(p, `hall card ${size} ${lang}`);
      await tap(p, '#modal .w-tile[data-town="dw3"]');
      await shot(p, `22_card_job_${size}_${lang}`);
      note(size, lang, 'errors', JSON.stringify(p.errors));
      await p.ctx.close();
    }
  }
} finally {
  await b.close();
  console.log('--- report');
  console.log(report.join('\n'));
}
