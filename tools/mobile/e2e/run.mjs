// docs/23 item 90 (e2e-runner): the seven journeys of a captain on a phone held sideways (812×375, touch), played by
// finger on the real game and checked at every step — the title screen, the First Watch's five steps, a sea fight, a
// senior boarded through the risk window, the harbour's market, yard and tavern, her island's town, the captain's
// book. Each journey has its own browser context and captain; a frame is saved at each step; a failed check fails
// the journey with what stood in the way. `--repeat N` runs each journey N times to find the flaky ones.
//
//   APORT=58821 GPORT=58822 OUT=assets/raw/audit/m9/e2e node tools/mobile/e2e/run.mjs [journey …] [--repeat 3] [--lang en]
// Journeys: login tutorial fight senior port island book (all by default). APORT: a server with GRAVETIDE_ADMIN=1 (the
// scenes are set by its chat commands); GPORT: a plain one (the title screen and the First Watch, as a player meets them).
import * as L from '../m0/lib.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Phone, StepError, autoBattle, battleEnd, foeOnScreen, signIn } from './pages.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const REPEAT = Number(arg('repeat', '1'));
const LANG = arg('lang', 'ru');
const APORT = Number(process.env.APORT ?? 58821), GPORT = Number(process.env.GPORT ?? 58822);
const OUT = process.env.OUT ?? 'assets/raw/audit/m9/e2e';
mkdirSync(OUT, { recursive: true });
const rnd = () => Math.random().toString(36).slice(2, 6);
const ALL = ['login', 'tutorial', 'fight', 'senior', 'port', 'island', 'book'];
const want = process.argv.slice(2).filter((x, i, a) => !x.startsWith('--') && !(a[i - 1] ?? '').startsWith('--'));
const JOURNEYS = want.length ? want : ALL;

/** Out of port by her own hand: the big round «В море», the harbour's check if it asks, the film. */
async function castOff(ph) {
  // The harbour's sheet up (it opens by itself on a phone in port): its rail's gold «В море»; else the HUD's.
  await ph.until(async () => (await ph.visible('#modal-panel [data-ptab="sea"]')) || (await ph.visible('#tc-fire.tc-sail')), 8000, '«В море» in sight');
  if (await ph.visible('#modal-panel [data-ptab="sea"]')) await ph.tap('#modal-panel [data-ptab="sea"]', '«В море» (the harbour)');
  else await ph.tap('#tc-fire.tc-sail', '«В море»');
  await ph.until(async () => {
    const s = await ph.state();
    if (!s.docked) return true;
    await ph.tapIf('[data-dp="sail"]', '«Всё равно выйти»');
    return false;
  }, 30000, 'out of port');
  await L.sleep(1200);
  await ph.skipFilm();
  await L.closeAll(ph.p, 1);
}

/** Open water off the Black Coast, a clear sky, a sound ship, shot aboard (the scene, not the player's) — a spot of
 *  her own each journey: the frigates of the last one, still angry, lay where the next one came. */
let spot = Math.floor(Date.now() / 1000) % 6;
async function openSea(ph) {
  const k = spot++;
  await ph.admin(`/tp ${21000 + 3000 * (k % 3)} ${70000 + 2500 * (Math.floor(k / 3) % 2)}`, 2500);
  await ph.skipFilm();
  await L.closeAll(ph.p, 1);
  for (const x of ['/weather clear', '/heal', '/ammo']) await ph.admin(x, 700);
}

/** «Атаковать» on the nearest ship of a role: tapped on the sea as the mark if it is not marked yet. */
async function attack(ph, role = 'pirate') {
  // Off the screen: the wheel pulled her way, as a player would, until she is in sight.
  let pulled = 0;
  await ph.until(async () => {
    const f = await foeOnScreen(ph.p, role);
    if (f?.on) return true;
    if (f && pulled < 4) {
      const o = await ph.p.evaluate(() => { const d = globalThis.gravetide.state.ownDisplay; return { x: d.x, y: d.y }; });
      const s = await ph.p.evaluate((id) => { const x = globalThis.gravetide.state.ships.get(id); return x?.cur ? { x: x.cur.x, y: x.cur.y } : null; }, f.id);
      if (s) { await L.steer(ph.p, Math.atan2(s.x - o.x, -(s.y - o.y))); ph.taps++; pulled++; await L.sleep(1500); }
    }
    return false;
  }, 25000, `the ${role} on the screen`);
  if (!(await ph.visible('#tc-act[data-act="attack"]'))) {
    const f = await foeOnScreen(ph.p, role);
    await ph.tapAt(f.x, f.y);
  }
  await ph.tap('#tc-act[data-act="attack"]', '«Атаковать»', 8000);
}

