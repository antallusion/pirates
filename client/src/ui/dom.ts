// Tiny DOM helpers. All server-provided strings are escaped before being placed in markup.

import { assetUrl } from '../assets.ts';
import { lang } from '../i18n.ts';

export function $(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} missing`);
  return e;
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** A whole number the reader's way: 410,485 in English, 410 485 (a space that does not break) in Russian. */
export function fmt(n: number): string {
  return lang() === 'ru' ? Math.round(n).toLocaleString('en-US').replace(/,/g, '\u00a0') : Math.round(n).toLocaleString('en-US');
}

/** A number with one decimal: 2.5 in English, 2,5 in Russian. */
export function dec1(n: number): string {
  const s = n.toFixed(1);
  return lang() === 'ru' ? s.replace('.', ',') : s;
}

/** A number with two decimals (a multiplier): 1.40 in English, 1,40 in Russian. */
export function dec2(n: number): string {
  const s = n.toFixed(2);
  return lang() === 'ru' ? s.replace('.', ',') : s;
}

export function pct(v: number): string {
  return `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
}

export function bar(cls: string, frac: number): string {
  return `<div class="bar ${cls}"><i style="width:${pct(frac)}"></i></div>`;
}

export function knots(ms: number): string {
  // Game meters/second → displayed knots on the compressed world scale.
  return dec1(ms * 0.8);
}

/** Re-renders a panel without losing what the player is typing: values and focus survive by id or data key. */
export function keepInputs(root: HTMLElement, render: () => void): void {
  const key = (el: Element) => el.id || [...el.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-dirty').map((a) => `${a.name}=${a.value}`).join('&');
  const saved = new Map<string, string>();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && el.dataset.dirty) saved.set(k, el.value);
  });
  const active = document.activeElement && root.contains(document.activeElement) ? key(document.activeElement) : '';
  render();
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select').forEach((el) => {
    const k = key(el);
    if (k && saved.has(k)) {
      el.value = saved.get(k)!;
      el.dataset.dirty = '1';
      el.dispatchEvent(new Event('change'));
    }
    el.addEventListener('input', () => (el.dataset.dirty = '1'));
    el.addEventListener('change', () => (el.dataset.dirty = '1'));
    if (active && k === active) el.focus();
  });
}

/**
 * An icon from the art registry (`icon.<id>` by default), or the text glyph when the art has not loaded.
 * `cls` sizes it (`ico` inline with text, `ico-lg` in slots and tiles).
 */
/** While a picture is still being painted, a kindred one stands in (a row with no icon breaks its grid). */
const STAND_IN: Record<string, string> = {
  good_fish: 'build_fishing_village', good_prime_fish: 'build_fishing_village', good_smoked_fish: 'good_provisions', good_salted_fish: 'good_salt',
  good_tar: 'good_timber', good_scrimshaw: 'good_leviathan_bone', good_baleen: 'good_whale_oil', good_ambergris: 'good_spices',
  good_orca_tooth: 'good_leviathan_bone', good_whalebone: 'good_leviathan_bone', good_narwhal_tusk: 'good_leviathan_bone', good_shark_skin: 'good_cloth',
  good_serpent_scale: 'mod_serpent_scale', tattoo_needle: 'role_sailmaker', storm_heart: 'weather_storm',
  doubloon: 'coin', // the premium shop's coin: the silver coins, gilded by the stylesheet, until it is painted
};

/** A building as it stands (docs/12 P11): whole from 70% of its condition, worn below, a ruin under 35%; each
 *  stage falls back to the whole one while its picture is being painted. */
export function buildIcon(id: string, condition: number, cls = 'ico'): string {
  const stage = condition >= 0.7 ? 0 : condition >= 0.35 ? 2 : 1;
  return (stage && icon(`build_${id}_${stage}`, '', cls)) || icon(`build_${id}`, '', cls);
}

/** An outpost as it grows: a first camp at levels 1–2, a working post at 3–4, the full one at 5. */
export function outpostIcon(kind: string, level: number, cls = 'ico'): string {
  const stage = level >= 5 ? 0 : level >= 3 ? 2 : 1;
  return (stage && icon(`outpost_${kind}_${stage}`, '', cls)) || icon(`outpost_${kind}`, '', cls);
}

/** Faces still being painted, and who sits for them meanwhile (docs/12 P11). */
const PORTRAIT_STAND_IN: Record<string, string> = {
  giver_old_needle: 'giver_hermit_f', skipper_1: 'giver_bosun_m',
  // The island's residents by trade: a quest giver of the same trade sits for each meanwhile.
  res_fisher_m: 'giver_old_salt_m', res_fisher_f: 'giver_fishwife_f', res_carpenter_m: 'giver_shipwright_m', res_carpenter_f: 'giver_shipwright_f',
  res_smith_m: 'giver_shipwright_m', res_smith_f: 'giver_shipwright_f', res_cook_m: 'giver_tavern_keeper_m', res_cook_f: 'giver_widow_f',
  res_cartographer_m: 'giver_cartographer_m', res_cartographer_f: 'giver_cartographer_f', res_herbalist_m: 'giver_apothecary_m', res_herbalist_f: 'giver_apothecary_f',
  res_gunner_m: 'giver_garrison_captain_m', res_gunner_f: 'giver_fence_f', res_pilot_m: 'giver_lighthouse_keeper_m', res_pilot_f: 'giver_lighthouse_keeper_f',
};

