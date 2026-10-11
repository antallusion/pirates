// The screens the fit audit walks (audit.mjs): how to reach each, and the element that is the window.
import * as L from '../m0/lib.mjs';

const sleep = L.sleep;
const until = async (p, fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn, arg).catch(() => false)) return true; await sleep(150); } return false; };
const shown = (sel) => (q) => { const e = document.querySelector(q); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.classList.contains('hidden'); };
const visible = (p, sel, ms) => until(p, shown(sel), sel, ms);
export const admin = async (p, line, ms = 900) => { await L.say(p, line); await sleep(ms); };
const film = (p) => p.evaluate(() => document.querySelectorAll('.film').forEach((f) => f.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))));
const close = async (p) => { await p.evaluate(() => { globalThis.gravetide.open(null); }); await film(p); await sleep(150); };
const modal = (m) => async (p) => { await close(p); await p.evaluate((x) => globalThis.gravetide.open(x), m); return visible(p, '#modal-panel'); };
const click = (p, sel) => p.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; e.click(); return true; }, sel);

// ---------- before the game (one page, resized through every size)
async function toLogin(p, { port }) {
  await p.goto(`http://localhost:${port}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  // a fresh guest each time: the last one's token would offer «Продолжить» instead of the form
  await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k !== 'gravetide.lang') localStorage.removeItem(k); });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await visible(p, '#login-name', 90000);
  await p.evaluate(() => document.fonts.ready);
  await sleep(800);
}
async function toCaptain(p, { port, lang }) {
  await toLogin(p, { port });
  await p.fill('#login-name', (lang === 'ru' ? 'Выбор' : 'Pick') + Math.random().toString(36).slice(2, 6));
  await p.click('#login-form button');
  await visible(p, '#screen-captain', 45000);
  await sleep(800);
}
export const PRE = [
  { id: 'login', root: '#screen-login .login-panel', go: toLogin },
  { id: 'login:account', root: '#screen-login .login-panel', go: async (p, o) => { await toLogin(p, o); await p.evaluate(() => { document.querySelector('#login-account').open = true; }); } },
  { id: 'captain', root: '#screen-captain', go: toCaptain },
  { id: 'captain:drowned', root: '#screen-captain', go: async (p, o) => { await toCaptain(p, o); await p.click('.captain-card[data-id="drowned"]'); await sleep(300); } },
  // The prologue's three lines over the harbour (they end by themselves after 11 s: shown again at every size).
  { id: 'prologue', root: '#prologue', settle: 300, go: async (p, o) => {
    await toCaptain(p, o);
    await p.click('#pick-captain');
    await visible(p, '#hud', 60000);
    await sleep(1500);
    await film(p);
    // every size measures its own fresh prologue
    p.__pro = true;
  } },
];
// (the prologue is re-shown per size by the audit's measure hook below)
PRE[4].resize = async (p) => { await p.evaluate(() => globalThis.gravetide.prologue()); await sleep(400); };

// ---------- in the game
// «Осмотреть» from the long press of «Действие» (a phone keeps the adventure card folded until then)
async function lookWheel(p) {
  const c = await p.evaluate(() => { const e = document.querySelector('#tc-act'); const r = e?.getBoundingClientRect(); return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
  if (!c) return false;
  await p.mouse.move(c.x, c.y); await p.mouse.down(); await sleep(750);
  const it = await p.evaluate(() => { const i = [...document.querySelectorAll('.k-wheel-item')].find((x) => /Осмотр|Look/i.test(x.textContent)); const r = i?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
  if (it) await p.mouse.move(it.x, it.y, { steps: 4 });
  else await p.mouse.move(c.x - 200, c.y - 200, { steps: 3 });
  await p.mouse.up();
  return it ? visible(p, '#advcard', 2500) : false;
}
const sheetGone = async (p) => { await p.evaluate(() => { document.querySelectorAll('[data-lulater]').forEach((b) => b.click()); document.querySelectorAll('.k-sheet-root .k-sheet-x').forEach((b) => b.click()); document.querySelectorAll('.k-sheet-root .k-scrim').forEach((b) => b.click()); }); await sleep(250); };
const docked = (p) => p.evaluate(() => !!globalThis.gravetide.state.self?.dockedAt);
async function dock(p) {
  if (await docked(p)) return true;
  await admin(p, '/tp saltmarrow', 2500); await film(p);
  for (let i = 0; i < 6 && !(await docked(p)); i++) { await L.send(p, { t: 'dock', bribe: false }); await sleep(1500); await film(p); }
  return docked(p);
}
async function toSea(p) {
  if (await docked(p)) { await L.send(p, { t: 'undock' }); await sleep(2500); await film(p); }
  await close(p); await sheetGone(p);
}
const port = (tab) => ({
  id: `port:${tab}`,
  setup: async (p) => { await dock(p); },
  open: async (p) => {
    await close(p); await sheetGone(p);
    await p.evaluate(() => globalThis.gravetide.open('port'));
    if (!(await visible(p, '#modal-panel[data-modal="port"]', 4000))) return false;
    if (!(await click(p, `#modal-panel [data-ptab="${tab}"]`))) return false;
    await sleep(500);
    return tab === 'tattoo' ? visible(p, '#modal-panel') : true;
  },
});
const hero = (tab, chip) => ({
  id: `hero:${tab}${chip ? ':' + chip : ''}`,
  open: async (p) => {
    await close(p); await sheetGone(p);
    await p.evaluate((t) => globalThis.gravetide.hero(t), tab);
    if (!(await visible(p, '#modal-panel[data-modal="hero"]', 4000))) return false;
    await click(p, `#modal-panel [data-ctab="${tab}"]`); await sleep(300);
    if (chip && !(await click(p, `#modal-panel [data-cchip="${chip}"]`))) return false;
    return true;
  },
});
const journal = (tab, chip) => ({
  id: `journal:${tab}${chip ? ':' + chip : ''}`,
  open: async (p) => {
    if (!(await modal('journal')(p))) return false;
    if (!(await click(p, `#modal-panel [data-jtab="${tab}"]`))) return false;
    await sleep(300);
    if (chip && !(await click(p, `#modal-panel [data-jchip="${chip}"]`))) return false;
    return true;
  },
});
const throne = (tab) => ({
  id: `throne:${tab}`,
  open: async (p) => {
    await close(p); await sleep(700); await sheetGone(p);
    await p.evaluate((t) => globalThis.gravetide.throne(t), tab);
    await sleep(300); await sheetGone(p);
    if (!(await visible(p, '#modal-panel[data-modal="throne"]', 4000))) return false;
    await click(p, `#modal-panel [data-thtab="${tab}"]`);
    return true;
  },
});
const options = (tab) => ({
  id: `options${tab ? ':' + tab : ''}`,
  open: async (p) => {
    if (!(await modal('options')(p))) return false;
    if (tab) { await click(p, '#modal-panel [data-omore]'); await sleep(250); if (!(await click(p, `#modal-panel [data-otab="${tab}"]`))) return false; }
    return true;
  },
});
const simple = (m, id = m) => ({ id, open: modal(m) });
// a sheet of the kit: root is the sheet itself
const SHEET = '.k-sheet-root .k-sheet';
// the tactical battle's sheets and cards differ on a phone and a desk
const tacSheet = async (p) => { await p.evaluate(() => { document.querySelectorAll('.k-sheet-root .k-sheet-x').forEach((b) => b.click()); document.querySelectorAll('.tb-book [data-bookclose]').forEach((b) => b.click()); document.querySelectorAll('.tb-card [data-x], .tb-card .x').forEach((b) => b.click()); }); await sleep(250); };
const inBattle = (p) => p.evaluate(() => !!globalThis.gravetide.state.boardTac && !document.querySelector('#board-tac')?.classList.contains('hidden'));
async function battle(p, line) {
  await toSea(p);
  await admin(p, '/tp 21000 70000', 2500); await film(p); await close(p); await sheetGone(p);
  await admin(p, '/heal', 600); await admin(p, '/will full', 600);
  await admin(p, line, 4000); await film(p);
  for (let i = 0; i < 20 && !(await inBattle(p)); i++) { await sleep(500); await film(p); }
  await sleep(1500); await film(p);
}
const toastsOn = (p) => p.evaluate(() => {
  const h = globalThis.gravetide.hud;
  h.toast(document.documentElement.lang === 'ru' ? 'Продано 5 рома за 245 серебра.' : 'Sold 5 rum for 245 silver.', 'gold');
  h.toast(document.documentElement.lang === 'ru' ? 'Пушки ещё заряжаются: 2,4 с.' : 'The guns are still loading: 2.4 s.', 'bad');
  h.toast(document.documentElement.lang === 'ru' ? 'Новое задание: доставить почту в Грейвсенд до заката.' : 'A new task: carry the mail to Gravesend before dusk.', 'info');
});

