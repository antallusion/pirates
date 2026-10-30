// The cosmetics on the client (owner, 2026-10-19; docs/32 §12, shared/src/data/cosmetics.ts): the shop's
// «Косметика» tab (its six shelves, each thing with a preview — the plate with its words, the frame round her own
// portrait, the flag on a little ship, the trail moving, the emotes), the wardrobe (what she owns, worn with a tap; from
// the tab and the captain's screen), the frame round a portrait anywhere (HUD, chat, cards, tables) and the quick
// emotes. Buying goes the shop's own way (premium.ts `data-shbuy`: the price in roubles or Stars first, the doubloons
// beside it, the top-up first when short).

import { detailAttr } from './detailattr.ts'; // the detail card (owner, 2026-10-30)
import {
  BUNDLES, CLOTHS, COS_EMOTES, EMBLEMS, EMOTE_PACKS, FRAMES, PLATES, TITLES, TRAILS, bundleWorth, cosItem, cosKey, expandKeys, frameOf, titleOf,
} from '../../../shared/src/data/cosmetics.ts';
import type { CosEarn, CosEquip, CosItem, EmoteDef, FrameDef } from '../../../shared/src/data/cosmetics.ts';
import { OFFERS } from '../../../shared/src/data/shop.ts';
import type { ShopSec } from '../../../shared/src/data/shop.ts';
import type { ShopView } from '../../../shared/src/premiumproto.ts';
import type { CosView } from '../../../shared/src/cosproto.ts';
import { CAPTAINS } from '../../../shared/src/data/captains.ts';
import { SHIP_CLASSES } from '../../../shared/src/data/ships.ts';
import type { ClientMsg } from '../../../shared/src/protocol.ts';
import { assetUrl, sprite } from '../assets.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/cosmetics.ts';
import type { ClientState } from '../state.ts';
import { TrailPool, drawWavingFlag, flagCloth, plateCanvas } from '../render/cosdraw.ts';
import { esc, fmt, icon } from './dom.ts';
import { avatar } from './kit/avatar.ts';
import { offerBtn } from './premium.ts';
import { chipRow } from './kit/window.ts';
import { priceHtml } from './price.ts';

const L = dict(EN, RU);
const T = (x: readonly [string, string]) => x[lang() === 'ru' ? 1 : 0];

// ------------------------------------------------------------------------------------------------ the frame anywhere

/** A face in its frame (docs/32 §12): a portrait (a captain's id or a picture's url) in her frame, or in the stock
 *  ring when none is worn — kit/avatar.ts, the one avatar (the box `px` wide never shrinks; the frame, its hole and
 *  the portrait are shares of it). */
export function framedFace(face: { id: string; url: string | null }, frameId: string | null | undefined, px?: number): string {
  return avatar({ face: face.id, url: face.url, frame: frameId, size: px ? `${px}px` : undefined, cls: 'cos-av' });
}

/** Her own face (her captain's portrait). */
function ownFace(state: ClientState): { id: string; url: string | null } {
  const cap = state.self ? CAPTAINS[state.self.captain] : null;
  return { id: cap?.portrait ?? '', url: cap ? assetUrl(cap.portrait) : null };
}

// ------------------------------------------------------------------------------------------------ the previews

/** The animated previews of the open window: one loop for every `canvas[data-cosprev]` on the page. */
let loop = 0;
const pools = new WeakMap<HTMLCanvasElement, { pool: TrailPool; x: number; t: number }>();

function drawPreviews(root: HTMLElement, state: ClientState): void {
  cancelAnimationFrame(loop);
  let last = performance.now();
  const frame = (now: number) => {
    if (!root.isConnected || !root.querySelector('canvas[data-cosprev]')) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    root.querySelectorAll<HTMLCanvasElement>('canvas[data-cosprev]').forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || r.width === 0) return; // off the page: not drawn
      previewShip(c, state, dt);
    });
    loop = requestAnimationFrame(frame);
  };
  loop = requestAnimationFrame(frame);
}

/** A little ship on a dark sea, bow to the right, under way: her flag (`data-emblem`, `data-cloth`), her trail
 *  (`data-trail`), her plate (`data-plate`, `data-title`). */
