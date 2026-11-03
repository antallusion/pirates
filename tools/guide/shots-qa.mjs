// «Лоцманская книга»: the screenshots of the sections ISLAND, ARMY, EXPLORE, PROGRESS and FAQ (assets/guide/*.webp) —
// real shots of the game on a local QA server, the spot outlined in gold, 1024×576, cropped, WEBP ≤ 60 KB.
//   PORT=58820 GRAVETIDE_ADMIN=1 DB_PATH=data/qa-guide.db node --disable-warning=ExperimentalWarning server/src/main.ts
//   GPORT=58820 node tools/guide/shots-qa.mjs            (all)
//   GPORT=58820 ONLY=isle-claim,army node tools/guide/shots-qa.mjs   (scenes whose id begins with one of these)
// Every slide image of shared/src/data/guide/{island,army,explore,progress,faq}.ts is made here; the run ends with the
// list of images no scene made (it must be empty).
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
const K = await import(new URL(`./shots-qa-kit.mjs${globalThis.__gbust ? `?${globalThis.__gbust}` : ''}`, import.meta.url).href);

const { sleep, shot, say, clean, click, clickText, tp, waitFor } = K;
const L = K.L;

/** Tag the first visible element under `sel` whose text matches `re` (the closest `up` ancestor, if given), so a shot
 *  can outline it as [data-gq="name"]. */
const tag = (p, name, sel, re, up) => p.evaluate(([n, s, r, u]) => {
  document.querySelectorAll(`[data-gq="${n}"]`).forEach((e) => e.removeAttribute('data-gq'));
  const rx = r ? new RegExp(r) : null;
  const e = [...document.querySelectorAll(s)].find((x) => x.getClientRects().length && (!rx || rx.test(x.textContent)));
  const t = e && u ? e.closest(u) ?? e : e;
  if (t) t.setAttribute('data-gq', n);
  return !!t;
}, [name, sel, re ?? null, up ?? null]);
const q = (n) => `[data-gq="${n}"]`;

/** The island scene open (on her own island), its side panel `side` open if given. */
async function isle(p, side) {
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('base'));
  await waitFor(p, '#isle [data-iside]', 15000);
  await sleep(1500);
  // the shop's offer card over the scene
  await p.evaluate(() => document.querySelectorAll('#isle .is-offer [data-ix], #isle .is-deal [data-ix], #isle .po-x').forEach((x) => x.click())).catch(() => {});
  if (side) { await click(p, `#isle [data-iside="${side}"]`); await sleep(1500); }
}

/** A spot of the island scene (a plot 'p:3', a town building 't:hall') as a box of w×h around its middle. */
async function isleSpot(p, key, w = 160, h = 140) {
  const at = await p.evaluate((k) => globalThis.gravetide.isle.probe(k).at, key);
  if (!at) throw new Error(`no island spot ${key}`);
  return [at.x - w / 2, at.y - h * 0.7, w, h];
}

/** Dock her at a port by its id (teleport to its approach, «Причалить», wait). */
async function dock(p, port = 'saltmarrow') {
  const m = await L.me(p);
  if (m.docked === port) return;
  await clean(p);
  await say(p, `/tp ${port}`);
  await sleep(1500);
  await waitFor(p, '.act-btn.act-dock', 10000);
  await click(p, '.act-btn.act-dock');
  for (let i = 0; i < 30; i++) { await sleep(1000); if ((await L.me(p)).docked) break; }
  await sleep(1500);
  await clean(p);
}

/** The port window on a tab. */
async function portTab(p, tab) {
  await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.open('port'); });
  await sleep(1200);
  if (tab) { await click(p, `#modal-panel [data-ptab="${tab}"]`); await sleep(1500); }
}

/** The hire window from the port's «Армия» tab. */
async function hire(p) {
  await portTab(p, 'army');
  await click(p, '#modal-panel [data-dwell]');
  await waitFor(p, '#modal-panel [data-rcu]', 10000);
  await sleep(1200);
}

/** A wild island she may claim: the shore of the nearest one (her ship stopped there), or null. */
async function claimSpot(p) {
  const cands = await p.evaluate(() => {
    const s = globalThis.gravetide.state, o = s.ownDisplay;
    return [...s.islands.values()].filter((i) => !i.portId && !i.minor).map((i) => ({ x: i.x, y: i.y, r: i.r, d: Math.hypot(i.x - o.x, i.y - o.y) })).sort((a, b) => a.d - b.d).slice(0, 8);
  });
  for (const c of cands) {
    for (const k of [0.95, 1.05, 0.85, 1.15]) {
      await tp(p, c.x, c.y - c.r * k, 2500);
      if (await p.evaluate(() => !!globalThis.gravetide.state.self?.claimIsle)) return c;
    }
  }
  return null;
}

// ─── the scenes ──────────────────────────────────────────────────────────────────────────────────────────────────────
// ctx.vet() — a seasoned captain (⚓20, a frigate, an island at Town Hall 3 with its town at level 2, money);
// ctx.fresh(name) — a new captain of her own.
export const SCENES = [];
const scene = (id, run) => SCENES.push({ id, run });

scene('isle-claim', async (ctx) => {
  const p = await ctx.fresh('Новичок', 'corsair', ['/level 5']);
  if (!(await claimSpot(p))) throw new Error('no claimable shore');
  await sleep(1500);
  await ctx.shot(p, 'isle-claim-1', { mark: '.act-btn.act-claim', pad: 150 });
  await click(p, '.act-btn.act-claim');
  await waitFor(p, '[data-est="claim"]');
  await sleep(1200);
  await ctx.shot(p, 'isle-claim-2', { mark: ['.claim-card [data-est="claim"]', '.claim-card'], pad: 20 });
  await ctx.shot(p, 'isle-claim-3', { mark: { sel: '#modal-panel .card', text: 'Другие свободные острова' }, pad: 20 });
  await ctx.shot(p, 'isle-claim-5', { mark: [{ sel: '.claim-card dt', text: 'Переезд' }, { sel: '.claim-card dt', text: 'Переезд', next: true }], pad: 60 });
  await click(p, '[data-est="claim"]');
  await sleep(1200);
  await clickText(p, '^Подтвердить$');
  await sleep(4000);
  await isle(p);
  await ctx.shot(p, 'isle-claim-4', { mark: await isleSpot(p, 't:hall', 190, 170), pad: 60 });
  ctx.newIsle = p;
});

scene('isle-first', async (ctx) => {
  let p = ctx.newIsle;
  if (!p) {
    p = await ctx.fresh('Новичок', 'corsair', ['/level 5']);
    if (!(await claimSpot(p))) throw new Error('no claimable shore');
    await click(p, '.act-btn.act-claim');
    await waitFor(p, '[data-est="claim"]');
    await click(p, '[data-est="claim"]');
    await sleep(1200);
    await clickText(p, '^Подтвердить$');
    await sleep(4000);
  }
  await clean(p);
  await waitFor(p, '#hud-isle1:not(.hidden)');
  await ctx.shot(p, 'isle-first-1', { mark: '#hud-isle1', pad: 60 });
  // the yard after the governor's help (the goods for the bunkhouse and the barracks)
  await isle(p);
  await ctx.shot(p, 'isle-first-5', { mark: '#isle .is-store', pad: 40 });
  // the first step's card: the bunkhouse first, almost free
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw1'));
  await sleep(1800);
  await ctx.shot(p, 'isle-first-2', { mark: ['#isle .is-card', '#isle .is-card [data-tbuild="dw1"]'], pad: 10 });
  await click(p, '#isle .is-card [data-tbuild="dw1"]');
  await sleep(1500);
  await say(p, '/build finish');
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1800);
  await ctx.shot(p, 'isle-cost-1', { mark: [{ sel: '#isle .is-card [data-src]', up: 'div' }, '#isle .is-card [data-tbuild="dw2"]'], pad: 60 });
  await clean(p);
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await click(p, '#isle .is-card [data-tbuild="dw2"]');
  await sleep(1500);
  await say(p, '/build finish', '/silver 5000');
  await sleep(1500);
  await clean(p);
  await dock(p);
  await hire(p);
  await ctx.shot(p, 'isle-first-3', { mark: { sel: '#modal-panel *', text: '^ваш остров$', up: '.card' }, pad: 30 });
  // hire marines: the third step's line
  await click(p, '#modal-panel .rc-unit[data-rcu="marine"]');
  await sleep(500);
  await click(p, '#modal-panel [data-rcmax]');
  await sleep(300);
  await click(p, '#modal-panel [data-rcgo]');
  await sleep(2500);
  await clean(p);
  await waitFor(p, '#hud-isle1:not(.hidden)');
  await ctx.shot(p, 'isle-first-4', { mark: '#hud-isle1', pad: 60 });
  await ctx.done(p);
  ctx.newIsle = null;
});

