// An encounter's card (docs/12 P2): the title and the scene, the captain's choices, and then what came of it. It
// opens over the sea without stopping it; a thing that simply happens shows its outcome at once.

import { ENCOUNTERS } from '../../../shared/src/data/encounters.ts';
import type { EncounterId } from '../../../shared/src/data/encounters.ts';
import { GOODS } from '../../../shared/src/data/goods.ts';
import type { GoodId } from '../../../shared/src/data/goods.ts';
import { RARITY_COLOR, itemName } from '../../../shared/src/data/items.ts';
import type { Item } from '../../../shared/src/data/items.ts';
import type { ClientMsg, EncounterView } from '../../../shared/src/protocol.ts';
import { dict, lang } from '../i18n.ts';
import { esc, money } from './dom.ts';
import { assetUrl } from '../assets.ts';

/** Encounters without a painting of their own that borrow a kindred one. */
const ENC_ART: Record<string, string> = { convict: 'raft', fishermen: 'raft', deserters: 'raft', mapmaker: 'raft', peddler: 'smuggler', pilot: 'signal_fire', bird_shoal: 'albatross', wisps: 'voice_in_fog', bottle: 'sunken_bell', barrel: 'sunken_bell', ambush: 'smuggler', patrol_search: 'derelict' };
/** The rest are set against their kind's sea, dimmed, as a mood rather than a picture of the thing. */
const GROUP_ART: Record<string, string> = { people: 'pilgrims', finds: 'sunken_bell', nature: 'glowing_sea', danger: 'albatross', mystic: 'voice_in_fog' };

const L = dict({ ok: 'So be it', close: 'Close' }, { ok: 'Так тому и быть', close: 'Закрыть' });
const ru = () => (lang() === 'ru' ? 1 : 0);

export interface EncounterResult {
  id: number;
  def: EncounterId;
  outcome: string;
  vars: { n?: number; silver?: number; good?: GoodId; item?: Item };
}

/** The words of an outcome with its numbers put in (the good and the item in the reader's language). */
export function outcomeHtml(r: EncounterResult): string {
  const t = ENCOUNTERS[r.def].outcomes[r.outcome]?.[ru()] ?? '';
  const v = r.vars;
  return esc(t).replace(/\{(\w+)\}/g, (_, k: string) => {
    if (k === 'n') return String(v.n ?? 0);
    if (k === 'silver') return money(v.silver ?? 0);
    if (k === 'good') return v.good ? esc(GOODS[v.good].name.toLowerCase()) : '';
    if (k === 'item') return v.item ? `<b style="color:${RARITY_COLOR[v.item.rarity]}">${esc(itemName(v.item, ru() === 1))}</b>` : '';
    return '';
  });
}

export class EncounterCard {
  private el: HTMLElement;
  private shown: number | null = null;
  private hideAt = 0;

  private send: (m: ClientMsg) => void;

  constructor(send: (m: ClientMsg) => void) {
    this.send = send;
    this.el = document.getElementById('encounter')!;
  }

  /** The card's picture (docs/12 P11): the twenty key encounters are painted; a few others borrow a kindred scene. */
  private art(def: string): string {
    const own = assetUrl(`card.enc_${ENC_ART[def] ?? def}`);
    const mood = own ? null : assetUrl(`card.enc_${GROUP_ART[ENCOUNTERS[def as keyof typeof ENCOUNTERS]?.group] ?? ''}`);
    const url = own ?? mood;
    return url ? `<div class="enc-art${mood ? ' enc-mood' : ''}" style="background-image:url('${url}')"></div>` : '';
  }

  /** A card opens (or closes, when it lapses). */
  open(view: EncounterView | null): void {
    if (!view) {
      this.close();
      return;
    }
    const d = ENCOUNTERS[view.def];
    this.shown = view.id;
    this.hideAt = 0;
    this.el.innerHTML = `<div class="enc-card">${this.art(view.def)}<div class="enc-h">${esc(d.title[ru()])}</div><p class="enc-text">${esc(d.text[ru()])}</p>
      <div class="enc-choices">${d.choices.map((c) => `<button class="btn btn-small" data-enc="${esc(c.id)}">${esc(c.label[ru()])}</button>`).join('')}</div></div>`;
    this.el.classList.remove('hidden');
    this.el.querySelectorAll<HTMLElement>('[data-enc]').forEach((b) => (b.onclick = () => {
      this.el.querySelectorAll<HTMLButtonElement>('[data-enc]').forEach((x) => (x.disabled = true));
      this.send({ t: 'encounter', id: view.id, choice: b.dataset.enc! });
    }));
  }

  /** What came of it: shown on the card (or on a card of its own, for a thing that simply happened). */
  result(r: EncounterResult): void {
    const d = ENCOUNTERS[r.def];
    this.shown = r.id;
    this.el.innerHTML = `<div class="enc-card">${this.art(r.def)}<div class="enc-h">${esc(d.title[ru()])}</div>${d.choices.length ? '' : `<p class="enc-text">${esc(d.text[ru()])}</p>`}
      <p class="enc-out">${outcomeHtml(r)}</p><div class="enc-choices"><button class="btn btn-small btn-primary" data-enc-ok>${esc(L(d.choices.length ? 'close' : 'ok'))}</button></div></div>`;
    this.el.classList.remove('hidden');
    this.el.querySelector<HTMLElement>('[data-enc-ok]')!.onclick = () => this.close();
    this.hideAt = performance.now() + 9000;
  }

  close(): void {
    this.shown = null;
    this.el.classList.add('hidden');
    this.el.innerHTML = '';
  }

  /** Called every frame: an outcome fades by itself after a while. */
  frame(): void {
    if (this.hideAt && performance.now() > this.hideAt) {
      this.hideAt = 0;
      this.close();
    }
  }

  get open_(): boolean {
    return this.shown !== null;
  }
}