export const SCREENS = [
  { id: 'levelup', root: SHEET, settle: 1300, setup: async (p) => { await admin(p, '/silver 90000'); await admin(p, '/order all'); await admin(p, '/army marine 40'); await close(p); },
    open: async (p) => { await sheetGone(p); await close(p); await admin(p, '/level 1', 1400); await admin(p, '/level 25', 300); return visible(p, '.k-sheet.lu-sheet', 4000); },
    after: async (p) => { await sheetGone(p); await admin(p, '/level 30'); await sheetGone(p); } },
  ...['market', 'shipyard', 'tavern', 'quests', 'harbour', 'colours', 'holdings', 'exchange', 'auction', 'dice', 'rumours', 'charts', 'army', 'pets', 'tattoo'].map(port),
  { id: 'depart', root: SHEET, setup: async (p) => { await dock(p); await L.send(p, { t: 'onboarding', action: 'skip_all' }); await admin(p, '/hurt 40'); },
    open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => globalThis.gravetide.open('port')); await sleep(400); await click(p, '#modal-panel [data-ptab="sea"]'); return visible(p, '.depart-panel', 3000); },
    after: async (p) => { await click(p, '[data-dp="stay"]'); await sleep(300); await admin(p, '/heal'); } },
  hero('hero'), hero('skills'), hero('book', 'orders'), hero('book', 'path'), hero('book', 'guild'), hero('gear', 'captain'), hero('gear', 'ship'), hero('gear', 'locker'), hero('gear', 'shop'),
  simple('talents'),
  { id: 'talents:tree', open: async (p) => { if (!(await modal('talents')(p))) return false; return click(p, '#modal-panel .rose-node[data-view="gunnery"]'); } },
  options(), options('ui'), options('vision'), options('sound'), options('controls'),
  simple('map'),
  journal('quests'), journal('company', 'group'), journal('company', 'law'), journal('company', 'isles'), journal('guild'), journal('letters'), journal('album', 'album'), journal('album', 'career'),
  simple('menu'), simple('ship'), simple('crew'), simple('help'), simple('research'), simple('look'),
  { id: 'shop', open: async (p) => { await close(p); await p.evaluate(() => globalThis.gravetide.shop()); return visible(p, '#modal-panel[data-modal="shop"]', 4000); } },
  { id: 'toasts:port', root: '#modal-toasts, #toasts', open: async (p) => { await modal('port')(p); await toastsOn(p); return true; }, settle: 400 },
  // --- the Throne (level 60) while still in port
  { id: 'throne:glory', setup: async (p) => { await admin(p, '/glory 3', 1500); await admin(p, '/mastery all'); await sheetGone(p); }, ...throne('glory') },
  ...['mastery', 'trials', 'seals', 'raid', 'citadels', 'war', 'contracts', 'arena'].map(throne),
  // --- at sea
  { id: 'sea', root: '#hud', setup: async (p) => { await toSea(p); await admin(p, '/tp 21000 70000', 2500); await film(p); await close(p); await sheetGone(p); },
    open: async (p) => { await close(p); await sheetGone(p); return visible(p, '#hud'); } },
  { id: 'sea:menu', root: SHEET, open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => globalThis.gravetide.seaHud.openMenu()); return visible(p, '.k-sheet.sea-menu', 3000); }, after: sheetGone },
  { id: 'sea:news', root: SHEET, open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => globalThis.gravetide.seaHud.openNews()); return visible(p, '.k-sheet.sea-lent-sheet', 3000); }, after: sheetGone },
  // docs/28, the chat: the sheet (#hud-chat: its button rides the sheet's edge while open), the emotes, a captain's card,
  // the private tab (the world's lines come with the history on coming aboard)
  { id: 'chat', root: '#hud-chat', open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => { const c = globalThis.gravetide.hud.chatPanel; c.open(false); c.pick('world'); }); return visible(p, '#chat.open', 3000); },
    after: async (p) => { await click(p, '#chat-close'); } },
  { id: 'chat:emotes', root: '#hud-chat', open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => { const c = globalThis.gravetide.hud.chatPanel; c.open(false); c.pick('world'); }); if (await p.evaluate(() => document.getElementById('chat-emotes').classList.contains('hidden'))) await click(p, '#chat-emote-btn'); return visible(p, '#chat-emotes', 3000); },
    after: async (p) => { await click(p, '#chat-close'); } },
  { id: 'chat:card', root: '#hud-chat', open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => { const c = globalThis.gravetide.hud.chatPanel; c.open(false); c.pick('world'); }); if (!(await click(p, '#chat-log button.cl-face'))) return false; return visible(p, '#chat-card', 3000); },
    after: async (p) => { await click(p, '#chat-card [data-act="close"]'); await click(p, '#chat-close'); } },
  { id: 'chat:dm', root: '#hud-chat', open: async (p) => { await close(p); await sheetGone(p); await p.evaluate(() => { const c = globalThis.gravetide.hud.chatPanel; c.open(false); c.pick('dm'); }); return visible(p, '#chat.open', 3000); },
    after: async (p) => { await p.evaluate(() => globalThis.gravetide.hud.chatPanel.pick('world')); await click(p, '#chat-close'); } },
  { id: 'toasts:sea', root: '#toasts', open: async (p) => { await close(p); await toastsOn(p); return true; }, settle: 400 },
  { id: 'lair-card', root: '#advcard', setup: async (p) => { await admin(p, '/lair crab_beach reset', 1200); await admin(p, '/lair crab_beach go', 3000); await film(p); },
    open: async (p) => { await close(p); await sheetGone(p); if (await visible(p, '#advcard', 1500)) return true; if (await lookWheel(p)) return true; await click(p, '#hud-prompt [data-act="look"]'); return visible(p, '#advcard', 2000); } },
  { id: 'roam-card', root: SHEET, setup: async (p) => { await p.evaluate(() => document.querySelector('#advcard .ac-x, #advcard [data-ax]')?.click()); await admin(p, '/stack gull go', 3000); await film(p); },
    open: async (p) => { await close(p); await sheetGone(p); return p.evaluate(async () => { const s = globalThis.gravetide.state; const v = s.roams?.[0]; if (!v) return false; const m = await import('/src/ui/roamcard.ts'); void m.openRoamCard(s, v, () => {}); await new Promise((r) => setTimeout(r, 500)); return !!document.querySelector('.roam-panel'); }); },
    after: sheetGone },
  { id: 'lairchest', root: '#lairchest', open: async (p) => { await p.evaluate(() => globalThis.gravetide.net.handlers.forEach((h) => h({ t: 'lairchest', view: { island: 'Isla Muerta', captain: 'Salt Lady', silver: 500, prisoners: 3, item: null, map: null } }))); return visible(p, '#lairchest', 3000); },
    after: async (p) => { await click(p, '[data-lc-close]'); } },
  { id: 'board-offer', root: '#board-offer', open: async (p) => { await p.evaluate(() => { globalThis.gravetide.net.handlers.forEach((h) => h({ t: 'board_offer', offer: { with: 1, side: 0, mate: 'Anne Blackwood', foe: 'Salt Lady', round: 0, last: 3, army: [{ u: 'marine', n: 20 }, { u: 'deckhand', n: 10 }], bring: ['marine'], n: 1, auto: false } })); }); return visible(p, '#board-offer', 3000); },
    after: async (p) => { await p.evaluate(() => document.querySelector('#board-offer [data-no]')?.click()); } },
  { id: 'sea:foe', root: '#hud', setup: async (p) => { await admin(p, '/foe pirate sloop 260', 2500); }, open: async (p) => { await close(p); await sheetGone(p); return true; } },
  // --- the boarding battle
  { id: 'battle', root: '#board-tac', setup: (p) => battle(p, '/board pirate brig'), open: async (p) => { await tacSheet(p); return inBattle(p); }, settle: 900 },
  { id: 'battle:book', root: '#board-tac .tb-book, .k-sheet.tb-bookk', open: async (p) => { await tacSheet(p); if (!(await inBattle(p))) return false; const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('#board-tac [data-book]')].find((e) => e.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; }); await sleep(500); return ok; }, after: tacSheet },
  { id: 'battle:card', root: '#board-tac .tb-card, .k-sheet.tb-cardk', open: async (p) => { await tacSheet(p); if (!(await inBattle(p))) return false;
    const ok = await p.evaluate(async () => { let q = [...document.querySelectorAll('#board-tac .tb-queue .tb-q[data-info]')].find((e) => e.getBoundingClientRect().width > 0); if (!q) { document.querySelector('#board-tac [data-sheet]')?.click(); await new Promise((r) => setTimeout(r, 400)); q = document.querySelector('.tb-sheet .tb-q, .k-sheet .tb-q'); } if (!q) return false; q.click(); return true; });
    await sleep(500); return ok; }, after: tacSheet },
  { id: 'battle:end', root: '#board-tac', setup: async (p) => { await tacSheet(p); await L.send(p, { t: 'tac', act: { a: 'quick' } }); await sleep(4000); await film(p); },
    // (the end's banner does not wait for every size: a fresh fight and its quick end where it has gone)
    open: async (p) => { await film(p); if (await visible(p, '#board-tac .tb-end', 1500)) return true; await battle(p, '/board pirate sloop'); await L.send(p, { t: 'tac', act: { a: 'quick' } }); await sleep(4000); await film(p); return visible(p, '#board-tac .tb-end', 4000); },
    after: async (p) => { await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click()); await sleep(1500); await film(p); await close(p); } },
  // --- a land fight at a lair
  { id: 'land', root: '#board-tac', setup: (p) => battle(p, '/lair crab_beach fight'), open: async (p) => { await tacSheet(p); return inBattle(p); }, settle: 900,
    after: async (p) => { await L.send(p, { t: 'tac', act: { a: 'quick' } }); await sleep(4000); await film(p); await p.evaluate(() => document.querySelector('#board-tac [data-endbtn]')?.click()); await sleep(1500); await film(p); await close(p); } },
];