scene('isle-town', async (ctx) => {
  const p = await ctx.vet();
  await isle(p);
  await ctx.shot(p, 'isle-town-1', { mark: '#isle [data-iside="town"]', pad: 200 });
  await ctx.shot(p, 'isle-producers-3', { mark: ['#isle [data-iside="collect"]', '#isle .is-store'], pad: 30 });
  await ctx.shot(p, 'isle-cost-3', { mark: '#isle .is-store [data-itre]', pad: 120 });
  await ctx.shot(p, 'isle-cost-4', { mark: '#isle .is-queue', pad: 80 });
  await ctx.shot(p, 'isle-town-5', { mark: '#isle .is-rec', pad: 80 });
  await click(p, '#isle [data-iside="town"]');
  await sleep(1800);
  await ctx.shot(p, 'isle-town-2', { mark: { sel: '#isle .tw-card', text: 'Сердце острова' }, pad: 20 });
  await ctx.shot(p, 'isle-cost-2', { mark: '#isle .tw-card .tw-next', pad: 60 });
  await K.reveal(p, '#isle .tw-card.dw');
  await sleep(500);
  await ctx.shot(p, 'isle-town-3', { mark: [{ sel: '#isle [data-tbuild="dw1"]', up: '.tw-card' }, { sel: '#isle [data-tbuild="dw2"]', up: '.tw-card' }], pad: 20 });
  await K.reveal(p, '[data-tbuild="keep"]');
  await sleep(500);
  await ctx.shot(p, 'isle-town-4', { mark: { sel: '#isle .tw-card', text: 'Стены города' }, pad: 20 });
  await ctx.shot(p, 'army-tiers-3', { mark: [{ sel: '#isle [data-tbuild="dw3"]', up: '.tw-card' }, { sel: '#isle [data-tbuild="dw4"]', up: '.tw-card' }], pad: 20 });
  // the workshop and the anvil (lying off the island)
  await clean(p);
  await say(p, '/town go');
  await sleep(3000);
  await isle(p, 'town');
  await K.reveal(p, '#isle .tw-land');
  await sleep(600);
  await ctx.shot(p, 'isle-forge-3', { mark: { sel: '#isle .tw-land', text: 'Мастерская' }, pad: 20 });
  await K.reveal(p, '#isle .tw-forge');
  await sleep(600);
  await ctx.shot(p, 'isle-forge-4', { mark: '#isle .tw-forge', pad: 20 });
});

scene('isle-haul', async (ctx) => {
  const p = await ctx.vet();
  await say(p, '/town go', '/give timber 30', '/give iron 10');
  await sleep(2000);
  await isle(p);
  await ctx.shot(p, 'isle-haul-1', { mark: ['#isle [data-iside="haul"]', '#isle .is-store [data-itre]'], pad: 60 });
  await click(p, '#isle [data-iside="haul"]');
  await sleep(1800);
  await ctx.shot(p, 'isle-haul-2', { mark: ['#isle [data-ihamt]', '#isle [data-ihdep]', '#isle [data-ihall]'], pad: 40 });
  await K.reveal(p, '#isle [data-ihbarge]');
  await sleep(500);
  await ctx.shot(p, 'isle-haul-3', { mark: ['#isle [data-ihbarge]'], pad: 90 });
  await K.reveal(p, '#isle [data-ihun]');
  await sleep(500);
  await ctx.shot(p, 'isle-haul-4', { mark: ['#isle [data-ihun]'], pad: 110 });
  await clean(p);
  await isle(p);
  await ctx.shot(p, 'isle-haul-5', { mark: '#isle .is-store', pad: 30 });
});

scene('isle-raze', async (ctx) => {
  const p = await ctx.vet();
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw7'));
  await sleep(1800);
  await ctx.shot(p, 'isle-raze-1', { mark: '#isle .is-card [data-braze]', pad: 140 });
  await click(p, '#isle .is-card [data-braze]');
  await sleep(1200);
  await ctx.shot(p, 'isle-raze-2', { mark: '#confirm .confirm-panel', pad: 20 });
  await click(p, '#confirm .k-btn:not(.k-btn--primary)');
  await sleep(800);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('hall'));
  await sleep(1800);
  await ctx.shot(p, 'isle-raze-3', { mark: '#isle .is-card', pad: 20 });
});

scene('isle-producers', async (ctx) => {
  const p = await ctx.vet();
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.openThing('nothing-built'));
  await sleep(1800);
  await ctx.shot(p, 'isle-producers-1', { mark: [{ sel: '#isle .is-card [data-bbuild="p:lumber"]', up: 'div' }, { sel: '#isle .is-card [data-bbuild="p:fishery"]', up: 'div' }], pad: 30 });
  await click(p, '#isle .is-card [data-bbuild="p:quarry"]');
  await sleep(1500);
  await say(p, '/build finish');
  await sleep(1500);
  await p.evaluate(() => globalThis.gravetide.isle.openThing('quarry'));
  await sleep(1800);
  await ctx.shot(p, 'isle-producers-2', { mark: { sel: '#isle .is-card [data-bbuild="p:mine"]', up: 'div' }, pad: 60 });
  await p.evaluate(() => globalThis.gravetide.isle.openThing('nothing-built'));
  await sleep(1800);
  await ctx.shot(p, 'isle-producers-4', { mark: { sel: '#isle .is-card *', text: '^(ПРОМЫСЛЫ|Промыслы)$' }, pad: 120 });
  // the forge opens at Town Hall 3: the whole tree raised to level 3
  await clean(p);
  await say(p, '/build tree 3', '/build finish');
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.openThing('nothing-built'));
  await sleep(1800);
  await K.reveal(p, '#isle .is-card [data-bbuild="forge"]');
  await sleep(500);
  await ctx.shot(p, 'isle-forge-1', { mark: { sel: '#isle .is-card [data-bbuild="forge"]', up: 'div' }, pad: 60 });
});

scene('isle-rush', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/build tree 3');
  await isle(p);
  // (the whole tree stands at 3 by now: the Town Hall's next level is the long job to rush; first «Где взять» on
  // the timber it lacks)
  await p.evaluate(() => globalThis.gravetide.isle.showTown('hall'));
  await sleep(1800);
  await p.evaluate(() => { const c = [...document.querySelectorAll('#isle .is-card [data-src].lack')][0]; c?.setAttribute('data-gq', 'chip'); });
  await ctx.shot(p, 'isle-where-1', { mark: '[data-gq="chip"]', pad: 120 });
  await click(p, '[data-gq="chip"]');
  await waitFor(p, '#srctip');
  await sleep(800);
  await ctx.shot(p, 'isle-where-2', { mark: '#srctip', pad: 30 });
  await ctx.shot(p, 'isle-where-3', { mark: ['#srctip [data-stgo]', { sel: '#srctip *', text: 'Подробнее$' }], pad: 60 });
  await clean(p);
  await say(p, '/yard 600', '/res 50');
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('hall'));
  await sleep(1500);
  await click(p, '#isle .is-card [data-tbuild="hall"]');
  await sleep(2000);
  await clean(p);
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('hall'));
  await sleep(1500);
  await ctx.shot(p, 'isle-rush-1', { mark: ['#isle .is-queue [data-qtown]', '#isle [data-iboost]'], pad: 40 });
  await ctx.shot(p, 'isle-rush-2', { mark: '#isle [data-iboost]', pad: 110 });
  await ctx.shot(p, 'isle-rush-3', { mark: '#isle [data-ifin]', pad: 110 });
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.shop());
  await sleep(2000);
  await click(p, '[data-shtab="isle"]');
  await sleep(1500);
  await ctx.shot(p, 'isle-rush-4', { mark: ['[data-shtab="isle"]', '[data-shsec]'], pad: 30 });
  await say(p, '/build finish');
  await clean(p);
});