/** The fight from «Атаковать» to her grapples' reach: «Огонь» pressed as a player would while she closes. */
async function closeIn(ph, role, ms) {
  const t0 = Date.now();
  let fires = 0, lastFire = 0;
  const hull0 = (await foeOnScreen(ph.p, role))?.hull ?? 1;
  for (;;) {
    const f = await foeOnScreen(ph.p, role);
    if (await ph.visible('#tc-act[data-act="board"]')) return { t: (Date.now() - t0) / 1000, fires, hull: f?.hull ?? 0, hull0, why: 'board' };
    if (await ph.visible('[data-risk="go"]')) return { t: (Date.now() - t0) / 1000, fires, hull: f?.hull ?? 0, hull0, why: 'risk' };
    if ((await ph.state()).tac) return { t: (Date.now() - t0) / 1000, fires, hull: f?.hull ?? 0, hull0, why: 'battle' };
    if (!f || f.hull <= 0) return { t: (Date.now() - t0) / 1000, fires, hull: 0, hull0, why: 'gone' };
    if (Date.now() - t0 > ms) throw new StepError(`no grapples in ${ms / 1000} s (her hull ${f.hull.toFixed(2)}, ${f.d} m)`);
    if (Date.now() - t0 > 3000 && Date.now() - lastFire > 4000 && fires < 4 && (await ph.visible('#tc-fire:not(.tc-sail)'))) {
      await ph.tap('#tc-fire', '«Огонь»', 1000).catch(() => {});
      fires++;
      lastFire = Date.now();
    }
    await L.sleep(300);
  }
}

