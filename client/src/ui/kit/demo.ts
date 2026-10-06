// The kit's page (/?kit, docs/23 phase 1): every component of the interface kit on one screen, at a phone's 812×375
// first, for QA and for the next phases to build from. Not the game: index.html loads this in place of main.ts.
// /?kit&lang=en shows it in English; the language buttons switch it in place.

import { loadAssets } from '../../assets.ts';
import { dict, lang, setLang } from '../../i18n.ts';
import type { Lang } from '../../i18n.ts';
import { EN, RU } from '../../lang/ui/kit.ts';
import { esc } from '../dom.ts';
import { applySkin } from '../skin.ts';
import { buttonHtml, flash } from './button.ts';
import { CounterIcon } from './counter.ts';
import { attachWheel } from './radial.ts';
import type { WheelOption } from './radial.ts';
import { riskConfirm } from './risk.ts';
import { openSheet } from './sheet.ts';
import { targetLineHtml } from './targetline.ts';
import { toast } from './toast.ts';
import { MOTION, reducedMotion } from './tokens.ts';

const L = dict(EN, RU);
const ART = ['icon.fire', 'icon.stat_sails', 'icon.tab_market', 'icon.menu_cabin', 'icon.menu_map', 'icon.goal', 'icon.tab_letters', 'icon.map_event', 'icon.danger', 'icon.anchor', 'icon.coin', 'icon.map_ship', 'icon.tab_board',
  'icon.ammo_round', 'icon.ammo_chain', 'icon.ammo_grape', 'icon.ammo_heavy', 'icon.ammo_incendiary', 'icon.ammo_bar',
  'ui.frame', 'ui.plate', 'ui.button', 'ui.slot', 'ui.ring', 'ui.close', 'tex.panel', 'tex.ebony'];

const q = new URLSearchParams(location.search).get('lang');
if (q === 'en' || q === 'ru') setLang(q);
document.documentElement.classList.remove('i18n-pending');
document.body.classList.add('k-demo');
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
// The game's own screens stay out of the way (their markup is in the same page).
const style = document.createElement('style');
style.textContent = 'body.k-demo > :not(.k-demo-wrap):not(.k-demo-head):not(.k-sheet-root):not(.k-wheel):not(.k-toasts):not(#rotate-lock):not(style) { display: none !important; }';
document.head.append(style);

let shot: WheelOption['id'] = 'round';
const shots = (): WheelOption[] => [
  { id: 'round', label: L('demo.round'), icon: 'ammo_round', count: 60 },
  { id: 'chain', label: L('demo.chain'), icon: 'ammo_chain', count: 20 },
  { id: 'grape', label: L('demo.grape'), icon: 'ammo_grape', count: 20 },
  { id: 'heavy', label: L('demo.heavy'), icon: 'ammo_heavy', count: 0, disabled: true },
  { id: 'incendiary', label: L('demo.incendiary'), icon: 'ammo_incendiary', count: 8 },
  { id: 'bar', label: L('demo.bar'), icon: 'ammo_bar', count: 4 },
].map((o) => ({ ...o, active: o.id === shot }));