scene('isle-boats', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  const isl = await p.evaluate(() => { const s = globalThis.gravetide.state; const i = s.islands.get(s.self.homeIsle); return i ? { x: i.x, y: i.y } : null; });
  await tp(p, isl.x + 4200, isl.y + 2600);
  await clean(p);
  await click(p, '#tc-menu, #tc-more, [data-tc="more"]');
  await sleep(1000);
  await ctx.shot(p, 'isle-boats-1', { mark: '#tc-boats', pad: 120 });
  await click(p, '#tc-boats');
  await waitFor(p, '#modal-panel .rc-unit', 10000);
  await sleep(1500);
  for (const [u, frac] of [['marine', 0.5], ['musketeer', 1]]) {
    await click(p, `#modal-panel .rc-unit[data-rcu="${u}"]`);
    await sleep(400);
    await p.evaluate((f) => { const sl = document.querySelector('[data-rcn]'); if (!sl) return; sl.value = String(Math.max(1, Math.floor(Number(sl.max) * f))); sl.dispatchEvent(new Event('input', { bubbles: true })); }, frac);
    await sleep(300);
    await click(p, '[data-rcboat]');
    await sleep(600);
  }
  await ctx.shot(p, 'isle-boats-2', { mark: '#modal-panel .rc-boats', pad: 30 });
  await ctx.shot(p, 'isle-boats-3', { mark: '#modal-panel [data-rbsend]', pad: 120 });
  await click(p, '#modal-panel [data-rbsend]');
  await sleep(1500);
  await clean(p);
  await sleep(1500);
  await ctx.shot(p, 'isle-boats-4', { mark: '#hud-boats', pad: 120 });
  await clean(p);
  await isle(p, 'town');
  await ctx.shot(p, 'isle-boats-5', { mark: { sel: '#isle .tw-card', text: 'Сердце острова' }, pad: 20 });
  await clean(p);
});

scene('army-hire', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p);
  await say(p, '/army deckhand 60', '/dwell fill');
  await portTab(p, 'army');
  await ctx.shot(p, 'army-hire-1', { mark: ['#modal-panel [data-ptab="army"]', '#modal-panel [data-dwell]'], pad: 40 });
  await ctx.shot(p, 'army-healer-1', { mark: [{ sel: '#modal-panel .card', text: 'Лекарь' }], pad: 30 });
  await hire(p);
  await ctx.shot(p, 'army-hire-2', { mark: ['#modal-panel .rc-unit[data-rcu="marine"]', '#modal-panel .rc-unit[data-rcu="musketeer"]'], pad: 40 });
  await click(p, '#modal-panel .rc-unit[data-rcu="marine"]');
  await sleep(800);
  await ctx.shot(p, 'army-hire-3', { mark: ['#modal-panel [data-rcn]', '#modal-panel [data-rcmax]', '#modal-panel [data-rcgo]'], pad: 30 });
  await ctx.shot(p, 'army-hire-4', { mark: { sel: '#modal-panel .chip, #modal-panel span, #modal-panel div', text: '^Койки', up: 'div' }, pad: 20 });
  await ctx.shot(p, 'army-might-1', { mark: [{ sel: '#modal-panel *', text: '^Сила \\d' }], pad: 120 });
  await ctx.shot(p, 'army-might-2', { mark: [{ sel: '#modal-panel *', text: '^Отборные \\d' }], pad: 120 });
  await ctx.shot(p, 'army-island-1', { mark: [{ sel: '#modal-panel *', text: '^ваш остров$', up: '.card' }], pad: 20 });
  await ctx.shot(p, 'army-island-2', { mark: ['#modal-panel .rc-unit[data-rcu="marine"]', { sel: '#modal-panel *', text: '^Таверна$', up: '.card' }], pad: 30 });
  await ctx.shot(p, 'army-tiers-1', { mark: ['#modal-panel .rc-unit[data-rcu="gunner"]', '#modal-panel .rc-unit[data-rcu="bombardier"]'], pad: 40 });
  await ctx.shot(p, 'army-island-4', { mark: [{ sel: '#modal-panel *', text: '^Утопленники служат только', up: '.card' }], pad: 20 });
  await K.reveal(p, '#modal-panel [data-rctrain]');
  await sleep(500);
  await ctx.shot(p, 'army-tiers-2', { mark: [{ sel: '#modal-panel *', text: '^Улучшение отрядов$', up: '.card' }], pad: 20 });
  await K.reveal(p, '#modal-panel .rc-unit');
  // the hammocks full of deckhands: hiring marines sends them ashore
  await say(p, '/army deckhand 200');
  await sleep(1500);
  await hire(p);
  await click(p, '#modal-panel .rc-unit[data-rcu="marine"]');
  await sleep(800);
  await ctx.shot(p, 'army-island-3', { mark: ['#modal-panel [data-rcswap]', '#modal-panel [data-rcgo]'], pad: 40 });
  await say(p, '/army deckhand 60');
  // the tavern's deckhands
  await portTab(p, 'tavern');
  await ctx.shot(p, 'army-hire-5', { mark: ['#modal-panel #tv-hire', '#modal-panel [data-act="hire_n"]'], pad: 50 });
  await clean(p);
});

scene('army-stacks', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/army deckhand 60', '/army marine 20', '/army musketeer 19');
  await sleep(1500);
  await p.evaluate(() => globalThis.gravetide.open('crew'));
  await waitFor(p, '#modal-panel [data-sk]');
  await sleep(1200);
  await ctx.shot(p, 'army-stacks-1', { mark: { sel: '#modal-panel .card', text: 'Армия', up: '.card' }, pad: 10 });
  await ctx.shot(p, 'army-might-3', { mark: { sel: '#modal-panel *', text: '^Бойцов: \\d' }, pad: 120 });
  await click(p, '#modal-panel [data-sk]');
  await sleep(800);
  await ctx.shot(p, 'army-stacks-2', { mark: ['#modal-panel [data-op-split]', '#modal-panel [data-op-dismiss]'], pad: 80 });
  await click(p, '#modal-panel [data-op-split]');
  await sleep(800);
  await ctx.shot(p, 'army-stacks-3', { mark: ['#modal-panel [data-split-n]', '#modal-panel [data-split-go]'], pad: 50 });
  await click(p, '#modal-panel [data-split-go]');
  await sleep(1500);
  await ctx.shot(p, 'army-stacks-4', { mark: '#modal-panel [data-sk]', pad: 140 });
  await click(p, '#modal-panel [data-sk]');
  await sleep(600);
  await click(p, '#modal-panel [data-op-dismiss]');
  await sleep(1000);
  await ctx.shot(p, 'army-stacks-5', { mark: '#confirm .confirm-panel', pad: 20 });
  await click(p, '#confirm .k-btn:not(.k-btn--primary)');
  await clean(p);
  await say(p, '/army deckhand 60', '/army marine 20', '/army musketeer 19');
});

scene('army-gift', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // the thank-you letter of 2026-10-28 (10 gift musketeers) goes to the captains made before its send: on the QA
  // database (never production's) its send is moved past now, so this captain is owed it too
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(process.env.QA_DB ?? 'data/qa-guide.db');
  db.prepare("UPDATE kv SET value = ? WHERE key = 'gift:2026-10-28:done'").run(JSON.stringify({ at: 9e12, n: 0 }));
  db.prepare("DELETE FROM kv WHERE key LIKE 'gift:2026-10-28:sent:%'").run();
  db.close();
  await say(p, '/gift28 send');
  await sleep(1500);
  // (the packet boat takes about a minute to bring it)
  for (let i = 0; i < 20; i++) {
    await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.open('journal'); });
    await sleep(1200);
    await click(p, '#modal-panel [data-jtab="letters"]');
    await sleep(1500);
    if (await p.evaluate(() => [...document.querySelectorAll('#modal-panel button')].some((b) => /^Получить/.test(b.textContent.trim()) && b.getClientRects().length))) break;
    await sleep(3000);
  }
  await ctx.shot(p, 'army-gift-1', { mark: [{ sel: '#modal-panel *', text: '^Вложено' }, { sel: '#modal-panel button', text: '^Получить' }], pad: 60 });
  await clickText(p, '^(Получить|Забрать)', '#modal-panel');
  await sleep(2000);
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('crew'));
  await waitFor(p, '#modal-panel [data-sk]');
  await sleep(1200);
  await ctx.shot(p, 'army-gift-2', { mark: [{ sel: '#modal-panel [data-sk]', text: 'подарок' }], pad: 60 });
  await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-sk]')].find((x) => /подарок/.test(x.textContent))?.click());
  await sleep(800);
  await ctx.shot(p, 'army-gift-3', { mark: [{ sel: '#modal-panel [data-sk]', text: 'подарок' }, '#modal-panel [data-op-split]'], pad: 40 });
  await clean(p);
});