function previewShip(c: HTMLCanvasElement, state: ClientState, dt: number): void {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sea = g.createLinearGradient(0, 0, 0, h);
  sea.addColorStop(0, '#0d1b22');
  sea.addColorStop(1, '#071015');
  g.fillStyle = sea;
  g.fillRect(0, 0, w, h);
  const d = c.dataset;
  let st = pools.get(c);
  if (!st) pools.set(c, (st = { pool: new TrailPool(), x: 0, t: Math.random() * 10 }));
  st.t += dt;
  const cls = SHIP_CLASSES[state.self?.loadout.classId ?? 'sloop'] ?? SHIP_CLASSES.sloop;
  const plateOn = !!(d.plate && d.title);
  const len = Math.min(w * 0.5, (h - (plateOn ? 36 : 8)) * 1.6);
  const k = len / cls.length; // px a world unit
  const cx = w * 0.56, cy = plateOn ? h * 0.62 : h * 0.52;
  // the sea goes by: little caps of foam drifting left
  g.fillStyle = 'rgba(160,190,200,0.12)';
  for (let i = 0; i < 9; i++) {
    const x = ((i * 97 + 40 - st.t * 26) % (w + 40) + w + 40) % (w + 40) - 20;
    g.fillRect(x, (i * 53) % h, 6, 1);
  }
  // the trail: the ship sails east in the pool's own sea, the picture follows her
  if (d.trail) {
    st.x += cls.maxSpeed * 0.8 * dt;
    st.pool.emit(1, d.trail, st.x, 0, Math.PI / 2, 0.85, cls.length, cls.beam, dt, false);
    st.pool.step(dt);
    st.pool.draw(g, (x) => cx + (x - st!.x) * k, (y) => cy + y * k, k, w, h, 0.32);
  }
  const spr = sprite(cls.sprite);
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.PI / 2);
  if (spr) {
    const ih = len / spr.extentY;
    const iw = ih * (spr.img.naturalWidth / Math.max(1, spr.img.naturalHeight));
    g.drawImage(spr.img, -iw * spr.cx, -ih * spr.cy, iw, ih);
  }
  if (d.emblem) {
    const cloth = flagCloth(d.emblem, d.cloth ?? 'black');
    if (cloth) {
      // (larger than at sea — a preview: the emblem must read on the shop's card)
      const big = d.big === '1';
      const fw = Math.min(h * (big ? 0.8 : 0.5), cls.beam * k * 0.62 * (big ? 3.2 : 1.8)), fh = fw * 0.66;
      g.translate(0, -len * 0.18);
      g.rotate(Math.PI / 2 + Math.sin(st.t * 3) * 0.06);
      drawWavingFlag(g, cloth, fw, fh, st.t, 1);
      g.fillStyle = 'rgba(30,22,14,0.9)';
      g.fillRect(-0.6, -fh * 0.6, 1.2, fh * 1.2);
    }
  }
  g.restore();
  if (plateOn) {
    const t = titleOf(d.title);
    const p = t ? plateCanvas(d.plate!, T(t.name), dpr, 28) : null;
    if (p) {
      const pw = p.width / Math.max(1, Math.min(3, Math.round(dpr * 2) / 2)), ph = p.height / Math.max(1, Math.min(3, Math.round(dpr * 2) / 2));
      g.drawImage(p, cx - pw / 2, 4, pw, ph);
    }
  }
}

/** A plate with its words, as a DOM picture (a canvas drawn once, its picture loaded first). */
function plateBox(plateId: string, titleId: string, cls = 'cos-plate'): string {
  return `<canvas class="${cls}" data-plate="${esc(plateId)}" data-title="${esc(titleId)}"></canvas>`;
}

/** A plate with its words for any window (drawn by `drawPlatesIn` once it is on the page). */
export function plateHtml(plateId: string, titleId: string): string {
  return plateBox(plateId, titleId, 'cos-plate cos-plate-card');
}

/** The plates on the page drawn (and again once their pictures come in). */
export function drawPlatesIn(root: HTMLElement): void {
  drawPlates(root);
}

