// The flags' slides (shared/src/data/guide/flags.ts).
export async function FLAGS(p, K, { captain }) {
  const { say, sleep, clean, wait, click, open, tab, dock, toSea, shot, L } = K;
  await say(p, '/level 20', 300);
  await dock(p, 'gravesend');
  await open(p, 'port', 1500);
  await tab(p, 'colours', 1500);
  await shot(p, 'flags-three-1', { mark: '.fl-opts', full: true });
  await shot(p, 'flags-three-2', { mark: '.fl-opt[data-colours="neutral"]', focus: '.fl-opts', min: 700 });
  await shot(p, 'flags-three-3', { mark: '.fl-opt[data-colours="faction"]', focus: '.fl-opts', min: 700 });
  await shot(p, 'flags-three-4', { mark: '.fl-opt[data-colours="pirate"]', focus: '.fl-opts', min: 700 });
  // the patent: under the city's flag
  await p.evaluate(() => document.querySelector('.fl-pat')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-patent-1', { mark: '.fl-pat', full: true });
  await shot(p, 'flags-patent-2', { mark: '.fl-pat [data-patent], .fl-pat-buy', focus: '.fl-pat', min: 700 });
  await click(p, '.fl-pat [data-patent]'); await sleep(1800);
  await p.evaluate(() => document.querySelector('.fl-pat')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-patent-3', { mark: '.fl-pat', focus: '.fl-pat', min: 760 });
  // «Абордаж: выкл.»: idle under the city's flag, then neutral
  await p.evaluate(() => document.querySelector('.fl-board')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-noboard-2', { mark: '.fl-board', focus: '.fl-board', min: 700 });
  await say(p, '/flag neutral', 1200);
  await open(p, 'port', 1200); await tab(p, 'colours', 1200);
  await p.evaluate(() => document.querySelector('.fl-board')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-noboard-1', { mark: '.fl-board', full: true });
  await click(p, '.fl-board[data-noboard]'); await sleep(1200);
  await shot(p, 'flags-noboard-3', { mark: '.fl-board', focus: '.fl-board', min: 700 });
  await click(p, '.fl-board[data-noboard]'); await sleep(600);
  // the flag going up: the order and its minute
  await say(p, '/flag faction', 1000);
  await open(p, 'port', 1200); await tab(p, 'colours', 1200);
  await click(p, '.fl-opt[data-colours="neutral"]'); await sleep(1500);
  await shot(p, 'flags-three-5', { mark: '.fl-opt[data-colours="neutral"]', focus: '.fl-opts', min: 700 });
  // the skulls: the card locked
  await say(p, '/flag pirate', 600);
  await say(p, '/skulls 2', 1200);
  await open(p, 'port', 1200); await tab(p, 'colours', 1200);
  await shot(p, 'flags-skulls-2', { mark: '.fl-card', full: true });
  // PvP: the captain's window
  await say(p, '/pvprank add 140 3', 1000);
  await p.evaluate(() => globalThis.gravetide.open(null));
  await p.evaluate(() => globalThis.gravetide.hero()); await sleep(1500);
  await click(p, '[data-ctab="hero"]'); await sleep(800);
  await click(p, '[data-cchip="pvp"]'); await sleep(1500);
  await shot(p, 'flags-pvp-1', { mark: '[data-cchip="pvp"]', full: true });
  await shot(p, 'flags-pvp-2', { mark: '#modal-panel .modal-body', full: true });
  await p.evaluate(() => { const b = document.querySelector('#modal-panel .modal-body'); if (b) b.scrollTop = b.scrollHeight; }); await sleep(700);
  await shot(p, 'flags-pvp-3', { mark: '#modal-panel .modal-body', full: true });
  await p.evaluate(() => globalThis.gravetide.open(null));
  // at sea with two skulls: the HUD's badge; the nameplates
  await toSea(p, 'gravesend', 3000);
  await shot(p, 'flags-skulls-1', { mark: '#hud-captain .cs-law', focus: '#hud-captain', min: 560 });
  // a second captain alongside: blue; with skulls: red
  const d = await captain('ru', 18);
  try {
    await toSea(d, 'gravesend', 2000);
    const me = await K.L.me(p);
    await say(d, `/tp ${Math.round(me.x + 120)} ${Math.round(me.y + 40)}`, 3000);
    await clean(d);
    await p.evaluate(() => { const r = globalThis.gravetide.renderer; r.userZoomed = true; r.targetZoom = r.seenZoom = 1.3; });
    await sleep(2500);
    const box = async () => p.evaluate((nm) => {
      const st = globalThis.gravetide.state;
      for (const s of st.ships.values()) if (s.info?.captainName === nm || s.info?.name === nm) { const t = globalThis.gravetide.aim.choices(`ship:${s.id}`); if (t) return [t.x - 90, t.y - t.r - 46, 180, t.r + 70]; }
      return null;
    }, d.name);
    await shot(p, 'flags-names-1', { mark: await box(), min: 640 });
    await say(d, '/flag pirate', 600);
    await say(d, '/skulls 1', 2500);
    await shot(p, 'flags-names-2', { mark: await box(), min: 640 });
    // her own view: the pirate's level hidden — seen from the other ship
    await say(d, '/skulls 0', 2500);
    await shot(p, 'flags-names-3', { mark: await box(), min: 640 });
  } finally { await d.ctx.close().catch(() => {}); }
  // the wash: a pardon in a pirate haven
  await dock(p, 'tidewrack');
  await open(p, 'port', 1500); await tab(p, 'colours', 1500);
  await p.evaluate(() => document.querySelector('[data-pardon]')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-skulls-3', { mark: '[data-pardon], .fl-pardon', full: true });
  await tab(p, 'harbour', 1500);
  await p.evaluate(() => document.querySelector('[data-act="pardon"]')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'flags-skulls-4', { mark: '[data-act="pardon"]', full: true });
  await say(p, '/skulls 0', 300); await say(p, '/flag faction', 300);
}