scene('army-healer', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p);
  await say(p, '/way fallen marine 12');
  await portTab(p, 'army');
  await ctx.shot(p, 'army-healer-2', { mark: '#modal-panel [data-surgeon]', pad: 90 });
  await click(p, '#modal-panel [data-surgeon]');
  await sleep(1500);
  await ctx.shot(p, 'army-healer-3', { mark: [{ sel: '#modal-panel *', text: '^Морпехи ×', up: 'div' }, { sel: '#modal-panel button', text: 'Воскресить всех' }], pad: 30 });
  await clean(p);
});

scene('army-berths', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p);
  await portTab(p, 'berths');
  await ctx.shot(p, 'army-berths-1', { mark: [{ sel: '#modal-panel .card', text: 'Причал' }], pad: 20 });
  await ctx.shot(p, 'army-berths-4', { mark: '#modal-panel [data-act="berth_buy"]', pad: 120 });
  // a second hull bought, the frigate kept at the berth (the hold emptied first: a small hull takes no big cargo)
  await portTab(p, 'market');
  await click(p, '#modal-panel [data-act="sell_useful"]');
  await sleep(1500);
  await portTab(p, 'shipyard');
  // (the fold remembers being open: opened only if the hulls are not in sight)
  for (let i = 0; i < 3; i++) {
    if (await p.evaluate(() => !!document.querySelector('#modal-panel [data-act="ship"][data-cls="sloop"]')?.getClientRects().length)) break;
    await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-fold]')].find((b) => /Все корабли/.test(b.textContent))?.click());
    await sleep(1200);
  }
  await click(p, '#modal-panel [data-act="ship"][data-cls="sloop"]');
  await waitFor(p, '#confirm.k-open button');
  await sleep(800);
  await ctx.shot(p, 'army-berths-2', { mark: [{ sel: 'button', text: 'Купить и оставить' }], pad: 120 });
  await clickText(p, '^Купить и оставить');
  await sleep(2500);
  // (more men than the small hull sleeps: the yard asks, the rest are paid off)
  await p.evaluate(() => document.querySelector('#confirm.k-open .k-btn--primary')?.click());
  await sleep(2000);
  await portTab(p, 'berths');
  await ctx.shot(p, 'army-berths-3', { mark: ['#modal-panel [data-act="berth_swap"]'], pad: 120 });
  await click(p, '#modal-panel [data-act="berth_swap"]');
  await sleep(2000);
  await ctx.shot(p, 'army-berths-5', { mark: [{ sel: '#modal-panel .card', text: 'Причал' }], pad: 20 });
  // the call cancelled, the seasoned captain's frigate back under her
  await click(p, '#modal-panel [data-act="berth_swap"]');
  await sleep(1000);
  await clean(p);
  await say(p, '/ship frigate 6');
});

scene('army-escorts', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p);
  await portTab(p, 'harbour');
  await K.reveal(p, '[data-act="claim"]');
  await sleep(400);
  await ctx.shot(p, 'army-escorts-1', { mark: [{ sel: '#modal-panel .card', text: '^\\s*Конвой' }], pad: 30 });
  await portTab(p, 'shipyard');
  await ctx.shot(p, 'army-escorts-3', { mark: '#modal-panel [data-act="repair"]', pad: 120 });
  // the Command tree: ten points in it open the first convoy berth
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('talents'));
  await sleep(2000);
  await click(p, '#modal-panel [data-view="command"]');
  await sleep(1500);
  await ctx.shot(p, 'army-escorts-2', { mark: ['#modal-panel [data-view="command"]', { sel: '#modal-panel *', text: '^Командование$' }], pad: 40 });
  await clean(p);
});

/** The chart open on a layer. */
async function chart(p, layer) {
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('map'));
  await waitFor(p, '#worldmap-canvas', 8000);
  await sleep(1500);
  if (layer) { await click(p, `#modal-panel [data-mlayer="${layer}"]`); await sleep(1500); }
}

/** The talents window on a tree. */
async function tree(p, view) {
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('talents'));
  await sleep(1800);
  await click(p, `#modal-panel [data-view="${view}"]`);
  await sleep(1500);
}

/** A talent's card in the open tree by its name. */
const talent = (name) => ({ sel: '#modal-panel *', text: `^${name}$`, up: '.talent, .talent-card, .tl-card, li' });

/** Wait for the land family's action at hand (it shows once the ship lies there). */
const atHand = (p, sel = '.act-btn.act-land') => waitFor(p, sel, 8000);

scene('exp-treasure', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow', '/weather calm', '/time 12');
  await sleep(2500);
  // (the admin's answer names the spot; it is caught off the wire — the toasts queue behind the day's news)
  await p.evaluate(() => {
    globalThis.__gspot = null;
    if (!globalThis.__gspotOn) { globalThis.__gspotOn = true; globalThis.gravetide.net.on((m) => { const t = JSON.stringify(m); const r = t.match(/m\d+ \(.*?\): (?:the spot|место клада) (\d+) (\d+)/); if (r) globalThis.__gspot = { x: Number(r[1]), y: Number(r[2]) }; }); }
  });
  await L.say(p, '/tmap 1 circle');
  let spot = { x: null };
  for (let i = 0; i < 40 && !spot.x; i++) {
    await sleep(250);
    spot = (await p.evaluate(() => globalThis.__gspot)) ?? { x: null };
  }
  if (!spot.x) throw new Error('no treasure spot in the toast');
  await chart(p, 'treasure');
  await ctx.shot(p, 'exp-treasure-1', { mark: '#modal-panel [data-mlayer="treasure"]', pad: 220 });
  await ctx.shot(p, 'exp-treasure-2', { mark: '#modal-panel [data-tmsail]', pad: 160 });
  // inside the circle, some 1 km off the spot: «Теплее»
  await clean(p);
  await tp(p, spot.x + 1000, spot.y + 150);
  await sleep(2500);
  await ctx.shot(p, 'exp-treasure-3', { mark: '.tm-heat', pad: 140 });
  // the scroll in sight
  await tp(p, spot.x + 150, spot.y + 40);
  await sleep(2500);
  const [sx, sy] = await K.onScreen(p, spot.x, spot.y);
  await ctx.shot(p, 'exp-treasure-4', { mark: [[sx - 40, sy - 40, 80, 80], '.tm-heat'], pad: 80 });
  // over it: «Копать»
  await tp(p, spot.x + 20, spot.y + 20);
  await atHand(p);
  await sleep(1000);
  await ctx.shot(p, 'exp-treasure-5', { mark: '.act-btn.act-land', pad: 160 });
  // the dig under way: the countdown at the head of the top stack
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 6000);
  await sleep(1500);
  await ctx.shot(p, 'exp-spot-1', { mark: '#hud-spot', pad: 120 });
  await ctx.shot(p, 'exp-spot-2', { mark: '#hud-spot .sp-stop', pad: 140 });
  await ctx.shot(p, 'exp-spot-3', { mark: [await K.shipBox(p, 110), '#hud-fx .fx-i'], pad: 60 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'spot', action: 'abort' }));
  await sleep(1500);
  await tree(p, 'exploration');
  await ctx.shot(p, 'exp-treasure-6', { mark: talent('Кладоискатель'), pad: 60 });
  await ctx.shot(p, 'exp-wrecks-4', { mark: talent('Ловец жемчуга'), pad: 60 });
  await ctx.shot(p, 'exp-nav-1', { mark: talent('Картограф'), pad: 60 });
  await ctx.shot(p, 'exp-nav-2', { mark: talent('Первопроходец'), pad: 60 });
  await clean(p);
});