function drawPlates(root: HTMLElement): void {
  let left = 0;
  root.querySelectorAll<HTMLCanvasElement>('canvas.cos-plate').forEach((c) => {
    const t = titleOf(c.dataset.title);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const p = t ? plateCanvas(c.dataset.plate!, T(t.name), dpr, 30) : null;
    if (!p) {
      left++;
      return;
    }
    if (c.dataset.drawn === '1') return;
    c.dataset.drawn = '1';
    c.width = p.width;
    c.height = p.height;
    c.style.aspectRatio = `${p.width} / ${p.height}`;
    c.getContext('2d')!.drawImage(p, 0, 0);
  });
  if (left) setTimeout(() => root.isConnected && drawPlates(root), 300);
}

// ------------------------------------------------------------------------------------------------ the cards

/** A thing's state for her: worn, hers, for sale, earned (with her road to it), a bundle's own. */
function statusOf(x: CosItem, v: CosView): 'worn' | 'own' | 'buy' | 'earn' | 'only' {
  const k = cosKey(x);
  if (v.own.includes(k)) {
    const slot = x.kind === 'emote' ? null : (x.kind as keyof CosEquip);
    return slot && v.eq[slot] === x.id ? 'worn' : 'own';
  }
  return x.earn ? 'earn' : x.only ? 'only' : 'buy';
}

function earnText(e: CosEarn, v: CosView): string {
  switch (e.k) {
    case 'level': return L('earn.level', { n: e.n, a: v.stats.level });
    case 'campaign': return L('earn.campaign', { n: v.stats.campaignSize, a: v.stats.campaign });
    case 'boarded': return L('earn.boarded', { n: e.n, a: v.stats.boarded });
    case 'arena': return L('earn.arena', { n: e.rating, a: v.stats.arena || '—' });
  }
}

