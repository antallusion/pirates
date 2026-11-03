// The travel's slides (shared/src/data/guide/travel.ts).
export async function TRAVEL(p, K) {
  const { say, sleep, clean, wait, click, open, tab, dock, toSea, shot, L } = K;
  await say(p, '/level 20', 300);
  await say(p, '/fog all', 1500);
  // «Найти врага» and «К острову»: the tray
  await toSea(p, 'gravesend', 3000);
  await click(p, '#tc-more'); await sleep(900);
  await shot(p, 'travel-foe-1', { mark: '#tc-foe', min: 560 });
  await shot(p, 'travel-home-1', { mark: '#tc-gohome', min: 560 });
  await click(p, '#tc-foe'); await sleep(1800);
  await shot(p, 'travel-foe-2', { mark: '#foefind .ff-card, #foefind', full: true });
  await shot(p, 'travel-foe-3', { mark: '#foefind [data-ffs]', focus: '#foefind', min: 760 });
  await click(p, '#foefind [data-ffgo]'); await sleep(2000);
  await shot(p, 'travel-foe-4', { mark: '#hud-autosail', full: true });
  await clean(p);
  await click(p, '#hud-autosail button'); await sleep(500);
  await click(p, '#tc-more'); await sleep(700);
  await click(p, '#tc-gohome'); await sleep(2500);
  await shot(p, 'travel-home-2', { mark: '#hud-autosail', full: true });
  await clean(p);
  await click(p, '#hud-autosail button'); await sleep(500);
  await open(p, 'map', 2500);
  await shot(p, 'travel-home-3', { mark: '[data-mhome]', full: true });
  await clean(p);
  // the passage: the list in a hub
  await dock(p, 'gravesend');
  await open(p, 'port', 1500);
  await tab(p, 'ferry', 1800);
  await shot(p, 'travel-ferry-1', { mark: '[data-ptab="ferry"]', full: true });
  await shot(p, 'travel-ferry-2', { mark: '.fy-row', focus: '.fy-row', min: 760 });
  await shot(p, 'travel-ferry-3', { mark: '.fy-go', focus: '.fy-row', min: 760 });
  // the quest's quarter
  await say(p, '/fquest hollowmere', 1500);
  await dock(p, 'gravesend');
  await open(p, 'port', 1200); await tab(p, 'ferry', 1500);
  await shot(p, 'travel-rules-2', { mark: '[data-ferry="hollowmere"]', focus: '[data-ferry="hollowmere"]', min: 760 });
  // the pirate's double
  await say(p, '/flag pirate', 1000);
  await dock(p, 'gravesend');
  await open(p, 'port', 1200); await tab(p, 'ferry', 1500);
  await shot(p, 'travel-rules-1', { mark: '.fy-row', focus: '.fy-row', min: 760 });
  await say(p, '/flag faction', 600);
  await dock(p, 'gravesend');
  // the hold over 60 %
  await say(p, '/give rum 40', 1200);
  await open(p, 'port', 1200); await tab(p, 'ferry', 1500);
  await click(p, '.fy-go'); await sleep(1500);
  await shot(p, 'travel-rules-3', { mark: '.toast, .fy-st', full: true });
  await say(p, '/give rum -40', 800);
  await K.L.send(p, { t: 'trade', good: 'rum', qty: -40 }); await sleep(1200);
  // the trip itself: to the nearest hub
  await open(p, 'port', 1200); await tab(p, 'ferry', 1500);
  const to = await p.evaluate(() => { const r = [...document.querySelectorAll('[data-ferry]')].filter((b) => !b.disabled); r.sort((a, b) => parseInt(a.textContent.replace(/\D/g, '')) - parseInt(b.textContent.replace(/\D/g, ''))); return r[0]?.dataset.ferry ?? null; });
  L.log('  ferry to', to);
  if (to) {
    await click(p, `[data-ferry="${to}"]`);
    await wait(p, () => !!globalThis.gravetide.state.voyage, 30000);
    await sleep(3000); await K.dismiss(p);
    await shot(p, 'travel-ferry-4', { mark: '#hud-voyage', full: true });
    await wait(p, () => !globalThis.gravetide.state.voyage, 900000);
    await wait(p, (i) => globalThis.gravetide.state.self?.dockedAt === i, 120000, to);
    await sleep(2500); await K.dismiss(p);
    await open(p, 'port', 1500); await tab(p, 'ferry', 1500);
    await shot(p, 'travel-rules-4', { mark: '.fy-st', full: true });
    await p.evaluate(() => globalThis.gravetide.open(null));
    // out to sea: the quiet harbour's ring and its ward
    await K.L.send(p, { t: 'undock' }); await sleep(4000); await clean(p);
    await shot(p, 'travel-haven-2', { mark: '#hud-fx', focus: '#hud-captain', min: 600 });
  }
  await open(p, 'map', 2500);
  await click(p, '[data-mwhere]'); await sleep(2500);
  await shot(p, 'travel-haven-1', { mark: '#worldmap-canvas', full: true });
  await clean(p);
}
