// The campaign's word when its next quest comes (docs/36; owner, 2026-10-18: «кампанию брать не надо в портах, она сама
// должна идти и идти»): a toast and a short card «Новое задание кампании: …», or, at a fork, a card with its two ways to
// choose. Held while she fights (a boarding's deck, a fight ashore) and told once the fight is over — never over a battle.

import type { ServerMsg } from '../../../shared/src/protocol.ts';
import { dict } from '../i18n.ts';
import { EN, RU } from '../lang/ui/campaignbook.ts';
import { cmpText } from '../lang/server.ts';
import { esc } from './dom.ts';
import { openSheet } from './kit/sheet.ts';

const L = dict(EN, RU);

type News = Extract<ServerMsg, { t: 'campaign_new' }>;

export interface CampaignNewsHooks {
  /** She is in a fight now (the word waits). */
  busy(): boolean;
  toast(text: string): void;
  card(title: string, text: string): void;
  /** Her way at a fork. */
  choose(id: string): void;
}

const queue: News[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

/** The word of a new campaign quest (or a fork), told now or after the fight. */
export function campaignNews(m: News, h: CampaignNewsHooks): void {
  // one word a place: a newer one replaces an older one still waiting
  const i = queue.findIndex((x) => x.id === m.id);
  if (i >= 0) queue.splice(i, 1);
  queue.push(m);
  flush(h);
  if (queue.length && !timer) timer = setInterval(() => flush(h), 1500);
}

function flush(h: CampaignNewsHooks): void {
  if (h.busy()) return;
  while (queue.length) tell(queue.shift()!, h);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Waiting words (for the tests). */
export const newsWaiting = (): number => queue.length;

function tell(m: News, h: CampaignNewsHooks): void {
  const where = L('where', { ch: m.ch, n: m.k + 1, of: m.size });
  if (!m.choice?.length) {
    h.toast(L('newQuest', { name: cmpText(m.name) }));
    h.card(L('newQuest', { name: cmpText(m.name) }), `${where} · ${cmpText(m.text)}`);
    return;
  }
  // a fork: its two ways, each with its words; closed without a choice, it waits in the journal and «Цели и вести»
  const body = `<div class="cn-fork"><p class="muted">${esc(where)}</p>${m.choice.map((w) => `<div class="cn-way"><b>${esc(cmpText(w.label || w.name))}</b><p>${esc(cmpText(w.text))}</p>
    <button type="button" class="btn btn-small btn-primary" data-cway="${esc(w.id)}">${esc(L('choose'))}</button></div>`).join('')}</div>`;
  const sheet = openSheet({ title: L('fork'), body, height: 'auto', cls: 'cn-sheet' });
  sheet.panel.querySelectorAll<HTMLElement>('[data-cway]').forEach((b) => b.addEventListener('click', () => {
    h.choose(b.dataset.cway!);
    sheet.close('button');
  }));
}
