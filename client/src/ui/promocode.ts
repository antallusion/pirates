// «Настройки → Промокод» (owner, 2026-11-02: «добавим в игру возможность вставлять промокоды где-то в настройках.
// Отдельно функция промокоды»). A field (case and spaces do not matter), «Активировать» and the answer's line: what the
// code handed over, or why not. The server checks everything (server/src/game/promocodes.ts); this only asks and says.
// On a phone the field scrolls itself into view above the keyboard (visualViewport), in Telegram and VK alike.

import type { ClientMsg, ServerMsg } from '../../../shared/src/protocol.ts';
import type { PromoGot, PromoResult } from '../../../shared/src/data/promocodes.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/promocode.ts';
import { esc } from './dom.ts';

const L = dict(EN, RU);
type K = keyof typeof EN;

let send: ((m: ClientMsg) => void) | null = null;
/** The last answer (kept while the window is closed and opened again) and the code typed. */
let last: { text: string; ok: boolean } | null = null;
let typed = '';
let busy = false;
let timer: ReturnType<typeof setTimeout> | null = null;

const num = (n: number) => (lang() === 'ru' ? Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ') : Math.round(n).toLocaleString('en-US'));

/** What a code handed over, in words: «+5 000 серебра, провизия ×50, …». */
export function gotText(g: PromoGot): string {
  const out: string[] = [];
  const add = (k: K, n?: number, vars: Record<string, string | number> = {}) => {
    if (n && n > 0) out.push(L(k, { n: num(n), ...vars }));
  };
  add('got.silver', g.silver);
  add('got.doubloons', g.doubloons);
  for (const [k, n] of Object.entries(g.cargo ?? {})) add(`got.${k}` as K, n);
  add('got.kit', g.kit);
  for (const [k, n] of Object.entries(g.res ?? {})) add(`got.${k}` as K, n);
  add('got.speed', g.speed);
  add('got.map', g.map);
  add('got.xp', g.xp);
  add('got.charm', g.charm);
  add('got.scrolls', g.scrolls);
  if (g.unit) add('got.unit', g.unit.n, { name: (EN as Record<string, string>)[`unit.${g.unit.u}`] ? L(`unit.${g.unit.u}` as K) : g.unit.u });
  return out.join(', ');
}

/** The answer's line in her language. */
export function resultText(r: PromoResult): string {
  if (r.ok) return L('ok', { list: gotText(r.got) });
  if (r.why === 'level') return L('level', { n: r.maxLevel ?? 15 });
  if (r.why === 'rate') {
    const s = Math.max(1, r.wait ?? 60);
    return L('rate', { t: s >= 60 ? L('min', { n: Math.ceil(s / 60) }) : L('sec', { n: s }) });
  }
  return L(r.why);
}

/** main.ts: the wire. The answer is kept and the screen told (`gravetide:promocode`). */
export function initPromoCode(sendFn: (m: ClientMsg) => void, on: (f: (m: ServerMsg) => void) => void): void {
  send = sendFn;
  on((m) => {
    if (m.t !== 'promocode') return;
    busy = false;
    if (timer) clearTimeout(timer);
    last = { text: resultText(m.res), ok: m.res.ok };
    if (m.res.ok) typed = '';
    dispatchEvent(new CustomEvent('gravetide:promocode'));
  });
}

/** The section (the options' «Промокод» tab). */
export function promoCodeHtml(): string {
  return `<form class="pcode" novalidate autocomplete="off">
    <p class="pcode-lead">${esc(L('lead'))}</p>
    <div class="pcode-row">
      <label class="pcode-f"><span class="pcode-l">${esc(L('label'))}</span>
        <input type="text" name="code" class="field pcode-in" maxlength="32" value="${esc(typed)}" placeholder="${esc(L('placeholder'))}" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="go" inputmode="text" aria-describedby="pcode-res" /></label>
      <button type="submit" class="k-btn k-btn--primary k-btn--md pcode-go"${busy ? ' disabled' : ''}>${esc(busy ? L('wait') : L('go'))}</button>
    </div>
    <p id="pcode-res" class="pcode-res${last ? (last.ok ? ' ok' : ' bad') : ''}" role="status" aria-live="polite">${last ? esc(last.text) : ''}</p>
  </form>`;
}

/** Keeps the field above a phone's keyboard: the window's body scrolled so the field sits in the visible part. */
function keepInView(input: HTMLInputElement): void {
  const vv = (globalThis as { visualViewport?: VisualViewport }).visualViewport;
  const fit = () => {
    if (document.activeElement !== input) return;
    input.closest('form')?.scrollIntoView({ block: 'start', behavior: 'auto' });
    const r = input.getBoundingClientRect();
    const bottom = vv ? vv.offsetTop + vv.height : innerHeight;
    if (r.bottom > bottom - 8) input.scrollIntoView({ block: 'center', behavior: 'auto' });
  };
  input.addEventListener('focus', () => setTimeout(fit, 250));
  vv?.addEventListener('resize', fit);
  input.addEventListener('blur', () => vv?.removeEventListener('resize', fit), { once: true });
}

/** The section wired (`redraw` after the answer). */
export function wirePromoCode(root: HTMLElement): void {
  const form = root.querySelector<HTMLFormElement>('form.pcode');
  if (!form) return;
  const input = form.querySelector<HTMLInputElement>('input[name=code]')!;
  const res = form.querySelector<HTMLElement>('.pcode-res')!;
  input.addEventListener('input', () => (typed = input.value));
  // the game's keys stay off while she types
  input.addEventListener('keydown', (e) => e.stopPropagation());
  keepInView(input);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    const code = input.value.trim();
    typed = input.value;
    if (!code) {
      last = { text: L('empty'), ok: false };
      res.textContent = last.text;
      res.className = 'pcode-res bad';
      input.focus();
      return;
    }
    busy = true;
    const go = form.querySelector<HTMLButtonElement>('.pcode-go')!;
    go.disabled = true;
    go.textContent = L('wait');
    send?.({ t: 'premium', action: 'promocode', code });
    timer = setTimeout(() => {
      if (!busy) return;
      busy = false;
      last = { text: L('noAnswer'), ok: false };
      dispatchEvent(new CustomEvent('gravetide:promocode'));
    }, 8000);
  });
}

/** The tab's label. */
export const promoTabLabel = (): string => L('tab');
export const promoOpenLabel = (): string => L('open');
export const promoHint = (): string => L('hint');
