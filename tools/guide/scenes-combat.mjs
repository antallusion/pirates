// The combat's slides (shared/src/data/guide/combat.ts).
export async function COMBAT(p, K, { captain }) {
  const { say, sleep, clean, wait, click, open, toSea, shot, nearest, zoom, L } = K;
  const tac = (q) => q.evaluate(() => globalThis.gravetide.state.boardTac ?? null);
  // the ring as a finger opens it: a tap on her (the sea's own loop keeps it up then)
  const ring = async (q, i) => {
    await q.evaluate(() => globalThis.gravetide.aim.menu.hide());
    const t = await q.evaluate((k) => globalThis.gravetide.aim.choices(`ship:${k}`), i);
    if (!t || t.x < 0 || t.y < 0 || t.x > K.W || t.y > K.H) { L.log('  ring: off screen', JSON.stringify(t && [t.x, t.y])); return null; }
    await q.touchscreen.tap(t.x, t.y);
    await sleep(900);
    return t.choices.map((c) => c.label);
  };
  await say(p, '/level 20', 300);
  await say(p, '/army level 4', 300);
  await toSea(p, 'gravewater', 3000);
  await say(p, '/ammo', 300);
  await p.evaluate(() => { globalThis.gravetide.state.input.sail = 0; });
  await say(p, '/foe pirate brig 230', 1800);
  await clean(p);
  let id = await nearest(p, (s) => s.info.npcRole === 'pirate');
  L.log('  pirate', id);
  await zoom(p, 1.1);
  await sleep(800);
  // combat-ring: the ring about a ship
  L.log('  ring', JSON.stringify(await ring(p, id)));
  await sleep(700);
  await shot(p, 'combat-ring-1', { mark: '#tmenu .tm-item, #tmenu .tm-extra', min: 640 });
  await shot(p, 'combat-ring-2', { mark: '#tmenu .tm-extra', focus: '#tmenu .tm-item, #tmenu .tm-extra', min: 640 });
  await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
  // the detail card (ⓘ)
  await p.evaluate((i) => globalThis.gravetide.target(i), id); await sleep(500);
  await ring(p, id); await sleep(500);
  await click(p, '#tmenu .tm-extra'); await sleep(1500);
  await shot(p, 'combat-ring-3', { mark: '#detail .dc-card', full: true });
  await shot(p, 'combat-ring-4', { mark: '#detail .dc-card .dc-bars, #detail .dc-card [class*="bar"]', focus: '#detail .dc-card', min: 640 });
  await shot(p, 'combat-ring-5', { mark: '#detail [data-dcact]', focus: '#detail .dc-card', min: 640 });
  await clean(p);
  // combat-attack: «Атаковать» — guns, keep the distance
  await ring(p, id); await sleep(500);
  await shot(p, 'combat-attack-1', { mark: '#tmenu .tm-item[data-tm="fight"]', focus: '#tmenu .tm-item, #tmenu .tm-extra', min: 640 });
  await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
  await p.evaluate((i) => globalThis.gravetide.target(i), id);
  await K.L.send(p, { t: 'attack', target: id, mode: 'guns' });
  await sleep(3500); await K.dismiss(p);
  await shot(p, 'combat-attack-2', { mark: '#tc-actrow', min: 700 });
  await shot(p, 'combat-range-1', { mark: '#tc-target', min: 640 });
  {
    const t = await p.evaluate((i) => { const c = globalThis.gravetide.aim.choices(`ship:${i}`); return c ? [c.x - c.r - 10, c.y - c.r - 10, 2 * c.r + 20, 2 * c.r + 20] : null; }, id);
    await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
    await shot(p, 'combat-range-3', { mark: t, full: true });
  }
  await shot(p, 'combat-ammo-1', { mark: '#tc-ammo', focus: ['#tc-ammo', '#tc-fire'], min: 560 });
  await shot(p, 'combat-ammo-3', { mark: '#tc-fire', focus: ['#tc-ammo', '#tc-fire'], min: 560 });
  // the ammo wheel: a hold on the shot
  await K.hold(p, '#tc-ammo'); await sleep(1500);
  await shot(p, 'combat-ammo-2', { mark: '.k-wheel:not(.hidden) .k-wheel-item', full: true });
  await K.release(p); await sleep(600);
  await click(p, '#tc-actrow [data-act="attack_mode"]'); await sleep(2500);
  await shot(p, 'combat-attack-3', { mark: '#tc-actrow [data-act="attack_mode"]', focus: '#tc-actrow', min: 700 });
  await click(p, '#tc-actrow [data-act="attack_mode"]'); await sleep(1500);
  await shot(p, 'combat-attack-4', { mark: '#tc-actrow [data-act="attack_stop"]', focus: '#tc-actrow', min: 700 });
  await click(p, '#tc-actrow [data-act="attack_stop"]'); await sleep(800);
  // ranges: a long gun's reach on the card
  await p.evaluate((i) => globalThis.gravetide.target(i), id); await sleep(500);
  await ring(p, id); await sleep(400); await click(p, '#tmenu .tm-extra'); await sleep(1500);
  await shot(p, 'combat-range-2', { mark: '#detail .dc-card', full: true });
  await clean(p);
  // combat-boarding: within 100 m — «На абордаж»
  await say(p, '/scrolls 3', 300);
  await say(p, '/foe pirate sloop 60', 1800); await clean(p);
  const id2 = await p.evaluate(() => { const st = globalThis.gravetide.state, o = st.ownDisplay; let best = null, bd = 1e9; for (const s of st.ships.values()) { if (!s.info || s.id === st.entityId || s.info.npcRole !== 'pirate' || s.info.cls !== 'sloop' && false) continue; const d = Math.hypot(s.cur.x - o.x, s.cur.y - o.y); if (d < bd) { bd = d; best = s.id; } } return best; });
  L.log('  ring near', JSON.stringify(await ring(p, id2))); await sleep(600);
  await shot(p, 'combat-boarding-1', { mark: '#tmenu .tm-item[data-tm="board"]', focus: '#tmenu .tm-item, #tmenu .tm-extra', min: 640 });
  await p.evaluate(() => globalThis.gravetide.aim.menu.hide());
  await p.evaluate((i) => globalThis.gravetide.target(i), id2); await sleep(600);
  await shot(p, 'combat-boarding-2', { mark: '#tc-target .tg-odds, #tc-target', focus: '#tc-target', min: 640 });
  await K.L.send(p, { t: 'attack', target: id2, mode: 'board' });
  await wait(p, () => [...document.querySelectorAll('.toast')].some((t) => /Кошки/.test(t.textContent)) || !!document.querySelector('.risk, #risk, .k-risk'), 8000);
  await shot(p, 'combat-boarding-3', { mark: '.toast, .risk, #risk', full: true });
  await K.clickText(p, /^Рискнуть/);
  // the hex battle
  await wait(p, () => !!globalThis.gravetide.state.boardTac, 60000);
  await sleep(4000); await K.dismiss(p);
  await shot(p, 'combat-hex-1', { mark: '.tb-top', full: true });
  await click(p, '.tb-rb.ready');
  await wait(p, () => { const t = globalThis.gravetide.state.boardTac; return t && !t.deploy && t.mine; }, 90000);
  await sleep(2500);
  const queue = await p.evaluate(() => { const rs = [...document.querySelectorAll('.tb-root *')].map((e) => e.getBoundingClientRect()).filter((r) => r.top < 30 && r.height > 14 && r.height < 36 && r.width < 40 && r.left > 120 && r.right < innerWidth - 120); if (!rs.length) return null; const x0 = Math.min(...rs.map((r) => r.left)), x1 = Math.max(...rs.map((r) => r.right)), y0 = Math.min(...rs.map((r) => r.top)), y1 = Math.max(...rs.map((r) => r.bottom)); return [x0, y0, x1 - x0, y1 - y0]; });
  await shot(p, 'combat-hex-2', { mark: queue ?? '.tb-top', min: 760 });
  const pos = (i) => p.evaluate((k) => { const ui = globalThis.gravetide.tactical, c = document.querySelector('.tb-board').getBoundingClientRect(), q = ui.center(k); return [c.left + q.x, c.top + q.y]; }, i);
  const v = await tac(p);
  if (v) {
    const my = v.stacks.find((x) => x.id === v.active) ?? v.stacks[0];
    const foes = v.stacks.filter((x) => x.side !== my.side && x.count > 0);
    const foe = foes.find((x) => x.shots > 0) ?? foes[0];
    const melee = foes.find((x) => !x.shots) ?? foes[0];
    if (melee) {
      const [x, y] = await pos(melee.hex);
      await p.touchscreen.tap(x, y); await sleep(1500);
      await shot(p, 'combat-hex-3', { mark: [x - 45, y - 75, 90, 100], full: true });
    }
    if (foe) {
      await p.evaluate((i) => globalThis.gravetide.tactical.showInfo(i), foe.id); await sleep(1200);
      await shot(p, 'combat-hex-4', { mark: '.tb-card:not(.hidden), .tb-cardk', full: true });
    }
    await p.evaluate(() => globalThis.gravetide.tactical.showInfo(null)); await sleep(600);
    await p.evaluate((i) => globalThis.gravetide.tactical.showInfo(i), my.id); await sleep(1200);
    await shot(p, 'combat-hexrules-3', { mark: '.tb-card:not(.hidden), .tb-cardk', full: true });
    await p.evaluate(() => globalThis.gravetide.tactical.showInfo(null)); await sleep(600);
    const [mx, my2] = await pos(my.hex);
    await shot(p, 'combat-hexrules-2', { mark: [mx - 45, my2 - 75, 90, 100], full: true });
  }
  await shot(p, 'combat-hexrules-1', { mark: '.tb-top', full: true });
  await shot(p, 'combat-auto-1', { mark: '.tb-rb[data-autow]', min: 560 });
  await K.hold(p, '.tb-rb[data-autow]'); await sleep(1500);
  await shot(p, 'combat-auto-2', { mark: '.k-wheel:not(.hidden) .k-wheel-item', full: true });
  await K.release(p); await sleep(600);
  await click(p, '.tb-rb.book'); await sleep(1800);
  await shot(p, 'combat-auto-3', { mark: '.tb-bookk, .tb-book', full: true });
  await p.ctx.close();

  // a fresh captain for the struck pirate and the beasts
  const q = await captain('ru', 20);
  try {
    await toSea(q, 'gravewater', 3000);
    await q.evaluate(() => { globalThis.gravetide.state.input.sail = 0; });
    await say(q, '/strike pirate brig', 2500);
    await wait(q, () => !!document.querySelector('#surrender:not(.hidden)'), 20000);
    await sleep(1000);
    await shot(q, 'combat-struck-1', { mark: '#surrender', full: true });
    await shot(q, 'combat-struck-2', { mark: '#surrender .sur-choice[data-sur="sink"]', focus: '#surrender', min: 640 });
    await shot(q, 'combat-struck-3', { mark: '#surrender .sur-choice[data-sur="release"]', focus: '#surrender', min: 640 });
    await shot(q, 'combat-struck-4', { mark: '#surrender .sur-left, #surrender .sur-dist', focus: '#surrender', min: 640 });
    await click(q, '#surrender [data-sur-later]'); await sleep(600);
    // the beasts: a shark by hand
    await say(q, '/foe beast shark 160', 1800); await clean(q);
    await zoom(q, 0.75); await sleep(1500);
    let bid = await nearest(q, (s) => s.info.npcRole === 'beast' || /Акула|Shark/.test(s.info.name ?? ''));
    L.log('  beast', bid, JSON.stringify(await ring(q, bid)));
    await sleep(600);
    await shot(q, 'combat-beasts-1', { mark: '#tmenu .tm-item, #tmenu .tm-extra', min: 640 });
    await q.evaluate(() => globalThis.gravetide.aim.menu.hide());
    await q.evaluate((i) => globalThis.gravetide.target(i), bid); await sleep(500);
    await ring(q, bid); await sleep(400); await click(q, '#tmenu .tm-extra'); await sleep(1500);
    await shot(q, 'combat-beasts-2', { mark: '#detail .dc-card', full: true });
    await clean(q);
    await K.L.send(q, { t: 'attack', target: bid, mode: 'guns' });
    await sleep(4000);
    await shot(q, 'combat-beasts-3', { mark: '#tc-target', full: true });
  } finally { await q.ctx.close().catch(() => {}); }
  // the caller closes p's context; give it a fresh dummy so close() is harmless
}