scene('exp-wrecks', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // the wreck of the Saint Brendan, 4 m, right off Saltmarrow
  await tp(p, 11147, 87366);
  await atHand(p);
  await sleep(1200);
  await ctx.shot(p, 'exp-wrecks-1', { mark: ['.act-btn.act-land', await K.shipBox(p, 110)], pad: 50 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 6000);
  await sleep(3000);
  await ctx.shot(p, 'exp-wrecks-3', { mark: '#hud-spot', pad: 120 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'spot', action: 'abort' }));
  await sleep(1500);
  await chart(p, 'goals');
  await ctx.shot(p, 'exp-wrecks-2', { mark: '#modal-panel [data-mlayer="goals"]', pad: 220 });
  await clean(p);
});

scene('exp-landing', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // the ruins of Widowcliff (40 s ashore)
  await tp(p, 39436, 84868);
  await atHand(p);
  await sleep(1200);
  await ctx.shot(p, 'exp-landing-1', { mark: ['.act-btn.act-land', await K.shipBox(p, 110)], pad: 50 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 6000);
  await sleep(8000);
  await ctx.shot(p, 'exp-landing-2', { mark: '#hud-spot', pad: 120 });
  // the haul home: the toast as the boats come back
  for (let i = 0; i < 70; i++) { if (!(await p.evaluate(() => !!globalThis.gravetide.state.self?.spot))) break; await sleep(1000); }
  await sleep(1200);
  await ctx.shot(p, 'exp-landing-3', { mark: '#toasts > .toast', pad: 80 });
  // (a find of the ruins opens its card a moment later)
  await sleep(5000);
  await clean(p);
});

scene('exp-mines', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // the silver mine of Lanternisle Rock, made nobody's: its guards first
  await say(p, '/tp saltmarrow', '/mine free', '/mine go', '/guard reset');
  await sleep(3000);
  await K.stop(p);
  await waitFor(p, '#hud-prompt .act-info');
  await sleep(1200);
  await ctx.shot(p, 'exp-mines-1', { mark: ['#hud-prompt .act-info', await K.shipBox(p, 110)], pad: 50 });
  await say(p, '/guard beat');
  await atHand(p);
  await sleep(1200);
  await ctx.shot(p, 'exp-mines-2', { mark: ['.act-btn.act-land', await K.shipBox(p, 110)], pad: 50 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 20000);
  await sleep(3000);
  await ctx.shot(p, 'exp-mines-3', { mark: '#hud-spot', pad: 120 });
  for (let i = 0; i < 40; i++) { if (!(await p.evaluate(() => !!globalThis.gravetide.state.self?.spot))) break; await sleep(1000); }
  await sleep(1200);
  await ctx.shot(p, 'exp-mines-4', { mark: { sel: '#toasts > .toast', text: 'флаг' }, pad: 80 });
  await chart(p, 'all');
  await ctx.shot(p, 'exp-mines-5', { mark: '#modal-panel [data-mlayer="all"]', pad: 220 });
  await clean(p);
});

scene('exp-lairs', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow', '/lair seal_rookery reset', '/lair seal_rookery go');
  await sleep(3000);
  await K.stop(p);
  await atHand(p);
  await sleep(1200);
  await ctx.shot(p, 'exp-lairs-1', { mark: ['.act-btn.act-land', await K.shipBox(p, 110)], pad: 50 });
  await click(p, '.act-btn.act-look');
  await sleep(1800);
  await ctx.shot(p, 'exp-lairs-3', { mark: '#advcard', pad: 60 });
  await clean(p);
  await say(p, '/lair seal_rookery beat');
  await sleep(2000);
  await chart(p, 'lairs');
  await ctx.shot(p, 'exp-lairs-2', { mark: '#modal-panel [data-mlayer="lairs"]', pad: 220 });
  await say(p, '/lair seal_rookery reset');
  await clean(p);
});

scene('exp-marks', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow', '/seamark reset', '/seamark wreck go');
  await sleep(3000);
  await K.stop(p);
  await atHand(p, '.act-btn.act-mark');
  await sleep(1000);
  await ctx.shot(p, 'exp-marks-1', { mark: ['.act-btn.act-mark', await K.shipBox(p, 110)], pad: 50 });
  await click(p, '.act-btn.act-mark');
  await sleep(1500);
  await ctx.shot(p, 'exp-marks-2', { mark: '#hud-spot', pad: 120 });
  await sleep(5000);
  await say(p, '/seamark buoy go');
  await sleep(3000);
  await K.stop(p);
  await atHand(p, '.act-btn.act-mark');
  await sleep(1000);
  await ctx.shot(p, 'exp-marks-3', { mark: ['.act-btn.act-mark', await K.shipBox(p, 110)], pad: 50 });
  await clean(p);
});

scene('exp-lights', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // a lookout: the party climbs it (15 s) and charts the sea for 5 km around
  await say(p, '/tp saltmarrow', '/time 12', '/lookout');
  await sleep(3000);
  await K.stop(p);
  await atHand(p);
  await sleep(1000);
  await ctx.shot(p, 'exp-lights-1', { mark: ['.act-btn.act-land', await K.shipBox(p, 110)], pad: 50 });
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 20000);
  await sleep(2500);
  await ctx.shot(p, 'exp-lights-2', { mark: '#hud-spot', pad: 120 });
  for (let i = 0; i < 30; i++) { if (!(await p.evaluate(() => !!globalThis.gravetide.state.self?.spot))) break; await sleep(1000); }
  // the chart's key: the lighthouse's light and the lookout's reach among the rest
  await chart(p);
  await p.evaluate(() => { const d = document.querySelector('#modal-panel details.map-legend'); if (d) d.open = true; });
  await sleep(1000);
  await ctx.shot(p, 'exp-lights-3', { mark: [{ sel: '#modal-panel details.map-legend *', text: 'Зажжённый маяк' }, { sel: '#modal-panel details.map-legend *', text: 'Смотровая на мысе' }], pad: 60 });
  await p.evaluate(() => { const d = document.querySelector('#modal-panel details.map-legend'); if (d) d.open = false; });
  await clean(p);
});

scene('exp-chart', async (ctx) => {
  const p = await ctx.vet();
  await chart(p);
  await ctx.shot(p, 'exp-chart-1', { mark: ['#modal-panel [data-mlayer="ports"]', '#modal-panel [data-mlayer="yards"]'], pad: 30 });
  await ctx.shot(p, 'exp-chart-2', { mark: '#modal-panel details.map-legend', pad: 120 });
  await ctx.shot(p, 'exp-chart-3', { mark: [{ sel: '#modal-panel button', text: 'Где я' }, { sel: '#modal-panel button', text: 'К острову' }, { sel: '#modal-panel button', text: 'Найти врага' }], pad: 30 });
  await ctx.shot(p, 'exp-chart-4', { mark: [{ sel: '#modal-panel *', text: 'Где мой уровень' }, { sel: '#modal-panel button', text: 'Показать на карте' }], pad: 30 });
  await clean(p);
});

scene('exp-chronicle', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('journal'));
  await sleep(1200);
  await click(p, '#modal-panel [data-jtab="chronicle"]');
  await sleep(1500);
  await ctx.shot(p, 'exp-chronicle-1', { mark: '#modal-panel [data-jtab="chronicle"]', pad: 200 });
  await ctx.shot(p, 'exp-chronicle-2', { mark: ['#modal-panel [data-chf="all"]', '#modal-panel [data-chf="isle"]'], pad: 40 });
  await click(p, '#modal-panel [data-chf="loot"]');
  await sleep(1200);
  await ctx.shot(p, 'exp-chronicle-3', { mark: '#modal-panel [data-chf="loot"]', pad: 200 });
  await clean(p);
});

scene('exp-fog', async (ctx) => {
  const p = await ctx.fresh('Туман', 'navigator');
  await chart(p, 'all');
  await ctx.shot(p, 'exp-fog-1', { mark: '#worldmap-canvas', pad: 0, crop: 'full' });
  await clean(p);
  await ctx.shot(p, 'exp-fog-2', { mark: '#minimap, #hud-minimap, .minimap', pad: 80 });
  await ctx.done(p);
  const v = await ctx.vet();
  await isle(v);
  await v.evaluate(() => globalThis.gravetide.isle.openThing('lighthouse'));
  await sleep(1500);
  await ctx.shot(v, 'exp-fog-3', { mark: '#isle .is-card', pad: 20 });
  await clean(v);
});

