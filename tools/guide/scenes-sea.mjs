// The sea's slides (shared/src/data/guide/sea2.ts).
export async function SEA(p, K, { captain }) {
  const { say, sleep, clean, wait, click, open, tab, dock, toSea, shot, zoom, L } = K;
  await toSea(p, 'gravesend');
  await say(p, '/weather breeze', 400);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 3; });
  await wait(p, () => (globalThis.gravetide.state.you?.spd ?? 0) > 3, 30000);
  await sleep(2000);
  await clean(p);
  // sea-helm
  await shot(p, 'sea-helm-1', { mark: '#tc-stick', min: 520 });
  await shot(p, 'sea-helm-2', { mark: '#tc-sail', focus: ['#tc-stick', '#tc-sail'], min: 520 });
  await shot(p, 'sea-helm-3', { mark: '#tc-speed', focus: '#tc-stick', min: 520 });
  // the keys: the settings' «Управление» on a desk screen
  {
    const d = await K.L.page(p.ctx.browser(), [K.W, K.H], { lang: 'ru', touch: false });
    d.setDefaultTimeout(180000);
    await K.login(d);
    await K.prep(d);
    await clean(d);
    await open(d, 'options');
    await click(d, '[data-omore]'); await sleep(600);
    await click(d, '[data-otab="controls"]'); await sleep(900);
    await shot(d, 'sea-helm-4', { mark: '#modal-panel .modal-body', full: true });
    // the chart on the desk: a click sets the mark, «Плыть туда»
    await d.evaluate(() => globalThis.gravetide.open(null));
    await open(d, 'map', 2500);
    await d.mouse.click(K.W / 2 + 120, K.H / 2 - 40); await sleep(900);
    await shot(d, 'sea-autosail-2', { mark: '.map-wp-sail', full: true });
    await d.ctx.close();
  }
  // sea-autosail: a tap on the open sea, the course, the pill
  await zoom(p, 0.8);
  await p.touchscreen.tap(K.W / 2 + 260, K.H / 2 - 150); await sleep(2500);
  await clean(p);
  await p.touchscreen.tap(K.W / 2 + 260, K.H / 2 - 150); await sleep(2500);
  L.log('  autosail', await p.evaluate(() => !!globalThis.gravetide.state.autosail));
  await shot(p, 'sea-autosail-1', { mark: '#hud-autosail', full: true });
  await shot(p, 'sea-autosail-3', { mark: '#tc-stick', focus: ['#tc-stick', '#hud-autosail'], min: 700 });
  await click(p, '#hud-autosail button, #hud-autosail [data-stop]'); await sleep(800);
  // sea-chart
  await open(p, 'map', 2500);
  await shot(p, 'sea-chart-1', { mark: '[data-mlayer]', full: true });
  await p.evaluate(() => { const c = document.querySelectorAll('[data-mlayer]'); const r = [...c].map((e) => e.getBoundingClientRect()); window.__ml = r.length ? [Math.min(...r.map((x) => x.left)), Math.min(...r.map((x) => x.top)), Math.max(...r.map((x) => x.right)) - Math.min(...r.map((x) => x.left)), Math.max(...r.map((x) => x.bottom)) - Math.min(...r.map((x) => x.top))] : null; });
  const ml = await p.evaluate(() => window.__ml);
  if (ml) await shot(p, 'sea-chart-1', { mark: ml, full: true });
  await click(p, '[data-mwhere]'); await sleep(2200);
  await shot(p, 'sea-chart-2', { mark: '[data-mwhere]', full: true });
  await p.evaluate(() => globalThis.gravetide.open(null)); await sleep(500);
  await clean(p);
  await shot(p, 'sea-chart-3', { mark: '#hud-map', min: 560 });
  // sea-wind: running before the wind
  await say(p, '/weather wind', 300);
  await say(p, '/heading wind', 2500);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 4; });
  await sleep(3000); await clean(p);
  await shot(p, 'sea-wind-1', { mark: '#hud-map', min: 560 });
  await shot(p, 'sea-wind-2', { mark: '#tc-speed', focus: '#tc-stick', min: 520 });
  // the currents: on the chart, under «Всё»
  await open(p, 'map', 2000);
  await click(p, '[data-mlayer="all"]'); await sleep(600);
  for (let i = 0; i < 5; i++) { await p.mouse.move(K.W / 2, K.H / 2 - 60); await p.mouse.wheel(0, 400); await sleep(250); }
  await sleep(1500);
  await shot(p, 'sea-wind-3', { mark: '#worldmap-canvas', full: true });
  await clean(p);
  // sea-storm
  await clean(p);
  await L.say(p, '/weather storm');
  await wait(p, () => [...document.querySelectorAll('.toast')].some((t) => /Шторм/.test(t.textContent)), 25000);
  await sleep(300);
  await p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => { if (!/Шторм/.test(t.textContent)) t.remove(); else t.classList.add('__g'); }));
  await shot(p, 'sea-storm-1', { mark: '.toast.__g', full: true });
  await clean(p);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 3; });
  await sleep(1200);
  await shot(p, 'sea-storm-2', { mark: '#tc-sail', focus: ['#tc-stick', '#tc-sail'], min: 520 });
  await say(p, '/weather breeze', 300);
  await say(p, '/god off', 300);
  await say(p, '/adrift 8', 2500);
  await clean(p);
  await shot(p, 'sea-storm-3', { mark: '#tc-actrow [data-act="jury"]', min: 640 });
  await click(p, '#tc-actrow [data-act="jury"]'); await sleep(2500);
  await shot(p, 'sea-storm-4', { mark: '#hud-captain .cs-sails', focus: '#hud-captain', min: 560 });
  await say(p, '/heal', 800);
  // sea-repair
  await say(p, '/god off', 300);
  await say(p, '/hurt 45', 1500); await clean(p);
  await shot(p, 'sea-repair-1', { mark: '#hud-captain', min: 560 });
  await shot(p, 'sea-repair-2', { mark: '#tc-actrow [data-act="repair"]', min: 640 });
  // sea-hold
  await say(p, '/heal', 600);
  await shot(p, 'sea-hold-1', { mark: '#hud-captain .cs-hold', focus: '#hud-captain', min: 560 });
  await say(p, '/god on', 300);
  for (let i = 0; i < 30 && !(await p.evaluate(() => globalThis.gravetide.state.self?.hold?.over)); i++) await say(p, '/give rum 6', 700);
  await sleep(1500); await clean(p);
  await shot(p, 'sea-hold-2', { mark: '#hud-captain .cs-hold', focus: '#hud-captain', min: 560 });
  await shot(p, 'sea-hold-3', { mark: '#hud-fx', focus: '#hud-captain', min: 560 });
  // sea-crew
  await say(p, '/morale 22', 1500); await clean(p);
  await shot(p, 'sea-crew-2', { mark: '#hud-fx', focus: '#hud-captain', min: 600 });
  await open(p, 'crew', 1800);
  await shot(p, 'sea-crew-1', { mark: '#modal-panel', full: true });
  await say(p, '/morale 70', 600);
  // sea-exit
  await clean(p); await sleep(1500);
  await click(p, '#tc-more'); await sleep(1200);
  await shot(p, 'sea-exit-1', { mark: '#tc-exit', min: 560 });
  await click(p, '#tc-exit'); await sleep(2500);
  await shot(p, 'sea-exit-2', { mark: '#hud-exit', full: true });
  // in port: the stores, the hold sold, the yard's repair, the tavern
  await click(p, '#hud-exit button'); await sleep(600);
  await dock(p, 'gravesend');
  await say(p, '/god off', 300);
  await say(p, '/hurt 60', 900);
  await say(p, '/god on', 300);
  await open(p, 'port', 1500); await tab(p, 'market', 1500);
  await p.evaluate(() => document.querySelector('.mk-row.mk-store')?.scrollIntoView({ block: 'center' })); await sleep(600);
  await shot(p, 'sea-stores-1', { mark: '.mk-row.mk-store', full: true });
  await p.evaluate(() => document.querySelector('.mk-row.mk-store .mk-nosell')?.scrollIntoView({ block: 'center' })); await sleep(400);
  await shot(p, 'sea-stores-2', { mark: '.mk-row.mk-store .mk-nosell', full: true });
  await p.evaluate(() => document.querySelector('.mk-row[data-good="provisions"]')?.scrollIntoView({ block: 'center' })); await sleep(400);
  await shot(p, 'sea-stores-4', { mark: '.mk-row[data-good="provisions"] .w-row-t', focus: '.mk-row[data-good="provisions"]', min: 760 });
  await p.evaluate(() => document.querySelector('.mk-row[data-good="rum"]')?.scrollIntoView({ block: 'center' })); await sleep(400);
  await shot(p, 'sea-hold-4', { mark: '.mk-row[data-good="rum"] [data-act="sell"]', full: true });
  await tab(p, 'shipyard', 1500);
  await shot(p, 'sea-repair-3', { mark: '[data-act="repair"]', full: true });
  await tab(p, 'tavern', 1500);
  await shot(p, 'sea-crew-3', { mark: '#modal-panel .modal-body', full: true });
  // casting off short of something: the window of what to top up
  await tab(p, 'sea', 2000);
  await shot(p, 'sea-stores-3', { mark: '.depart-panel', full: true });
  await K.clickText(p, /^Остаться/); await sleep(600);
  await say(p, '/heal', 600);
  await p.evaluate(() => globalThis.gravetide.open(null));
  await say(p, '/tp gravesend', 2500); await clean(p);
  // sea-fx: the effects row
  await say(p, '/fx all', 1500); await clean(p);
  await shot(p, 'sea-fx-1', { mark: '#hud-fx', focus: '#hud-captain', min: 600 });
  await click(p, '#hud-fx .fx-i'); await sleep(1200);
  await shot(p, 'sea-fx-2', { mark: '#detail .dc-card', full: true });
  await clean(p);
  await click(p, '#hud-fx .fx-more'); await sleep(1200);
  await shot(p, 'sea-fx-3', { mark: '#detail .dc-card', full: true });
  await clean(p);
  // leaving for good: the 30 s, then the screen
  await click(p, '#tc-more'); await sleep(800);
  await click(p, '#tc-exit');
  await wait(p, () => !!document.querySelector('#screen-exit:not(.hidden)'), 60000);
  await sleep(1500);
  await shot(p, 'sea-exit-3', { mark: '#screen-exit button, #screen-exit .btn', full: true });
}
