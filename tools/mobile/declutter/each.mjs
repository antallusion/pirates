// Every button behind «⋯» opened once from the tray (owner, 2026-10-29): the tray open, the button tapped, what it
// opened named (a window, a sheet, a panel, the pill's card), the tray folded after it, all shut again.
export default async function each(p, L, OUT, size, rows) {
  const ids = await p.evaluate(() => [...document.querySelectorAll('.more-fold')].filter((e) => !e.classList.contains('hidden')).map((e) => e.id));
  for (const id of ids) {
    await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x').forEach((b) => b.click()); });
    await L.sleep(400);
    await p.evaluate(() => { if (!document.body.classList.contains('more-open')) document.getElementById('tc-more')?.click(); });
    await L.sleep(Number(process.env.SLIDE ?? 1200)); // (headless swiftshader starts the slide late: its first frame is slow)
    const seen = await p.evaluate((i) => { const r = document.getElementById(i)?.getBoundingClientRect(); return r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width)] : null; }, id);
    // a real tap at its middle (the tray's own hit test, not a script click)
    const box = await p.evaluate((i) => { const e = document.getElementById(i); const t = e?.querySelector('[data-adv]') ?? e; const r = t?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, id);
    if (box) await (p.touchscreen && (await p.evaluate(() => document.body.classList.contains('touch'))) ? p.touchscreen.tap(box.x, box.y) : p.mouse.click(box.x, box.y));
    await L.sleep(900);
    const what = await p.evaluate(() => {
      const m = document.getElementById('modal');
      const sheet = document.querySelector('.k-sheet-root.k-open');
      const conf = document.querySelector('.confirm-panel, #confirm-text');
      const qp = document.querySelector('#cos-qpanel:not(.hidden)');
      const adv = document.querySelector('#hud-advice .adv-card');
      const gift = document.querySelector('#gift-over:not(.hidden)');
      const promo = document.querySelector('#promo-over:not(.hidden)');
      return {
        modal: m && !m.classList.contains('hidden') ? (document.querySelector('#modal-panel')?.className || 'modal') : null,
        sheet: sheet ? (sheet.querySelector('.k-sheet-title, h2, h3')?.textContent?.trim().slice(0, 40) || 'sheet') : null,
        confirm: !!conf, emotes: !!qp, adviceCard: !!adv, gift: !!gift, promo: !!promo,
        isle: !!document.querySelector('#isle:not(.hidden)'),
        trayOpen: document.body.classList.contains('more-open'),
      };
    });
    await p.screenshot({ path: `${OUT}/${size}_open_${id}.png` });
    rows.push({ name: `${size}_open_${id}`, at: seen, what });
    L.log(`open ${id} at ${JSON.stringify(seen)} →`, JSON.stringify(what));
    await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelectorAll('.k-sheet-root.k-open .k-sheet-x, [data-advx], .confirm-panel [data-no], [data-poshut], [data-gflater]').forEach((b) => b.click()); document.querySelector('#cos-qpanel:not(.hidden)') && document.getElementById('cos-qbtn')?.click(); });
    await L.sleep(500);
    for (let k = 0; k < 6 && (await p.evaluate(() => !!document.querySelector('#gift-over:not(.hidden), #promo-over:not(.hidden), .k-sheet-root.k-open') || !document.getElementById('modal').classList.contains('hidden'))); k++) {
      await p.evaluate(() => { globalThis.gravetide.open(null); document.querySelectorAll('#gift-over [data-gflater], #promo-over [data-polater], #promo-over [data-poshut], .k-sheet-root.k-open .k-sheet-x, .confirm-panel [data-no]').forEach((b) => b.click()); });
      await L.sleep(500);
    }
  }
  // a tap on the open sea folds the tray
  await p.evaluate(() => { if (!document.body.classList.contains('more-open')) document.getElementById('tc-more')?.click(); });
  await L.sleep(400);
  await p.mouse.click(Math.round(p.viewportSize().width / 2), Math.round(p.viewportSize().height * 0.6));
  await L.sleep(300);
  const folded = await p.evaluate(() => !document.body.classList.contains('more-open'));
  rows.push({ name: `${size}_outside`, folded });
  L.log('tap outside folds:', folded);
}