// The 24 painted pirate faces stand in for one another's absence with the older faces (docs/12 P11).
const OLD_FACES = ['corsair', 'reaver', 'giver_smuggler_m', 'giver_smuggler_f', 'giver_fence_m', 'giver_fence_f', 'officer_iron_jaw', 'giver_bosun_m', 'giver_cultist_m', 'giver_hermit_m'];
for (let i = 0; i < 24; i++) PORTRAIT_STAND_IN[`pirate_${String(i).padStart(2, '0')}`] = OLD_FACES[i % OLD_FACES.length];

/** A face for a person known only by name (a turned skipper): one of the 24 pirate faces, the same each time. */
export function faceOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `pirate_${String(h % 24).padStart(2, '0')}`;
}

/** A portrait's picture, or its stand-in's while it is being painted. */
export function portraitUrl(id: string): string | null {
  return assetUrl(`portrait.${id}`) ?? (PORTRAIT_STAND_IN[id] ? assetUrl(`portrait.${PORTRAIT_STAND_IN[id]}`) : null);
}

export function icon(id: string, glyph = '', cls = 'ico'): string {
  const url = (id.startsWith('portrait.') ? portraitUrl(id.slice(9)) : assetUrl(id.includes('.') ? id : `icon.${id}`)) ?? (STAND_IN[id] ? assetUrl(`icon.${STAND_IN[id]}`) : null) ?? (id.startsWith('good_') ? assetUrl('icon.good_provisions') : null);
  return url ? `<img class="${cls}" src="${url}" alt="" draggable="false" />` : glyph ? `<span class="${cls} glyph">${esc(glyph)}</span>` : '';
}

/** A fish's painted icon (docs/12 P11, the catch sheet); the string of fish stands in for one not yet painted. */
export function fishIcon(id: string, cls = 'ico-sm'): string {
  return icon(`fish_${id}`, '', cls) || (assetUrl('icon.good_fish') ? icon('good_fish', '', cls) : '');
}

/** An officer's face: the unique officers have portraits, the rest the mark of their post. */
export function officerIcon(o: { role: string; unique?: string }, cls = 'ico-md'): string {
  return (o.unique ? icon(`portrait.officer_${o.unique}`, '', `${cls} ico-round`) : '') || icon(`role_${o.role}`, '', cls);
}

/** Silver as the game shows it everywhere: the coin and the sum. */
export function money(n: number): string {
  const sum = Number.isInteger(n) || Math.abs(n) >= 100 ? fmt(n) : dec1(n).replace(/[.,]0$/, '');
  return `<span class="money">${icon('coin', '⛁', 'ico-sm')}${sum}</span>`;
}

/** Experience: the navigator's star and the sum. */
export function xpBadge(n: number): string {
  return `<span class="xpv">${icon('xp', '✦', 'ico-sm')}${fmt(n)}</span>`;
}

const SUM = /(\d[\d,.  ]*\d|\d)\s*(серебра|серебро|серебром|silver)/gi;
const XP = /(\d[\d,.  ]*\d|\d)\s*(опыта|XP)/g;

/**
 * Every "N silver" and "N XP" written anywhere in a screen becomes the coin or the star with the sum — server
 * sentences, prices on buttons, letters — without each screen having to say so. Idempotent: a sum it has dressed
 * no longer matches.
 */
export function decorateSums(root: HTMLElement): void {
  const coin = assetUrl('icon.coin'), star = assetUrl('icon.xp');
  if (!coin || !star) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/серебр|silver|опыта|XP/i.test(n.nodeValue ?? '')) hits.push(n as Text);
  for (const t of hits) {
    if (t.parentElement?.closest('input, textarea, select, option, script, style, title')) continue;
    const plain = esc(t.nodeValue);
    const html = plain
      .replace(SUM, `<span class="money"><img class="ico-sm" src="${coin}" alt="" draggable="false">$1</span>`)
      .replace(XP, `<span class="xpv"><img class="ico-sm" src="${star}" alt="" draggable="false">$1</span>`);
    if (html === plain) continue;
    const box = document.createElement('span');
    box.innerHTML = html;
    t.replaceWith(...box.childNodes);
  }
}

/** Words in the language's own quotation marks: «Последний залп», “Last Broadside” (escaped). */
export function quote(s: string): string {
  return lang() === 'ru' ? `«${esc(s)}»` : `“${esc(s)}”`;
}