function earnPct(e: CosEarn, v: CosView): number {
  const p = e.k === 'level' ? v.stats.level / e.n : e.k === 'campaign' ? v.stats.campaign / Math.max(1, v.stats.campaignSize) : e.k === 'boarded' ? v.stats.boarded / e.n : v.stats.arena / e.rating;
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

/** The card's foot: wear / worn / its price / the road to earn it / the bundle it comes in. */
function foot(x: CosItem, v: CosView, sv: ShopView, offerId: string): string {
  const s = statusOf(x, v);
  const slot = x.kind as keyof CosEquip;
  if (s === 'worn') return `<button type="button" class="btn btn-small cos-worn" data-cosoff="${slot}">${esc(L('worn'))} ✓</button>`;
  if (s === 'own') return x.kind === 'emote' ? `<span class="cos-own">${esc(L('own'))}</span>` : `<button type="button" class="btn btn-small btn-primary" data-coswear="${slot}" data-id="${esc(x.id)}">${esc(L('wear'))}</button>`;
  if (s === 'earn') return `<span class="cos-earn" title="${esc(earnText(x.earn!, v))}"><small>${esc(earnText(x.earn!, v))}</small><i class="cos-bar"><b style="width:${earnPct(x.earn!, v)}%"></b></i></span>`;
  if (s === 'only') {
    if (x.only === 'pvp_season') return `<span class="cos-only">${esc(L('onlyPvp'))}</span>`; // pvprank.ts
    // the season card's own (owner, 2026-10-30): its tiers, the Super Pass's frame
    if (x.only === 'spass' || x.only === 'spass_super') return `<span class="cos-only">${esc(L(x.only === 'spass' ? 'onlyPass' : 'onlySuper'))}</span>`;
    const b = BUNDLES.find((y) => y.id === x.only);
    return `<span class="cos-only">${esc(L('only', { b: b ? T(b.name) : '' }))}</span>`;
  }
  const f = OFFERS.get(offerId);
  return f ? offerBtn(f.fam, f.offer, sv) : '';
}

const tierCls = (x: { tier: number }) => `cos-t${x.tier}`;

function card(x: CosItem, preview: string, v: CosView, sv: ShopView, offerId: string, extra = '', prevCls = ''): string {
  return `<div class="cos-card ${tierCls(x)}${statusOf(x, v) === 'worn' ? ' worn' : ''}" data-cos="${esc(cosKey(x))}"${detailAttr(`cos:${cosKey(x)}`)}><div class="cos-prev${prevCls ? ` ${prevCls}` : ''}">${preview}</div>
    <div class="cos-txt"><b class="cos-name">${esc(T(x.name))}</b><small class="cos-tier">${esc(L(`tier${Math.min(4, x.tier)}` as 'tier0'))}${extra}</small></div>
    <div class="cos-foot">${foot(x, v, sv, offerId)}</div></div>`;
}

/** Her title's words and plate for a preview (what she wears, else the free ones). */
const herTitle = (v: CosView) => v.eq.title ?? 'seawolf';
const herPlate = (v: CosView) => v.eq.plate ?? 'driftwood';

function shipPrev(o: { emblem?: string | null; cloth?: string | null; trail?: string | null; plate?: string | null; title?: string | null; big?: boolean }, cls = 'cos-ship'): string {
  const a = (k: string, x?: string | null) => (x ? ` data-${k}="${esc(x)}"` : '');
  return `<canvas class="${cls}" data-cosprev${a('emblem', o.emblem)}${a('cloth', o.cloth)}${a('trail', o.trail)}${a('plate', o.plate)}${a('title', o.title)}${o.big ? ' data-big="1"' : ''}></canvas>`;
}

function emoteImg(e: EmoteDef, cls = 'cos-emo'): string {
  return icon(`cos.emote_${e.id}`, '☺', cls);
}

/** The «Косметика» tab's shelf. */
export function cosShelf(sec: ShopSec, state: ClientState, sv: ShopView): string {
  const v = state.cos;
  if (!v) return `<p class="muted sh-rule">…</p>`;
  const lead = `<div class="cos-lead"><p class="muted">${esc(L('lead'))}</p><button type="button" class="btn btn-small btn-primary cos-wbtn" data-coswardrobe>${icon('cos_frames', '', 'ico-sm')}${esc(L('wardrobe'))}</button></div>`;
  const grid = (cards: string[]) => `<div class="cos-grid">${cards.join('')}</div>`;
  const head = (k: keyof typeof EN) => `<h4 class="cos-h">${esc(L(k))}</h4>`;
  switch (sec) {
    case 'cos_titles':
      return `${lead}${head('g.titles')}${grid(TITLES.map((t) => card(t, plateBox(herPlate(v), t.id), v, sv, `cos_title_${t.id}`)))}${head('g.plates')}${grid(PLATES.map((p) => card(p, plateBox(p.id, herTitle(v)), v, sv, `cos_plate_${p.id}`)))}`;
    case 'cos_frames':
      return `${lead}${grid(FRAMES.map((f) => card(f, framedFace(ownFace(state), f.id), v, sv, `cos_frame_${f.id}`, '', 'cos-prev-fr')))}`;
    case 'cos_flags':
      return `${lead}${head('g.emblems')}${grid(EMBLEMS.map((e) => card(e, shipPrev({ emblem: e.id, cloth: v.eq.cloth ?? 'black', big: true }), v, sv, `cos_emblem_${e.id}`)))}${head('g.cloths')}${grid(CLOTHS.map((c) => card(c, shipPrev({ emblem: v.eq.emblem ?? 'anchor', cloth: c.id, big: true }), v, sv, `cos_cloth_${c.id}`, ` · <i class="cos-sw" style="background:${c.rgb}"></i>`)))}`;
    case 'cos_trails':
      return `${lead}${grid(TRAILS.map((t) => card(t, shipPrev({ trail: t.id, emblem: v.eq.emblem, cloth: v.eq.cloth }), v, sv, `cos_trail_${t.id}`)))}`;
    case 'cos_emotes': {
      const mine = COS_EMOTES.filter((e) => !e.pack);
      const packs = EMOTE_PACKS.map((p) => {
        const list = COS_EMOTES.filter((e) => e.pack === p.id);
        const owned = list.every((e) => v.own.includes(cosKey(e)));
        const f = OFFERS.get(`cos_pack_${p.id}`);
        return `<div class="cos-card cos-pack cos-t${p.tier}"><div class="cos-prev cos-emos">${list.map((e) => `<span title="${esc(T(e.name))}">${emoteImg(e)}</span>`).join('')}</div>
          <div class="cos-txt"><b class="cos-name">${esc(T(p.name))}</b><small class="cos-tier">${esc(L('pack'))}</small></div>
          <div class="cos-foot">${owned ? `<span class="cos-own">${esc(L('own'))}</span>` : f ? offerBtn(f.fam, f.offer, sv) : ''}</div></div>`;
      });
      return `${lead}${head('g.packs')}<div class="cos-grid">${packs.join('')}</div>${head('g.emotes')}${grid(mine.map((e) => card(e, emoteImg(e, 'cos-emo-lg'), v, sv, '')))}`;
    }
    case 'cos_sets':
      return `${lead}<div class="cos-grid cos-sets">${BUNDLES.map((b) => bundleCard(b, v, sv)).join('')}</div>`;
    default:
      return lead;
  }
}

function bundleCard(b: (typeof BUNDLES)[number], v: CosView, sv: ShopView): string {
  const f = OFFERS.get(b.id);
  if (!f) return '';
  const keys = expandKeys(b.keys);
  const all = keys.every((k) => v.own.includes(k));
  const why = sv.why[b.id];
  if (why === 'limit' && b.once) return '';
  const thumbs = b.keys.map((k) => {
    if (k.startsWith('pack:')) {
      const p = EMOTE_PACKS.find((x) => x.id === k.slice(5));
      const e = COS_EMOTES.find((x) => x.pack === p?.id);
      return e ? `<span class="cos-th" title="${esc(p ? T(p.name) : '')}">${emoteImg(e, 'cos-th-i')}</span>` : '';
    }
    const x = cosItem(k);
    if (!x) return '';
    const art = x.kind === 'plate' ? `cos.plate_${x.id}` : x.kind === 'frame' ? `cos.frame_${x.id}` : x.kind === 'emblem' ? `cos.emblem_${x.id}` : x.kind === 'trail' ? `trail_${x.id}` : x.kind === 'title' ? 'cos_titles' : x.kind === 'cloth' ? null : null;
    const own = v.own.includes(k) ? ' own' : '';
    // (a cloth: its painted bolt, icon.cloth_<id> — its swatch if the picture is missing)
    return x.kind === 'cloth'
      ? `<span class="cos-th${own}" title="${esc(T(x.name))}">${icon(`cloth_${x.id}`, '', 'cos-th-i') || `<i class="cos-sw" style="background:${CLOTHS.find((c) => c.id === x.id)?.rgb ?? '#000'}"></i>`}</span>`
      : `<span class="cos-th${own}${x.kind === 'emblem' ? ' emb' : ''}" title="${esc(T(x.name))}">${art ? icon(art, '◆', 'cos-th-i') : ''}</span>`;
  }).join('');
  const words = b.keys.map((k) => (k.startsWith('pack:') ? EMOTE_PACKS.find((p) => p.id === k.slice(5))?.name : cosItem(k)?.name)).filter(Boolean).map((n) => T(n!)).join(' · ');
  const clock = b.until && why !== 'gone' ? `<span class="cos-clock">${esc(L('ends'))}: <b data-shend="${b.until}"></b></span>` : why === 'gone' && b.from && sv.now < b.from ? `<span class="cos-clock">${esc(L('from', { d: new Date(b.from).toLocaleDateString(lang() === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long' }) }))}</span>` : why === 'gone' ? `<span class="cos-clock">${esc(L('gone'))}</span>` : '';
  const worth = bundleWorth(b);
  return `<div class="cos-card cos-set${why === 'gone' ? ' shut' : ''}">${icon(b.icon, '◆', 'cos-set-i')}
    <div class="cos-txt"><b class="cos-name">${esc(T(b.name))}</b><small class="cos-note">${esc(T(b.text))}</small>
      <div class="cos-ths" title="${esc(words)}">${thumbs}</div>${clock}</div>
    <div class="cos-foot">${all ? `<span class="cos-own">${esc(L('all'))}</span>` : `${offerBtn(f.fam, f.offer, sv, { ribbon: `×${(Math.round((worth / b.price) * 10) / 10).toString().replace('.', lang() === 'ru' ? ',' : '.')}` })}<s class="cos-was" title="${esc(L('worth', { n: fmt(worth) }))}">${priceHtml(worth)}</s>`}</div></div>`;
}

// ------------------------------------------------------------------------------------------------ the wardrobe

type WSlot = keyof CosEquip | 'emotes';
let wslot: WSlot = 'title';

/** The wardrobe: her ship as others see it (the plate, the flag, the trail), her face in its frame, and for each slot
 *  what she owns, worn with a tap. */
export function wardrobe(state: ClientState): string {
  const v = state.cos;
  if (!v) return '<p class="muted">…</p>';
  const eq = v.eq;
  const slots: WSlot[] = ['title', 'plate', 'frame', 'emblem', 'cloth', 'trail', 'emotes'];
  const SLOT_ICON: Record<WSlot, string> = { title: 'cos_titles', plate: 'cos_titles', frame: 'cos_frames', emblem: 'cos_flags', cloth: 'cos_flags', trail: 'cos_trails', emotes: 'cos_emotes' };
  const chips = chipRow(slots.map((s) => ({ id: s, icon: SLOT_ICON[s], label: L(`sl.${s}` as 'sl.title') })), wslot, 'cosslot');
  const owned = <X extends CosItem>(list: readonly X[]) => list.filter((x) => v.own.includes(cosKey(x)));
  const opt = (slot: keyof CosEquip, x: CosItem, inner: string) => `<button type="button" class="cos-opt${eq[slot] === x.id ? ' on' : ''}" data-coswear="${slot}" data-id="${esc(x.id)}" title="${esc(T(x.name))}">${inner}<small>${esc(T(x.name))}</small></button>`;
  const offBtn = (slot: keyof CosEquip) => `<button type="button" class="cos-opt cos-none${eq[slot] ? '' : ' on'}" data-cosoff="${slot}"><svg class="cos-none-i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.5 17.5 17.5 6.5" stroke="currentColor" stroke-width="2"/></svg><small>${esc(L('none'))}</small></button>`;
  let list = '';
  switch (wslot) {
    case 'title': list = offBtn('title') + owned(TITLES).map((t) => opt('title', t, plateBox(eq.plate ?? 'driftwood', t.id, 'cos-plate cos-plate-sm'))).join(''); break;
    case 'plate': list = offBtn('plate') + owned(PLATES).map((p) => opt('plate', p, plateBox(p.id, eq.title ?? 'seawolf', 'cos-plate cos-plate-sm'))).join(''); break;
    case 'frame': list = offBtn('frame') + owned(FRAMES).map((f) => opt('frame', f, framedFace(ownFace(state), f.id))).join(''); break;
    case 'emblem': list = offBtn('emblem') + owned(EMBLEMS).map((e) => opt('emblem', e, `<span class="cos-embl" style="background:${CLOTHS.find((c) => c.id === (eq.cloth ?? 'black'))?.rgb}">${icon(`cos.emblem_${e.id}`, '◆', 'cos-embl-i')}</span>`)).join(''); break;
    case 'cloth': list = offBtn('cloth') + owned(CLOTHS).map((c) => opt('cloth', c, `<i class="cos-sw cos-sw-lg" style="background:${c.rgb}"></i>`)).join(''); break;
    case 'trail': list = offBtn('trail') + owned(TRAILS).map((t) => opt('trail', t, `<i class="cos-sw cos-sw-lg cos-trail-sw" style="background:radial-gradient(circle, ${t.c[0]}, ${t.c[1]} 45%, transparent 72%)"></i>`)).join(''); break;
    case 'emotes': list = owned(COS_EMOTES).map((e) => `<span class="cos-opt cos-emo-own" title="${esc(T(e.name))}">${emoteImg(e)}<small>${esc(T(e.name))}</small></span>`).join(''); break;
  }
  const t = titleOf(eq.title);
  return `<div class="cos-wr">
    <div class="cos-wr-look">${shipPrev({ emblem: eq.emblem, cloth: eq.cloth, trail: eq.trail, plate: eq.plate, title: eq.title }, 'cos-ship cos-ship-lg')}
      <div class="cos-wr-me">${framedFace(ownFace(state), eq.frame)}<span><b>${esc(state.self?.name ?? '')}</b><small class="muted">${esc(t ? T(t.name) : L('wardrobe.sub'))}</small></span></div></div>
    <div class="cos-wr-pick"><div class="cos-wr-chips">${chips}</div><p class="muted cos-tip">${esc(L('tip'))}</p><div class="cos-opts">${list}</div></div>
  </div>`;
}

// ------------------------------------------------------------------------------------------------ wiring

/** The tab's and the wardrobe's buttons (the shop's `data-shbuy` are wired by premium.ts). */
export function wireCos(root: HTMLElement, state: ClientState, send: (m: ClientMsg) => void, o: { openWardrobe: () => void; redraw: () => void }): void {
  root.querySelectorAll<HTMLElement>('[data-coswear]').forEach((b) => (b.onclick = () => send({ t: 'cos', action: 'equip', slot: b.dataset.coswear as keyof CosEquip, id: b.dataset.id! })));
  root.querySelectorAll<HTMLElement>('[data-cosoff]').forEach((b) => (b.onclick = () => send({ t: 'cos', action: 'equip', slot: b.dataset.cosoff as keyof CosEquip, id: null })));
  root.querySelectorAll<HTMLElement>('[data-coswardrobe]').forEach((b) => (b.onclick = () => o.openWardrobe()));
  root.querySelectorAll<HTMLElement>('[data-cosslot]').forEach((b) => (b.onclick = () => {
    wslot = b.dataset.cosslot as WSlot;
    o.redraw();
  }));
  drawPlates(root);
  drawPreviews(root, state);
}

// ------------------------------------------------------------------------------------------------ quick emotes

/** Her own emotes for the quick button and the chat's picker (the free two first). */
export function ownEmotes(state: ClientState): EmoteDef[] {
  const v = state.cos;
  if (!v) return COS_EMOTES.filter((e) => e.price === 0);
  return COS_EMOTES.filter((e) => v.own.includes(cosKey(e)));
}

/** The quick emotes' panel (the HUD's button and the chat's): her own, a tap sends one; «Ещё в лавке». */
export function emotePanel(state: ClientState): string {
  const mine = ownEmotes(state);
  return `<div class="cos-qe" role="menu"><div class="cos-qe-row">${mine.map((e) => `<button type="button" class="cos-qe-b" data-cosemote="${e.id}" title="${esc(T(e.name))}" aria-label="${esc(T(e.name))}">${emoteImg(e, 'cos-qe-i')}</button>`).join('')}</div>
    <button type="button" class="btn btn-small cos-qe-more" data-cosmore>${icon('cos_emotes', '', 'ico-xs')}${esc(L('quick.more'))}</button></div>`;
}

/** An emote's name in her language (a chat line's caption). */
export function emoteName(id: string): string {
  const e = COS_EMOTES.find((x) => x.id === id);
  return e ? T(e.name) : id;
}

export { L as cosL };

/** The quick emote button by the chat's (docs/32 §12): a round button under it; a tap opens her emotes beside it, a tap
 *  on one sends it over her ship (the server keeps the pace and says so). */
export function mountQuickEmotes(state: ClientState, send: (m: ClientMsg) => void, openShop: () => void): void {
  const host = document.getElementById('hud-chat');
  if (!host || document.getElementById('cos-qbtn')) return;
  const btn = document.createElement('button');
  btn.id = 'cos-qbtn';
  btn.type = 'button';
  btn.className = 'cos-qbtn';
  btn.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.id = 'cos-qpanel';
  panel.className = 'cos-qpanel hidden';
  host.append(btn, panel);
  const face = () => {
    const url = assetUrl('cos.emote_parrot');
    btn.innerHTML = url ? `<img class="cos-qbtn-i" src="${url}" alt="" draggable="false" />` : '';
    btn.setAttribute('aria-label', L('quick'));
    btn.title = L('quick');
  };
  face();
  // (the manifest may come after the HUD: the button's picture once it does)
  const wait = setInterval(() => {
    if (btn.querySelector('img')) return clearInterval(wait);
    face();
  }, 1000);
  let cool = 0;
  const close = () => {
    panel.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.onclick = () => {
    const open = panel.classList.contains('hidden');
    if (!open) return close();
    face();
    panel.innerHTML = emotePanel(state);
    panel.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    panel.querySelectorAll<HTMLButtonElement>('[data-cosemote]').forEach((b) => (b.onclick = () => {
      if (performance.now() < cool) return;
      cool = performance.now() + 600;
      send({ t: 'cos', action: 'emote', id: b.dataset.cosemote! });
      close();
    }));
    panel.querySelector<HTMLElement>('[data-cosmore]')?.addEventListener('click', () => {
      close();
      openShop();
    });
  };
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('hidden')) return;
    const t = e.target as Node;
    if (!panel.contains(t) && !btn.contains(t)) close();
  }, true);
}
