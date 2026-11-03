// The trade's slides (shared/src/data/guide/trade.ts).
export async function TRADE(p, K) {
  const { say, sleep, clean, wait, click, open, tab, dock, toSea, shot, L } = K;
  await say(p, '/level 20', 300);
  await say(p, '/doubloons 120', 300);
  await dock(p, 'gravesend');
  await open(p, 'port', 1500);
  await tab(p, 'market', 1800);
  await shot(p, 'trade-market-1', { mark: '.mk-list', full: true });
  await shot(p, 'trade-market-2', { mark: '.mk-clock', focus: '.mk-head', min: 760 });
  await p.evaluate(() => (document.querySelector('.mk-row .up, .mk-row .down')?.closest('.mk-row'))?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'trade-market-3', { mark: '.mk-row .up, .mk-row .down', focus: ['.mk-row .up, .mk-row .down'], min: 760 });
  // the room a unit takes
  await p.evaluate(() => document.querySelector('.mk-row[data-good="spices"], .mk-row[data-good="tobacco"]')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'trade-volume-1', { mark: '.mk-row[data-good="spices"] .w-row-t small, .mk-row[data-good="tobacco"] .w-row-t small', focus: '.mk-row[data-good="spices"], .mk-row[data-good="tobacco"]', min: 760 });
  await p.evaluate(() => document.querySelector('.mk-row[data-good="fish"], .mk-row[data-good="salt"], .mk-row[data-good="sugar"]')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'trade-volume-2', { mark: '.mk-row[data-good="fish"] .w-row-t small, .mk-row[data-good="salt"] .w-row-t small, .mk-row[data-good="sugar"] .w-row-t small', focus: '.mk-row[data-good="fish"], .mk-row[data-good="salt"], .mk-row[data-good="sugar"]', min: 760 });
  // a buy fills the hold
  await K.L.send(p, { t: 'trade', good: 'sugar', qty: 10 }); await sleep(1500);
  await open(p, 'port', 1200); await tab(p, 'market', 1500);
  await p.evaluate(() => [...document.querySelectorAll('#modal-panel .w-fig')].find((e) => /\d\/\d/.test(e.textContent))?.classList.add('__hold'));
  await shot(p, 'trade-volume-3', { mark: '#modal-panel .w-fig.__hold', full: true });
  // the warehouse
  await tab(p, 'holdings', 1800);
  await shot(p, 'trade-warehouse-1', { mark: '[data-ptab="holdings"]', full: true });
  await p.evaluate(() => document.querySelector('[data-act="store"]')?.scrollIntoView({ block: 'center' })); await sleep(500);
  await shot(p, 'trade-warehouse-2', { mark: '[data-act="store"]', full: true });
  await click(p, '[data-act="store"]'); await sleep(1500);
  await shot(p, 'trade-warehouse-3', { mark: '#modal-panel .modal-body', full: true });
  // contracts
  await tab(p, 'quests', 1500);
  await click(p, '[data-qchip="contracts"]'); await sleep(1500);
  await shot(p, 'trade-contracts-1', { mark: '[data-qchip="contracts"]', full: true });
  await shot(p, 'trade-contracts-2', { mark: '#modal-panel .modal-body', full: true });
  // the exchange
  await tab(p, 'exchange', 1800);
  await shot(p, 'trade-exchange-1', { mark: '.xch-seg', full: true });
  await click(p, '[data-xtab="orders"]'); await sleep(1200);
  await shot(p, 'trade-exchange-2', { mark: '[data-xtab="orders"]', full: true });
  await click(p, '[data-xtab="bank"]'); await sleep(1200);
  await shot(p, 'trade-exchange-3', { mark: '[data-xtab="bank"]', full: true });
  await p.evaluate(() => globalThis.gravetide.open(null));
  // the port card (the chart's)
  await p.evaluate(() => globalThis.gravetide.portCard('gravesend')); await sleep(1800);
  await shot(p, 'trade-portcard-1', { mark: '#port-card', full: true });
  await p.evaluate(() => { for (const e of document.querySelectorAll('#port-card, #port-card *')) if (e.scrollHeight > e.clientHeight + 20) e.scrollTop = e.scrollHeight; }); await sleep(800);
  await shot(p, 'trade-portcard-2', { mark: '#port-card', full: true });
  await clean(p);

  await p.evaluate(() => document.querySelectorAll('.k-sheet-root .k-sheet-x, .k-sheet-root [data-close]').forEach((x) => x.click()));
  // the doubloons: the shop's «Обмен»
  await p.evaluate(() => globalThis.gravetide.open('shop')); await sleep(2200);
  await shot(p, 'trade-doubloons-1', { mark: '[data-pmex]', full: true });
  await click(p, '[data-pmex]'); await sleep(1500);
  await click(p, '[data-expick]'); await sleep(800);
  await shot(p, 'trade-doubloons-2', { mark: '[data-exgo]', full: true });
  await p.evaluate(() => globalThis.gravetide.open(null));
  // the auction: a Free Harbors port
  await dock(p, 'tidewrack');
  await open(p, 'port', 1500);
  await tab(p, 'auction', 1800);
  await shot(p, 'trade-exchange-4', { mark: '[data-ptab="auction"]', full: true });
  await shot(p, 'trade-exchange-5', { mark: '#modal-panel .modal-body', full: true });
}