scene('exp-nav', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await ctx.shot(p, 'exp-nav-3', { mark: { sel: '.dk-slot.dk-abil', text: 'C' }, pad: 120 });
  await clean(p);
});

scene('prog-levels', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await ctx.shot(p, 'prog-levels-1', { mark: '.cs-lv', pad: 120 });
  await p.evaluate(() => globalThis.gravetide.hero('hero'));
  await sleep(1500);
  await click(p, '#modal-panel [data-ctab="hero"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-levels-2', { mark: [{ sel: '#modal-panel *', text: '^Ур\\. \\d+$' }, { sel: '#modal-panel *', text: '% до уровня' }], pad: 60 });
  await ctx.shot(p, 'prog-skills-1', { mark: { sel: '#modal-panel *', text: '^(ПЕРВИЧНЫЕ НАВЫКИ|Первичные навыки)$', up: 'section, .card, div' }, pad: 40 });
  await ctx.shot(p, 'prog-skills-2', { mark: [{ sel: '#modal-panel *', text: '^Новый уровень: выберите навык' }, '#modal-panel [data-hpick]'], pad: 30 });
  await click(p, '#modal-panel [data-ctab="skills"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-skills-3', { mark: '#modal-panel [data-ctab="skills"]', pad: 220 });
  await click(p, '#modal-panel [data-ctab="hero"]');
  await sleep(1200);
  await click(p, '[data-cchip="power"]');
  await sleep(1800);
  await ctx.shot(p, 'prog-rating-1', { mark: '[data-cchip="power"]', pad: 220 });
  await ctx.shot(p, 'prog-rating-2', { mark: [{ sel: '#modal-panel *', text: '^Армия$' }, { sel: '#modal-panel *', text: '^Остров$' }], pad: 50 });
  await ctx.shot(p, 'prog-rating-3', { mark: { sel: '#modal-panel *', text: '^Самые могучие капитаны$' }, pad: 140 });
  await click(p, '#modal-panel [data-ctab="hero"]');
  await sleep(1200);
  await click(p, '[data-cchip="pvp"]');
  await sleep(1800);
  await ctx.shot(p, 'prog-pvp-1', { mark: '[data-cchip="pvp"]', pad: 220 });
  await K.reveal(p, '#modal-panel .pvp-rew, #modal-panel [class*=reward]');
  await sleep(500);
  await ctx.shot(p, 'prog-pvp-2', { mark: { sel: '#modal-panel *', text: 'Гроза морей' }, pad: 120 });
  await ctx.shot(p, 'prog-pvp-3', { mark: { sel: '#modal-panel *', text: 'очк' }, pad: 160 });
  await clean(p);
});

scene('prog-talents', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('talents'));
  await sleep(2000);
  await ctx.shot(p, 'prog-levels-3', { mark: { sel: '#modal-panel *', text: '^Свободно: \\d+' }, pad: 120 });
  await ctx.shot(p, 'prog-talents-1', { mark: ['#modal-panel [data-view="navigation"]', '#modal-panel [data-view="trade"]', '#modal-panel [data-view="command"]'], pad: 30 });
  await click(p, '#modal-panel [data-view="gunnery"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-talents-2', { mark: { sel: '#modal-panel *', text: '^(ЯРУС|Ярус) 1' }, pad: 140 });
  await ctx.shot(p, 'prog-talents-3', { mark: ['#modal-panel [data-respec="full"]', '#modal-panel [data-respec="token"]'], pad: 60 });
  await clean(p);
});

scene('prog-quests', async (ctx) => {
  // (a young captain: the board's jobs are for her level)
  const p = await ctx.fresh('Лоцман', 'navigator', ['/level 3']);
  await dock(p);
  await portTab(p, 'quests');
  await ctx.shot(p, 'prog-quests-1', { mark: ['#modal-panel [data-qchip="all"]', '#modal-panel [data-act="quest_accept"]'], pad: 40 });
  await click(p, '#modal-panel [data-qchip="contracts"]');
  await sleep(1200);
  await ctx.shot(p, 'prog-contracts-1', { mark: ['#modal-panel [data-qchip="contracts"]', '#modal-panel [data-act="contract"], #modal-panel [data-act="quest_accept"], #modal-panel [data-act="quest_tab"]'], pad: 40 });
  // take a handful: quests of this port and a contract
  // (taken as the giver's «Взять» sends it: the jobs of the board and a contract)
  await click(p, '#modal-panel [data-qchip="jobs"]');
  await sleep(800);
  await p.evaluate(() => {
    const ids = [...document.querySelectorAll('#modal-panel [data-act="quest_accept"]')].map((e) => e.dataset.id).filter((x) => /^g_/.test(x)).slice(0, 3);
    for (const id of ids) globalThis.gravetide.net.send({ t: 'quest', action: 'accept', id });
    const c = document.querySelector('#modal-panel [data-act="contract"][data-mode="accept"]');
    c?.click();
  });
  await sleep(2000);
  await click(p, '#modal-panel [data-qchip="daily"]');
  await sleep(1200);
  await ctx.shot(p, 'prog-contracts-2', { mark: ['#modal-panel [data-qchip="daily"]', { sel: '#modal-panel *', text: '^(ПОРУЧЕНИЯ ДНЯ|Поручения дня)$' }], pad: 40 });
  // the journal: grouped by the giver, with the distance and «Плыть туда»
  await clean(p);
  await say(p, '/tp 13500 86000');
  await sleep(1500);
  await p.evaluate(() => globalThis.gravetide.open('journal'));
  await sleep(1500);
  await click(p, '#modal-panel [data-jtab="quests"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-quests-2', { mark: { sel: '#modal-panel *', text: 'сдавать здесь|до него' }, pad: 120 });
  await click(p, '#modal-panel [data-jq]');
  await sleep(1200);
  await ctx.shot(p, 'prog-quests-3', { mark: '#modal-panel [data-jgo]', pad: 140 });
  await ctx.shot(p, 'prog-campaign-1', { mark: [{ sel: '#modal-panel *', text: '^Сюжет$' }, '#modal-panel [data-jq]'], pad: 60 });
  await ctx.shot(p, 'prog-contracts-3', { mark: { sel: '#modal-panel *', text: '^Ежедневные$' }, pad: 120 });
  await click(p, '#modal-panel [data-jchip="cmp"]');
  await sleep(1800);
  await ctx.shot(p, 'prog-campaign-2', { mark: { sel: '#modal-panel *', text: 'Глава' }, pad: 160 });
  await clean(p);
  await ctx.shot(p, 'prog-campaign-3', { mark: '#tc-news', pad: 160 });
  await ctx.done(p);
});

scene('prog-pass', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.seasonPass.open('tier'));
  await sleep(2000);
  await ctx.shot(p, 'prog-pass-1', { mark: ['#spass-over [data-sptrack], #spass-over .sp-track', { sel: '#spass-over *', text: 'опыта сезона' }], pad: 40 });
  await ctx.shot(p, 'prog-pass-2', { mark: { sel: '#spass-over *', text: '^(ПРЕМИУМ|Премиум)$' }, pad: 140 });
  await click(p, '#spass-over [data-sppane="ch"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-pass-3', { mark: '#spass-over [data-sppane="ch"]', pad: 200 });
  await click(p, '#spass-over [data-sppane="pass"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-pass-4', { mark: '#spass-over [data-sppane="pass"]', pad: 200 });
  await ctx.shot(p, 'prog-pass-5', { mark: { sel: '#spass-over *', text: '^До конца' }, pad: 140 });
  await clean(p);
});

scene('prog-promo', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('options'));
  await sleep(1500);
  // (the window remembers its last tab: back to the main page first)
  await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-otab]')].find((t) => t.dataset.otab !== 'promo')?.click());
  await sleep(1000);
  await ctx.shot(p, 'prog-promo-1', { mark: ['#modal-panel [data-opromo]'], pad: 160 });
  await click(p, '#modal-panel [data-opromo]');
  await sleep(1200);
  await ctx.shot(p, 'prog-promo-2', { mark: ['#modal-panel form.pcode input[name=code]', '#modal-panel .pcode-go'], pad: 60 });
  await p.evaluate(() => { const i = document.querySelector('#modal-panel form.pcode input[name=code]'); if (i) { i.value = 'MORSKOYVOLK'; i.dispatchEvent(new Event('input', { bubbles: true })); } });
  await click(p, '#modal-panel .pcode-go');
  await sleep(2000);
  await ctx.shot(p, 'prog-promo-3', { mark: '#modal-panel #pcode-res', pad: 120 });
  await clean(p);
});