const J = {
  /** 1. The title screen: a name, a captain, the HUD; a returning captain is back in at most one tap. */
  async login(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Вход' : 'Login') + rnd(), know: true });
    const s = await ph.state();
    ph.expect(!!s.docked, 'a new captain starts in port');
    await ph.until(async () => (await ph.visible('#tc-fire.tc-sail')) || (await ph.visible('#modal-panel [data-ptab="sea"]')), 5000, 'in port «В море» in sight (the HUD’s big round button or the harbour’s rail)');
    // A name, «Выйти в море», a captain, «Я знаю море» (a swipe down to it on a phone), «Принять командование», and the
    // handbook's cross once.
    ph.expect(ph.taps <= 10, `the title screen to the HUD in ${ph.taps} taps (10 at most)`);
    const t0 = ph.taps;
    await ph.p.reload({ waitUntil: 'domcontentloaded' });
    await ph.until(async () => {
      if (await ph.p.$('#hud:not(.hidden)')) return true;
      await ph.tapIf('#login-continue:not(.hidden)', '«Продолжить»');
      return false;
    }, 60000, 'back in the game after a reload');
    await L.sleep(1000);
    await ph.step('back', { taps: ph.taps - t0 });
    ph.expect(ph.taps - t0 <= 1, `back after a reload in ${ph.taps - t0} taps (1 at most)`);
  },

  /** 2. The First Watch: five steps, each the finger's one action (docs/23 item 79), to the quay. */
  async tutorial(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Урок' : 'Lesson') + rnd(), know: false });
    const look = () => ph.p.evaluate(() => {
      const s = globalThis.gravetide.state;
      const f = document.querySelector('#tut-finger:not(.hidden)') ? document.querySelector('.tut-target') : null;
      const r = f?.getBoundingClientRect();
      return { stage: s.onboarding?.stage ?? null, on: !!s.onboarding, docked: !!s.self?.dockedAt, tac: s.boardTac ? !!s.boardTac.over : null, finger: f && r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, on: f.id || f.dataset.act || f.dataset.ptab || f.dataset.fate || f.className.slice(0, 30) } : null };
    });
    const seen = [];
    let last = null, lastTap = 0, battles = 0;
    await ph.until(async () => {
      const v = await look();
      if (v.stage !== last) {
        last = v.stage;
        seen.push(v.stage);
        await ph.step(`stage_${v.stage ?? 'done'}`, { finger: v.finger?.on ?? null });
      }
      if (!v.stage) return true;
      if (v.tac === false && battles === 0) {
        battles++;
        if (!seen.includes('board')) seen.push('board'); // the battle is the «На абордаж» step's (its stage may pass while it is fought)
        await autoBattle(ph, 0);
        await battleEnd(ph, 60000);
        return false;
      }
      if (v.tac !== null) return false;
      // The finger's button, pressed once it shows (and again only after a while: the helmsman may be on his way).
      if (v.finger && Date.now() - lastTap > (v.stage === 'port' ? 8000 : 1800)) {
        lastTap = Date.now();
        await ph.tapAt(v.finger.x, v.finger.y);
        return false;
      }
      // «Плывите» at sea with the finger on the wheel: a pull of the stick.
      if (v.stage === 'sail' && !v.docked && Date.now() - lastTap > 1800) {
        lastTap = Date.now();
        await L.steer(ph.p, 0);
        ph.taps++;
      }
      return false;
    }, 300000, `the First Watch (stuck at «${last}»)`);
    ph.expect(['sail', 'attack', 'fire', 'board', 'port'].every((x) => seen.includes(x)), `all five steps seen: ${seen.join(' → ')}`);
    await ph.until(async () => (await ph.state()).docked, 60000, 'at the quay at the end');
    await ph.step('docked', { steps: seen.join('→') });
  },

  /** 3. A sea fight of equals: «Атаковать», «Огонь», her grapples' reach in 30 s at most, the hex battle, the prize. */
  async fight(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Бой' : 'Fight') + rnd(), know: true });
    await ph.admin('/silver 3000');
    await castOff(ph);
    await openSea(ph);
    await ph.admin('/foe pirate sloop 320', 2500);
    await ph.step('foe');
    const t0 = ph.taps;
    await attack(ph);
    await ph.step('attack');
    const r = await closeIn(ph, 'pirate', 45000);
    // The game is to close fast and board (owner, 2026-10-06): «Атаковать» to the grapples in 10 s, 30 at the very most.
    await ph.step('alongside', { secs: +r.t.toFixed(1), fires: r.fires, hull: +r.hull.toFixed(2) });
    ph.expect(r.t <= 30, `«Атаковать» to the grapples in ${r.t.toFixed(1)} s (30 at most)`);
    // «На абордаж» — again if she slipped out of the grapples' reach a moment before the finger came down.
    await ph.until(async () => {
      if ((await ph.state()).tac) return true;
      if (await ph.tapIf('[data-risk="go"]', '«Рискнуть»')) return false;
      if (await ph.tapIf('#tc-act[data-act="board"]', '«На абордаж»')) { await L.sleep(1200); return false; }
      if (!(await ph.state()).pursuit && (await ph.tapIf('#tc-act[data-act="attack"]', '«Атаковать»'))) return false;
      return false;
    }, 30000, 'the hex battle');
    await ph.step('battle');
    await autoBattle(ph, 1);
    const end = await battleEnd(ph);
    ph.expect(!!end, 'the battle\'s end screen');
    // An equal's boarding is about an even fight (CLAUDE.md §5): won, the prize; lost, the reckoning and the quay.
    if (end.winner === end.you) {
      await ph.until(() => ph.visible('[data-fate]'), 15000, 'the prize window');
      await ph.step('prize');
      const silver0 = (await ph.state()).silver;
      await ph.tap('[data-fate="ransom"], [data-fate="prize"], [data-fate="release"]', 'the prize\'s choice');
      await ph.until(async () => !(await ph.visible('[data-fate]')), 10000, 'the prize window gone');
      await ph.step('settled', { silver: (await ph.state()).silver - silver0, taps: ph.taps - t0 });
    } else {
      await L.sleep(2500);
      await ph.skipFilm();
      await ph.step('lost', { docked: (await ph.state()).docked, taps: ph.taps - t0 });
    }
    ph.expect(ph.taps - t0 <= 12, `the fight in ${ph.taps - t0} taps (12 at most)`);
  },

  /** 4. A senior (a frigate's company) boarded: the risk window, «Отступить» once, then «Рискнуть», and its end. */
  async senior(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Риск' : 'Risk') + rnd(), know: true });
    await castOff(ph);
    await openSea(ph);
    // Afloat whatever the frigate's guns do (the scene's /god: the journey is the window and the battle, not a sinking).
    await ph.admin('/god on', 600);
    await ph.admin('/foe pirate frigate 110', 2500);
    await attack(ph);
    await closeIn(ph, 'pirate', 45000);
    if (await ph.visible('#tc-act[data-act="board"]')) await ph.tap('#tc-act[data-act="board"]', '«На абордаж»');
    await ph.until(() => ph.visible('[data-risk="go"]'), 10000, 'the risk window');
    const card = await ph.p.evaluate(() => document.querySelector('[data-risk="go"]')?.closest('.k-sheet, .k-risk, [role="dialog"], [role="alertdialog"]')?.innerText.replace(/\s+/g, ' ').slice(0, 300) ?? '');
    await ph.step('risk', { card: card.slice(0, 120) });
    ph.expect(/\d+\s?%/.test(card), 'the risk window says the chance in per cent');
    await ph.tap('[data-risk="back"]', '«Отступить»');
    await L.sleep(800);
    ph.expect(!(await ph.visible('[data-risk="go"]')), '«Отступить» shuts the window');
    await ph.step('backed_off', { herGrapples: !!(await ph.state()).tac });
    // She thinks again at once (a frigate's guns do not wait): «На абордаж» once more, and this time «Рискнуть» — unless
    // the frigate has thrown her own grapples meanwhile (the battle is then hers to begin).
    const inBattle = async () => !!(await ph.state()).tac;
    if (!(await inBattle())) {
      await ph.until(async () => (await inBattle()) || (await ph.visible('#tc-act[data-act="board"]')) || (await ph.visible('#tc-act[data-act="attack"]')), 8000, '«На абордаж» or «Атаковать» again');
      if (!(await inBattle()) && (await ph.visible('#tc-act[data-act="attack"]'))) { await ph.tap('#tc-act[data-act="attack"]', '«Атаковать»'); await closeIn(ph, 'pirate', 30000); }
      if (!(await inBattle()) && !(await ph.visible('[data-risk="go"]')) && (await ph.visible('#tc-act[data-act="board"]'))) await ph.tap('#tc-act[data-act="board"]', '«На абордаж»');
      await ph.until(async () => (await inBattle()) || (await ph.visible('[data-risk="go"]')), 10000, 'the risk window again');
      if (await ph.visible('[data-risk="go"]')) await ph.tap('[data-risk="go"]', '«Рискнуть»');
    }
    await ph.until(inBattle, 15000, 'the hex battle after «Рискнуть»');
    await ph.step('battle');
    await autoBattle(ph, 1);
    const end = await battleEnd(ph);
    const s = await ph.state();
    await L.sleep(2000);
    await ph.skipFilm();
    await ph.step('after', { won: end?.winner === end?.you, docked: s.docked });
  },

  /** 5. The harbour: «Продать всё», «Припасы», the yard's «Починить», the tavern's «Нанять N», the gold «В море». */
  async port(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Порт' : 'Port') + rnd(), know: true });
    // The scene: a damaged ship come home with rum in the hold, a full purse, hands short (not counted).
    await L.send(ph.p, { t: 'undock' }); await L.sleep(2500); await ph.skipFilm(); await L.closeAll(ph.p, 1);
    for (const x of ['/silver 5000', '/give rum 20', '/hurt 55', '/wounded 6']) await ph.admin(x, 600);
    await ph.admin('/tp saltmarrow', 2500); await L.send(ph.p, { t: 'dock' });
    // The film of the quay comes when it comes: waited for and ended (not the player's taps).
    for (let i = 0; i < 12; i++) { await L.sleep(500); if (await ph.skipFilm()) break; }
    await L.sleep(800); await L.closeAll(ph.p, 1);
    ph.taps = 0;
    ph.expect(!!(await ph.state()).docked, 'docked for the harbour');
    await ph.tap('#tc-act[data-act="harbour"]', '«Гавань»');
    await ph.until(() => ph.visible('#modal-panel [data-ptab="market"].on'), 8000, 'the harbour opens on its market');
    ph.expect(ph.taps === 1, `«Гавань» opened the harbour at the first tap (${ph.taps} taps)`);
    await ph.step('market');
    let s0 = await ph.state();
    await ph.tap('#modal-panel [data-act="sell_useful"]', '«Продать всё»');
    await ph.until(async () => (await ph.state()).silver > s0.silver, 8000, 'silver for the rum');
    ph.expect(!((await ph.state()).cargo.rum > 0), 'the rum is sold');
    await ph.step('sold');
    s0 = await ph.state();
    await ph.tap('#modal-panel [data-act="supplies"]', '«Припасы»');
    await ph.until(async () => (await ph.state()).provisions > s0.provisions || (await ph.state()).silver < s0.silver, 8000, 'the voyage\'s stores bought');
    await ph.step('supplies');
    await ph.tap('#modal-panel [data-ptab="shipyard"]', '«Верфь»');
    s0 = await ph.state();
    await ph.tap('#modal-panel [data-act="repair"]', '«Починить»');
    await ph.tapIf('#confirm [data-yes]', 'confirm');
    await ph.until(async () => { const s = await ph.state(); return s.hull >= s.hullMax - 0.5; }, 8000, 'the hull mended');
    await ph.step('repaired');
    await ph.tap('#modal-panel [data-ptab="tavern"]', '«Таверна»');
    s0 = await ph.state();
    await ph.tap('#modal-panel [data-act="hire_n"]', '«Нанять N»');
    await ph.until(async () => (await ph.state()).crew > s0.crew, 8000, 'hands hired');
    await ph.step('hired', { crew: (await ph.state()).crew - s0.crew });
    await ph.tap('#modal-panel [data-ptab="sea"]', '«В море»');
    await ph.until(async () => { if (await ph.tapIf('[data-dp="sail"]', '«Всё равно выйти»')) return false; return !(await ph.state()).docked; }, 20000, 'out to sea');
    await ph.step('sailed', { taps: ph.taps });
    ph.expect(ph.taps <= 9, `the harbour's round in ${ph.taps} taps (9 at most)`);
  },

  /** 6. Her island: the menu's «Ещё», «Остров», its town's buildings, «Собрать всё». */
  async island(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Остров' : 'Isle') + rnd(), know: true });
    await L.send(ph.p, { t: 'undock' }); await L.sleep(2500); await ph.skipFilm(); await L.closeAll(ph.p, 1);
    for (const x of ['/isle 3', '/town 2', '/yard 50', '/yard hours 6']) await ph.admin(x, 900);
    await L.closeAll(ph.p, 1);
    ph.taps = 0;
    await ph.tap('#tc-menu', '«Меню»');
    await ph.tap('.sea-menu [data-tile="more"]', '«Ещё»');
    await ph.tap('#modal-panel [data-menu="base"]', '«Остров»');
    await ph.until(async () => (await ph.state()).modal === 'base' || (await ph.visible('#modal-panel [data-btab]')), 8000, 'the island window');
    await ph.step('island');
    await ph.tap('#modal-panel [data-btab="town"]', '«Город»');
    await ph.until(() => ph.visible('#modal-panel [data-town], #modal-panel [data-tbuild], #modal-panel [data-trecruit]'), 8000, 'the town\'s buildings');
    await ph.step('town');
    await ph.tap('#modal-panel [data-btab="plots"]', '«Постройки»');
    if (await ph.visible('#modal-panel [data-bcollect]')) {
      await ph.tap('#modal-panel [data-bcollect]', '«Собрать всё»');
      await ph.step('collected');
    } else await ph.step('nothing_to_collect');
    ph.expect(ph.taps <= 6, `the island's town in ${ph.taps} taps (6 at most)`);
  },

  /** 7. The captain's book: «Меню», «Капитан», «Книга» — the orders, the path; and the gear's «Надеть лучшее». */
  async book(ph) {
    await signIn(ph, { name: (LANG === 'ru' ? 'Книга' : 'Book') + rnd(), know: true });
    await L.send(ph.p, { t: 'undock' }); await L.sleep(2500); await ph.skipFilm(); await L.closeAll(ph.p, 1);
    for (const x of ['/level 10', '/order all', '/will full']) await ph.admin(x, 900);
    await L.closeAll(ph.p, 2);
    ph.taps = 0;
    await ph.tap('#tc-menu', '«Меню»');
    await ph.tap('.sea-menu [data-tile="hero"]', '«Капитан»');
    await ph.until(() => ph.visible('#modal-panel [data-ctab="book"]'), 8000, 'the captain window');
    await ph.step('captain');
    await ph.tap('#modal-panel [data-ctab="book"]', '«Книга»');
    await ph.until(() => ph.p.evaluate(() => { const e = document.querySelector('#modal-panel .hx-orders > *'); const r = e?.getBoundingClientRect(); return !!r && r.height > 20 && r.top < innerHeight; }), 8000, 'the orders in the book');
    await ph.step('orders');
    await ph.tap('#modal-panel [data-cchip="path"]', '«Путь»');
    await ph.step('path');
    await ph.tap('#modal-panel [data-ctab="gear"]', '«Снаряжение»');
    await ph.step('gear');
    ph.expect(ph.taps <= 6, `the book in ${ph.taps} taps`);
  },
};