function render(): void {
  document.querySelectorAll('.k-demo-head, .k-demo-wrap').forEach((e) => e.remove());
  const head = document.createElement('header');
  head.className = 'k-demo-head';
  head.innerHTML = `<h1>${esc(L('demo.title'))}</h1>${(['ru', 'en'] as Lang[]).map((l) => buttonHtml({ kind: 'secondary', label: l.toUpperCase(), pressed: lang() === l, data: { lang: l } })).join('')}`;
  const wrap = document.createElement('main');
  wrap.className = 'k-demo-wrap';
  wrap.innerHTML = `
    <section class="k-demo-card" data-demo="buttons"><h3>${esc(L('demo.buttons'))}</h3>
      <p class="k-demo-lead">${esc(L('demo.lead'))}</p>
      <div class="k-demo-row">${buttonHtml({ kind: 'primary', label: L('demo.primary'), icon: 'stat_sails', data: { demo: 'primary' } })}${buttonHtml({ kind: 'secondary', label: L('demo.secondary'), icon: 'tab_market' })}</div>
      <div class="k-demo-row">${buttonHtml({ kind: 'secondary', label: L('demo.disabled'), disabled: true })}${buttonHtml({ kind: 'secondary', label: L('demo.busy'), busy: true })}</div>
      <div class="k-demo-row">${buttonHtml({ kind: 'icon', size: 'lg', icon: 'fire', glyph: '✹', aria: L('demo.fire'), data: { demo: 'flash' } })}${buttonHtml({ kind: 'icon', icon: 'tab_board', glyph: '⚓', aria: L('demo.board'), pressed: true })}${buttonHtml({ kind: 'icon', icon: 'menu_cabin', glyph: '☰', aria: L('demo.sheetTitle'), badge: 3 })}</div>
    </section>
    <section class="k-demo-card" data-demo="sheet"><h3>${esc(L('demo.sheet'))}</h3>
      <div class="k-demo-row">${buttonHtml({ kind: 'secondary', label: L('demo.sheet'), data: { demo: 'sheet' } })}${buttonHtml({ kind: 'secondary', label: L('demo.risk'), data: { demo: 'risk' } })}</div>
      <div class="k-demo-out" data-out="risk"></div>
    </section>
    <section class="k-demo-card" data-demo="wheel"><h3>${esc(L('demo.wheel'))}</h3>
      <div class="k-demo-row">${buttonHtml({ kind: 'icon', size: 'lg', icon: 'fire', glyph: '✹', aria: L('demo.wheel'), data: { demo: 'wheel' } })}<span class="k-demo-out" data-out="wheel">${esc(L('demo.picked', { what: shots().find((o) => o.id === shot)!.label }))}</span></div>
    </section>
    <section class="k-demo-card" data-demo="target"><h3>${esc(L('demo.target'))}</h3>
      ${targetLineHtml({ name: L('demo.t1'), level: 3, hull: 0.82, chance: 0.71, icon: 'map_ship', threat: 'easy' })}
      ${targetLineHtml({ name: L('demo.t2'), level: 5, hull: 0.55, chance: 0.42, icon: 'map_ship', threat: 'hard' })}
      ${targetLineHtml({ name: L('demo.t3'), level: 8, hull: 1, chance: 0.12, icon: 'danger', threat: 'skull' })}
    </section>
    <section class="k-demo-card" data-demo="toast"><h3>${esc(L('demo.toast'))}</h3>
      <div class="k-demo-row">${buttonHtml({ kind: 'secondary', label: L('demo.toastText'), data: { demo: 'toast' } })}${buttonHtml({ kind: 'secondary', label: L('demo.toastBad'), data: { demo: 'toastbad' } })}</div>
    </section>
    <section class="k-demo-card" data-demo="counters"><h3>${esc(L('demo.counters'))}</h3><div class="k-demo-row" data-counters></div></section>
    <section class="k-demo-card" data-demo="motion"><h3>${esc(L('demo.motion', { a: MOTION.fast, b: MOTION.base, c: MOTION.slow }))}</h3>
      <div class="k-demo-row">${buttonHtml({ kind: 'secondary', label: L('demo.reduced'), pressed: reducedMotion(), data: { demo: 'reduce' } })}</div>
    </section>`;
  document.body.append(head, wrap);
  const counters = wrap.querySelector<HTMLElement>('[data-counters]')!;
  const list = (n: number) => `<ul>${Array.from({ length: n }, (_, i) => `<li>${esc(L('demo.item', { n: i + 1 }))}</li>`).join('')}</ul>`;
  for (const [id, icon, label, n] of [['goals', 'goal', L('demo.goals'), 3], ['news', 'map_event', L('demo.news'), 12], ['letters', 'tab_letters', L('demo.letters'), 0]] as const) {
    const c = new CounterIcon({ id, icon, label, n, keep: true, content: () => list(Math.max(1, n)) });
    counters.append(c.el);
  }
  head.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang as Lang); render(); }));
  const on = (sel: string, f: (b: HTMLElement) => void) => wrap.querySelectorAll<HTMLElement>(`[data-demo="${sel}"]`).forEach((b) => b.tagName === 'BUTTON' && b.addEventListener('click', () => f(b)));
  on('primary', () => toast(L('demo.primary'), 'good'));
  on('flash', (b) => flash(b));
  on('sheet', () => openSheet({ title: L('demo.sheetTitle'), body: `<p>${esc(L('demo.sheetBody'))}</p>${list(8)}`, foot: buttonHtml({ kind: 'secondary', label: L('close'), data: { close: '' } }) + buttonHtml({ kind: 'primary', size: 'md', label: L('demo.primary'), data: { go: '' } }), height: 0.75 }).panel.querySelectorAll<HTMLElement>('[data-close], [data-go]').forEach((b) => b.addEventListener('click', () => (b.closest('.k-sheet-root')?.querySelector('.k-sheet-x') as HTMLElement | null)?.click())));
  on('risk', async () => {
    const ok = await riskConfirm({ target: L('demo.riskTarget'), chance: 0.18, levelGap: 2, lose: { silver: 420, cargo: true, men: 30, port: true }, gainXpMul: 1.6 });
    wrap.querySelector('[data-out="risk"]')!.textContent = L('demo.answer', { what: ok ? L('risk.go') : L('risk.back') });
  });
  on('toast', () => toast(L('demo.toastText'), 'good'));
  on('toastbad', () => toast(L('demo.toastBad'), 'bad'));
  on('reduce', () => { document.body.classList.toggle('reduce-motion'); render(); });
  const fire = wrap.querySelector<HTMLElement>('button[data-demo="wheel"]')!;
  attachWheel(fire, {
    options: shots,
    title: L('demo.wheel'),
    onPick: (o) => { shot = o.id; wrap.querySelector('[data-out="wheel"]')!.textContent = L('demo.picked', { what: o.label }); },
    onTap: () => toast(`${L('demo.fireShot')}: ${shots().find((o) => o.id === shot)!.label}`, 'good'),
  });
}

render();
void loadAssets(ART).then(() => { applySkin(); render(); });