scene('prog-gift', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  // (the calendar set to its fourth day: the gift's view comes with it)
  await say(p, '/gift reset', '/gift day 3');
  await sleep(1500);
  await p.evaluate(() => globalThis.gravetide.dailyGift.open(true));
  await waitFor(p, '#gift-over');
  await sleep(1500);
  await ctx.shot(p, 'prog-gift-1', { mark: '#gift-over [data-gfclaim]', pad: 200 });
  await ctx.shot(p, 'prog-gift-2', { mark: { sel: '#gift-over *', text: '^День 7' }, pad: 160 });
  await click(p, '#gift-over [data-gfclaim]');
  await sleep(2000);
  await ctx.shot(p, 'prog-gift-3', { mark: '#gift-over', pad: 10, crop: 'full' });
  await clean(p);
});

scene('prog-shop', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.shop());
  await sleep(2000);
  await ctx.shot(p, 'prog-shop-1', { mark: ['[data-shtab="sea"]', '[data-shtab="board"]', '[data-shtab="isle"]', '[data-shtab="cos"]'], pad: 30 });
  await ctx.shot(p, 'prog-shop-2', { mark: { sel: '#modal-panel *', text: '^Набор новичка$', up: '.card, .sh-card, .offer, article' }, pad: 40 });
  await click(p, '[data-shtab="board"]');
  await sleep(1500);
  await ctx.shot(p, 'prog-shop-3', { mark: '[data-shtab="board"]', pad: 220 });
  await clean(p);
});

// ─── «Вопросы капитанов» ─────────────────────────────────────────────────────────────────────────────────────────────
scene('faq-big-ships', async (ctx) => {
  const p = await ctx.vet();
  await chart(p, 'yards');
  await ctx.shot(p, 'faq-big-ships-1', { mark: ['#modal-panel [data-mlayer="yards"]'], pad: 240 });
  await clean(p);
  await dock(p, 'gravesend');
  await portTab(p, 'shipyard');
  for (let i = 0; i < 3; i++) {
    if (await p.evaluate(() => !!document.querySelector('#modal-panel [data-act="ship"]')?.getClientRects().length)) break;
    await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-fold]')].find((b) => /Все корабли/.test(b.textContent))?.click());
    await sleep(1200);
  }
  await ctx.shot(p, 'faq-big-ships-2', { mark: [{ sel: '#modal-panel [data-fold]', text: 'Все корабли' }, '#modal-panel [data-act="ship"]'], pad: 40 });
  await p.evaluate(() => [...document.querySelectorAll('#modal-panel [data-act="ship"]')].filter((b) => b.getClientRects().length).pop()?.click());
  await waitFor(p, '#confirm.k-open button');
  await sleep(800);
  await ctx.shot(p, 'faq-big-ships-3', { mark: '#confirm .confirm-panel', pad: 20 });
  await clean(p);
});

scene('faq-isle', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/town go', '/give timber 20');
  await sleep(2500);
  await isle(p);
  await ctx.shot(p, 'faq-silver-isle-1', { mark: '#isle [data-iside="haul"]', pad: 160 });
  await click(p, '#isle [data-iside="haul"]');
  await sleep(1800);
  await ctx.shot(p, 'faq-silver-isle-2', { mark: ['#isle [data-ihdep]', '#isle [data-ihall]'], pad: 60 });
  await K.reveal(p, '#isle [data-ihun]');
  await sleep(500);
  await ctx.shot(p, 'faq-silver-isle-3', { mark: ['#isle [data-ihun]', '#isle [data-ihbarge]'], pad: 30 });
  // the forge, the workshop, the anvil
  await clean(p);
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.openThing('forge'));
  await sleep(1800);
  await ctx.shot(p, 'faq-gear-1', { mark: '#isle .is-card', pad: 20 });
  await clean(p);
  await isle(p, 'town');
  await K.reveal(p, '#isle .tw-land');
  await sleep(600);
  await ctx.shot(p, 'faq-gear-2', { mark: [{ sel: '#isle .tw-land', text: 'Мастерская' }], pad: 40 });
  await K.reveal(p, '#isle .tw-forge');
  await sleep(600);
  await ctx.shot(p, 'faq-gear-3', { mark: '#isle .tw-forge', pad: 60 });
  await clean(p);
});

scene('faq-mines', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow', '/mine free', '/mine go', '/guard reset');
  await sleep(3000);
  await K.stop(p);
  await waitFor(p, '#hud-prompt .act-info');
  await sleep(1000);
  await ctx.shot(p, 'faq-mines-1', { mark: '#hud-prompt .act-info', pad: 200 });
  await say(p, '/guard beat');
  await atHand(p);
  await p.evaluate(() => globalThis.gravetide.net.send({ t: 'land' }));
  await waitFor(p, '#hud-spot:not(.hidden)', 20000);
  await sleep(2000);
  await ctx.shot(p, 'faq-mines-2', { mark: ['#hud-spot', await K.shipBox(p, 110)], pad: 40 });
  for (let i = 0; i < 40; i++) { if (!(await p.evaluate(() => !!globalThis.gravetide.state.self?.spot))) break; await sleep(1000); }
  await sleep(1200);
  await ctx.shot(p, 'faq-mines-3', { mark: [{ sel: '#toasts > .toast', text: 'флаг' }], pad: 200 });
  await clean(p);
});

scene('faq-port', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p);
  await portTab(p, 'berths');
  await ctx.shot(p, 'faq-berths-1', { mark: [{ sel: '#modal-panel *', text: '^Причал \\d+/\\d+' }, { sel: '#modal-panel *', text: '^Под вами' }], pad: 60 });
  await ctx.shot(p, 'faq-berths-2', { mark: '#modal-panel [data-act="berth_buy"]', pad: 200 });
  await ctx.shot(p, 'faq-berths-3', { mark: { sel: '#modal-panel .card', text: 'Пересесть можно' }, pad: 10 });
  // the surgeon: deckhands fallen
  await say(p, '/way fallen deckhand 24');
  await portTab(p, 'army');
  await ctx.shot(p, 'faq-resurrect-1', { mark: { sel: '#modal-panel *', text: 'Павших: \\d+' }, pad: 120 });
  await ctx.shot(p, 'faq-marines-2', { mark: { sel: '#modal-panel *', text: 'Здесь неделя за неделей' }, pad: 120 });
  await click(p, '#modal-panel [data-surgeon]');
  await sleep(1500);
  await ctx.shot(p, 'faq-resurrect-2', { mark: { sel: '#modal-panel *', text: '^Юнги ×' }, pad: 140 });
  await ctx.shot(p, 'faq-resurrect-3', { mark: { sel: '#modal-panel *', text: 'Павшие ждут сутки' }, pad: 140 });
  await clean(p);
  await hire(p);
  await click(p, '#modal-panel .rc-unit[data-rcu="marine"]');
  await sleep(800);
  await ctx.shot(p, 'faq-marines-3', { mark: ['#modal-panel .rc-unit[data-rcu="marine"]', { sel: '#modal-panel *', text: '^Койки' }], pad: 40 });
  await portTab(p, 'market');
  await ctx.shot(p, 'faq-away-1', { mark: '#modal-panel [data-act="supplies"]', pad: 160 });
  await ctx.shot(p, 'faq-away-2', { mark: { sel: '#modal-panel *', text: '^Провизия$' }, pad: 160 });
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('crew'));
  await sleep(1500);
  await ctx.shot(p, 'faq-away-3', { mark: { sel: '#modal-panel *', text: '^(ДУХ|Дух)$', up: 'div' }, pad: 120 });
  await clean(p);
  // the gift letter, again
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(process.env.QA_DB ?? 'data/qa-guide.db');
  db.prepare("UPDATE kv SET value = ? WHERE key = 'gift:2026-10-28:done'").run(JSON.stringify({ at: 9e12, n: 0 }));
  db.prepare("DELETE FROM kv WHERE key LIKE 'gift:2026-10-28:sent:%'").run();
  db.close();
  await say(p, '/gift28 send');
  for (let i = 0; i < 20; i++) {
    await p.evaluate(() => { globalThis.gravetide.open(null); globalThis.gravetide.open('journal'); });
    await sleep(1200);
    await click(p, '#modal-panel [data-jtab="letters"]');
    await sleep(1500);
    if (await p.evaluate(() => [...document.querySelectorAll('#modal-panel button')].some((b) => /^Получить/.test(b.textContent.trim()) && b.getClientRects().length))) break;
    await sleep(3000);
  }
  await ctx.shot(p, 'faq-gift-letter-1', { mark: ['#modal-panel [data-jtab="letters"]', { sel: '#modal-panel *', text: '^Бонус от команды' }], pad: 40 });
  await ctx.shot(p, 'faq-gift-letter-2', { mark: { sel: '#modal-panel button', text: '^Получить' }, pad: 140 });
  await clean(p);
  await p.evaluate(() => globalThis.gravetide.open('crew'));
  await waitFor(p, '#modal-panel [data-sk]');
  await click(p, '#modal-panel [data-sk]');
  await sleep(800);
  await ctx.shot(p, 'faq-gift-letter-3', { mark: '#modal-panel [data-op-dismiss]', pad: 140 });
  await clean(p);
});