const results = [];
const b = await L.browser();
for (let rep = 0; rep < REPEAT; rep++) {
  for (const name of JOURNEYS) {
    if (!J[name]) { console.log('no journey', name); continue; }
    const port = name === 'login' || name === 'tutorial' ? GPORT : APORT;
    const p = await L.page(b, L.SIZES.phone, { lang: LANG, films: true, touch: true });
    const ph = new Phone(p, { out: OUT, tag: `${LANG}_${name}${REPEAT > 1 ? `_r${rep + 1}` : ''}`, port });
    L.log(`▶ ${name}${REPEAT > 1 ? ` (${rep + 1}/${REPEAT})` : ''} on :${port}`);
    let ok = true, error = null;
    try { await J[name](ph); } catch (e) { ok = false; error = String(e.message ?? e).slice(0, 300); await ph.shot('FAIL'); }
    const errs = p.errors.filter((x) => !/WebSocket|ERR_CONNECTION|Failed to load resource/.test(x));
    if (ok && errs.length) { ok = false; error = `page errors: ${errs.slice(0, 3).join(' | ')}`; }
    results.push({ journey: name, rep: rep + 1, ok, secs: ph.sec(), taps: ph.taps, error, steps: ph.steps, errors: errs.slice(0, 5) });
    L.log(`${ok ? '✓' : '✗'} ${name} ${ph.sec()} s, ${ph.taps} taps${error ? ' — ' + error : ''}`);
    await p.ctx.close();
  }
}
await b.close();
const sum = { at: new Date().toISOString(), lang: LANG, size: '812×375 touch', repeat: REPEAT, passed: results.filter((r) => r.ok).length, total: results.length, results };
writeFileSync(`${OUT}/e2e_${LANG}.json`, JSON.stringify(sum, null, 1));
console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.journey.padEnd(9)} ${String(r.secs).padStart(6)} s ${String(r.taps).padStart(3)} taps${r.error ? '  ' + r.error : ''}`).join('\n'));
console.log(`${sum.passed}/${sum.total} passed`);
process.exit(sum.passed === sum.total ? 0 : 1);