scene('faq-lairs', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow', '/lair seal_rookery reset', '/lair seal_rookery go');
  await sleep(3000);
  await K.stop(p);
  await say(p, '/lair seal_rookery beat');
  await sleep(2000);
  await chart(p, 'lairs');
  await ctx.shot(p, 'faq-lairs-1', { mark: '#modal-panel [data-mlayer="lairs"]', pad: 260 });
  await p.evaluate(() => { const d = document.querySelector('#modal-panel details.map-legend'); if (d) d.open = true; });
  await sleep(800);
  await ctx.shot(p, 'faq-lairs-2', { mark: { sel: '#modal-panel details.map-legend *', text: 'логово тварей' }, pad: 80 });
  await p.evaluate(() => { const d = document.querySelector('#modal-panel details.map-legend'); if (d) d.open = false; });
  await say(p, '/lair seal_rookery reset');
  await clean(p);
  await sleep(1500);
  await click(p, '.act-btn.act-look');
  await sleep(1800);
  await ctx.shot(p, 'faq-lairs-3', { mark: ['#advcard', await K.shipBox(p, 110)], pad: 40 });
  await clean(p);
});

scene('faq-ferry', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await dock(p, 'gravesend');
  await portTab(p, 'ferry');
  await ctx.shot(p, 'faq-ferry-1', { mark: ['#modal-panel [data-ptab="ferry"]', { sel: '#modal-panel *', text: 'Сначала откройте' }], pad: 40 });
  await ctx.shot(p, 'faq-ferry-2', { mark: { sel: '#modal-panel .card', text: '' }, pad: 10 });
  await chart(p, 'ports');
  await ctx.shot(p, 'faq-ferry-3', { mark: '#modal-panel [data-mlayer="ports"]', pad: 260 });
  await clean(p);
});

scene('faq-logout', async (ctx) => {
  const p = await ctx.vet();
  await clean(p);
  await say(p, '/tp saltmarrow');
  await sleep(1500);
  const me = await L.me(p);
  await tp(p, me.x + 500, me.y - 500);
  await click(p, '#tc-menu, #tc-more, [data-tc="more"]');
  await sleep(1000);
  await ctx.shot(p, 'faq-logout-1', { mark: '#tc-exit', pad: 140 });
  await click(p, '#tc-exit');
  await sleep(2500);
  await ctx.shot(p, 'faq-logout-2', { mark: '.ex-t', pad: 120 });
  await ctx.shot(p, 'faq-logout-3', { mark: ['.ex-t', '.ex-x', await K.shipBox(p, 110)], pad: 40 });
  // called off before the time is up
  await click(p, '.ex-x');
  await sleep(1000);
  await clean(p);
});

scene('faq-marines', async (ctx) => {
  // a young captain's barracks under way: «осталось …»
  const p = await ctx.fresh('Новичок', 'corsair', ['/level 5', '/silver 3000']);
  if (!(await claimSpot(p))) throw new Error('no claimable shore');
  await click(p, '.act-btn.act-claim');
  await waitFor(p, '[data-est="claim"]');
  await click(p, '[data-est="claim"]');
  await sleep(1200);
  await clickText(p, '^Подтвердить$');
  await sleep(4000);
  await isle(p);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw1'));
  await sleep(1500);
  await click(p, '#isle .is-card [data-tbuild="dw1"]');
  await sleep(1500);
  await say(p, '/build finish');
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await click(p, '#isle .is-card [data-tbuild="dw2"]');
  await sleep(2000);
  await p.evaluate(() => globalThis.gravetide.isle.showTown('dw2'));
  await sleep(1500);
  await ctx.shot(p, 'faq-marines-1', { mark: ['#isle .is-card', '#isle .is-queue [data-qtown]'], pad: 20 });
  await ctx.done(p);
});

scene('isle-gear', async (ctx) => {
  // the gear window at a rank-4 yard (Port Gravesend): a piece's card with its tempering and the reforge — last of all,
  // as /kit build dresses the seasoned captain in a full kit (and changes her talents)
  const p = await ctx.vet();
  await clean(p);
  await dock(p, 'gravesend');
  await say(p, '/kit build');
  await sleep(2500);
  await p.evaluate(() => globalThis.gravetide.hero('gear'));
  await sleep(2000);
  await click(p, '#modal-panel [data-gslot="coat"]');
  await sleep(1500);
  await ctx.shot(p, 'isle-forge-2', { mark: [{ sel: '.gear-detail *', text: 'закалка' }, { sel: '.gear-detail *', text: '^(Перековать|Закалить)' }], pad: 40 });
  await clean(p);
});

// ─── the run
export async function makeCtx(b, port) {
  const ctx = {
    b, port, made: [], fails: [],
    async fresh(name = 'Лоцман', captain = 'navigator', cmds = []) { return K.captain(b, port, { name, captain, cmds }); },
    /** Her window closed (a browser holds at most the seasoned captain and one more). */
    async done(p) { if (p && p !== ctx._vet) await p.ctx.close().catch(() => {}); },
    async vet() {
      if (ctx._vet) return ctx._vet;
      const p = await K.captain(b, port, { name: 'Капитан', captain: 'navigator', cmds: ['/level 20', '/silver 500000', '/doubloons 20000', '/ship frigate 6', '/isle 5', '/town 2', '/dwell fill', '/yard 300'] });
      ctx._vet = p;
      return p;
    },
    async shot(p, file, opts) {
      try {
        const kb = await shot(p, file, opts);
        ctx.made.push(file);
        L.log('shot', file, `${kb} KB`);
      } catch (e) {
        ctx.fails.push(`${file}: ${e.message.split('\n')[0]}`);
        L.log('FAIL', file, e.message.split('\n')[0]);
      }
    },
  };
  return ctx;
}

async function main() {
  const port = Number(process.env.GPORT ?? 58820);
  const only = (process.env.ONLY ?? '').split(',').filter(Boolean);
  const b = await K.browser(port);
  const ctx = await makeCtx(b, port);
  try {
    for (const s of SCENES) {
      if (only.length && !only.some((o) => s.id.startsWith(o))) continue;
      L.log('scene', s.id);
      try { await s.run(ctx); } catch (e) { ctx.fails.push(`${s.id}: ${e.message.split('\n')[0]}`); L.log('SCENE FAIL', s.id, e.message.split('\n')[0]); }
    }
  } finally {
    await b.close();
  }
  // every slide's image there?
  const want = [];
  for (const f of ['island', 'army', 'explore', 'progress', 'faq']) {
    const { ARTICLES } = await import(pathToFileURL(`shared/src/data/guide/${f}.ts`).href);
    for (const a of ARTICLES) for (const s of a.slides) if (s.img) want.push(s.img.includes('/') ? s.img : `${K.OUT}/${s.img}`);
  }
  const missing = want.filter((x) => !existsSync(x));
  L.log(`made ${ctx.made.length}, failed ${ctx.fails.length}, missing ${missing.length}`);
  for (const f of ctx.fails) L.log('  fail', f);
  for (const m of missing) L.log('  missing', m);
  process.exitCode = ctx.fails.length || missing.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
export { dock, portTab, hire, isle, tag };
