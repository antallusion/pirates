// The players' chat (docs/28; owner, 2026-09-30: "a chat for players, show player icons, make chat icons from our
// pictures"; 2026-10-11: «он должен быть суперудобный даже на мобиле … у капитанов ники и иконки должны быть, можно
// отправлять специфические "смайлики" игровые из наших ассетов … и приватные сообщения тоже … чат должен на мобилке быть
// удобный, его надо какой-то иконкой открывать-закрывать, чтобы uix не рушился»).
//  - A round button with the count of unread (private words, the group, the guild; a dot for the world) opens and
//    closes a sheet: on a phone held sideways it slides over the right side (the helm and the sea stay to the left), a
//    swipe right, the button or Esc folds it away; on a desk it is a small panel docked left or right.
//  - Tabs for the channels (the world, the ships nearby, the group, the guild, private words) with their unread.
//  - Each line: the captain's face in a brass ring, the name in the colour of what she is to you, her guild's tag and
//    level, the server's time; a tap on the face or the name opens her card (write privately, invite, befriend, hide,
//    block, report).
//  - Emotes from the game's own icons: a picker in four groups and `:code:` with an autocomplete after «:».
//  - Everything escaped; links stay words, but our own domain's.

import { esc, faceOf, icon, portraitUrl } from './dom.ts';
import { sagaCardHtml } from './saga.ts';
import { dict, lang } from '../i18n.ts';
import { EN, RU } from '../lang/ui/chat.ts';
import { FACTIONS } from '../../../shared/src/data/factions.ts';
import { CHAT_MAX, EMOTE_GROUPS, EMOTES, LINK_RE, chatParts, emoteSuggest, ownLink } from '../../../shared/src/chat.ts';
import type { EmoteGroup } from '../../../shared/src/chat.ts';
import type { ChatLineView, ChatThreadView, ClientMsg } from '../../../shared/src/protocol.ts';

const L = dict(EN, RU);

export { EMOTES };

/** A line's words as HTML: escaped first; each known `:code:` becomes its picture (unknown ones stay words); a link of
 *  our own domain may be followed, every other stays words. */
export function chatBody(text: string, art: (id: string) => string = (id) => icon(id, '', 'emo')): string {
  let out = '';
  for (const p of chatParts(text)) {
    if (p.k === 'text') {
      out += linkify(p.s);
      continue;
    }
    const img = art(p.e.art);
    out += img ? img.replace('<img ', `<img title=":${p.code}:" `) : esc(`:${p.code}:`);
  }
  return out;
}

function linkify(s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(LINK_RE)) {
    const href = ownLink(m[1]);
    if (!href) continue;
    out += `${esc(s.slice(last, m.index))}<a class="cl-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(m[1])}</a>`;
    last = m.index! + m[0].length;
  }
  return out + esc(s.slice(last));
}

/** The tabs: the world, the ships nearby, the group, the guild, private words. */
export type ChatTab = 'world' | 'local' | 'group' | 'guild' | 'dm';
export const CHAT_TABS: ChatTab[] = ['world', 'local', 'group', 'guild', 'dm'];
/** (the older name the HUD still exports) */
export type ChatChannel = ChatTab;
const TAB_ART: Record<ChatTab, string> = { world: 'menu_chat', local: 'map_ship', group: 'tab_group', guild: 'tab_guild', dm: 'tab_letters' };
const GROUP_ART: Record<EmoteGroup, string> = { mood: 'icon.tattoo_heart', sea: 'icon.anchor', battle: 'icon.gun_long_9', loot: 'icon.coin' };

/** What a speaker is to the reader, for the colour of the name. */
export type ChatRel = 'self' | 'group' | 'guild' | 'friend' | 'whisper' | 'crown' | 'free' | 'other';

export type ChatLine = ChatLineView;

export interface ChatContext {
  self: string | null;
  group: string[];
  guild: string[];
  friends: string[];
  /** captains she has blocked (the server's list) */
  ignored?: string[];
}

export function chatRel(m: ChatLine, c: ChatContext): ChatRel {
  const name = m.from.replace(/^\[[^\]]*\]\s*/, '');
  if (c.self && name === c.self) return 'self';
  if (m.ch === 'whisper') return 'whisper';
  if (c.group.includes(name)) return 'group';
  if (m.ch === 'guild' || c.guild.includes(name)) return 'guild';
  if (c.friends.includes(name)) return 'friend';
  if (m.fac) return m.fac;
  return 'other';
}

const REL_COLOR: Record<ChatRel, string> = {
  self: '#e8c46a', group: '#8fdc9a', guild: '#9fc3e8', friend: '#7fd0d8', whisper: '#e0a8e8',
  crown: FACTIONS.crown.lantern, free: '#e0776b', other: '#d8cdb4',
};

/** What the chat asks of the game. */
export interface ChatHooks {
  send: (m: ClientMsg) => void;
  invite: (name: string) => void;
  befriend: (name: string) => void;
  block: (name: string, on: boolean) => void;
  toast: (text: string) => void;
}

interface Peer {
  name: string;
  face?: string;
  lv?: number;
  unread: number;
  at: number;
}

const low = (s: string) => s.trim().toLowerCase();
const KEEP = 120;
const MUTE_KEY = 'gravetide.chatMute';
const DOCK_KEY = 'gravetide.chatDock';

export class ChatPanel {
  private root = document.getElementById('chat')!;
  private log = document.getElementById('chat-log')!;
  private input = document.getElementById('chat-input') as HTMLInputElement;
  private toggleBtn = document.getElementById('chat-toggle')!;
  private badge = document.getElementById('chat-unread')!;
  private emotes = document.getElementById('chat-emotes')!;
  private peersBar = document.getElementById('chat-peers')!;
  private card = document.getElementById('chat-card')!;
  private suggest = document.getElementById('chat-suggest')!;
  private toastEl = document.getElementById('chat-toast')!;
  private tabsEl = document.getElementById('chat-tabs')!;
  /** every channel's lines (`world`, `local`, `group`, `guild`, `dm:<name>`), the newest last */
  private lines = new Map<string, ChatLine[]>();
  private ids = new Set<string>();
  private peers = new Map<string, Peer>();
  private unread = new Map<ChatTab, number>();
  private tab: ChatTab = 'world';
  /** the conversation open in the private tab (lowered name), or null for the list */
  private peer: string | null = null;
  private group: EmoteGroup = 'mood';
  private muted = new Set<string>();
  private toastTimer = 0;
  private lastSys = new Map<string, number>();
  /** Who the reader is and who is near to her (set by the shell). */
  context: () => ChatContext = () => ({ self: null, group: [], guild: [], friends: [] });
  hooks: ChatHooks = { send: () => {}, invite: () => {}, befriend: () => {}, block: () => {}, toast: () => {} };
  /** A channel picked (the shell may say so elsewhere). */
  onPick: (ch: ChatTab) => void = () => {};
  /** (kept for the shell: the send button now sends by itself) */
  onSend: () => void = () => this.send();

  constructor() {
    try {
      for (const n of JSON.parse(localStorage.getItem(MUTE_KEY) ?? '[]') as string[]) this.muted.add(low(n));
      const dock = localStorage.getItem(DOCK_KEY);
      if (dock === 'right' || dock === 'left') this.root.dataset.dock = dock;
    } catch {
      // a private window keeps nothing
    }
    this.root.dataset.filter = 'world';
    this.input.maxLength = CHAT_MAX;
    // A phone's keyboard comes up only when the field is touched: the button just opens the log.
    this.toggleBtn.addEventListener('click', () => this.toggle());
    document.getElementById('chat-close')!.addEventListener('click', () => this.close());
    document.getElementById('chat-dock')!.addEventListener('click', () => this.flipDock());
    const keep = (el: Element) => el.addEventListener('pointerdown', (e) => e.preventDefault()); // a phone keeps its keyboard up
    const send = document.getElementById('chat-send')!;
    keep(send);
    send.addEventListener('click', () => this.send());
    const emoBtn = document.getElementById('chat-emote-btn')!;
    keep(emoBtn);
    emoBtn.addEventListener('click', () => this.togglePicker());
    this.input.addEventListener('input', () => this.drawSuggest());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !this.suggest.classList.contains('hidden')) {
        e.preventDefault();
        (this.suggest.querySelector('[data-emo]') as HTMLElement | null)?.click();
      }
    });
    this.input.addEventListener('focus', () => this.root.classList.add('typing'));
    this.input.addEventListener('blur', () => setTimeout(() => this.root.classList.remove('typing'), 120));
    // taps inside the log: a face or a name opens the card; a conversation in the list opens it
    this.log.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      const nick = el.closest<HTMLElement>('[data-nick]')?.dataset.nick;
      if (nick) return this.openCard(nick);
      const th = el.closest<HTMLElement>('[data-peer]')?.dataset.peer;
      if (th) this.openPeer(th);
    });
    this.peersBar.addEventListener('click', (e) => {
      const el = e.target as HTMLElement;
      if (el.closest('[data-back]')) this.openPeer(null);
      else {
        const nick = el.closest<HTMLElement>('[data-nick]')?.dataset.nick;
        if (nick) this.openCard(nick);
      }
    });
    this.toastEl.addEventListener('click', () => {
      const t = this.toastEl.dataset.tab as ChatTab | undefined;
      const p = this.toastEl.dataset.peer;
      this.hideToast();
      this.open(false);
      if (t) this.pick(t);
      if (t === 'dm' && p) this.openPeer(p);
    });
    this.swipe();
    this.keyboard();
    this.art();
  }

  get isOpen(): boolean {
    return this.root.classList.contains('open');
  }

  /** The tab shown. */
  get filter(): ChatTab {
    return this.tab;
  }

  /** The pictures and words on the buttons (again once the art has loaded or the language changed). */
  art(): void {
    this.toggleBtn.querySelector('.chat-tg-ico')!.innerHTML = icon('menu_chat', '✉', 'ico');
    document.getElementById('chat-emote-btn')!.innerHTML = icon('icon.tattoo_heart', '☺', 'ico-sm');
    document.getElementById('chat-emote-btn')!.setAttribute('aria-label', L('emotes'));
    document.getElementById('chat-send')!.innerHTML = `<span>${esc(L('send'))}</span>`;
    document.getElementById('chat-close')!.setAttribute('aria-label', L('close'));
    this.drawDock();
    this.toggleBtn.title = document.body.classList.contains('touch') ? L('open') : L('openKey');
    this.toggleBtn.setAttribute('aria-label', L('open'));
    if (!this.emotes.classList.contains('hidden')) this.drawPicker();
    this.tabs();
    this.placeholder();
    this.render();
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open(!document.body.classList.contains('touch'));
  }

  open(focus: boolean): void {
    this.root.classList.add('open');
    document.body.classList.add('chat-open');
    this.toggleBtn.setAttribute('aria-expanded', 'true');
    this.hideToast();
    this.seen();
    this.render();
    if (focus) this.input.focus();
  }

  close(): void {
    this.root.classList.remove('open', 'typing');
    document.body.classList.remove('chat-open');
    this.toggleBtn.setAttribute('aria-expanded', 'false');
    this.emotes.classList.add('hidden');
    this.card.classList.add('hidden');
    this.suggest.classList.add('hidden');
    this.input.blur();
  }

  /** The field, focused (Enter on a desk). */
  focusInput(): void {
    if (!this.isOpen) this.open(false);
    this.input.focus();
  }

  /** The private tab open on a captain (her name from the friends' list, a card, «whisper»). */
  openDm(name: string): void {
    const k = low(name);
    if (!this.peers.has(k)) this.peers.set(k, { name, unread: 0, at: Date.now() });
    if (!this.isOpen) this.open(false);
    this.pick('dm');
    this.openPeer(k);
    if (!document.body.classList.contains('touch')) this.input.focus();
  }

  // ---------------------------------------------------------------------------------------- lines in

  /** A line as it comes (live). */
  add(m: ChatLine): void {
    if (!this.take(m, true)) return;
    const k = this.keyOf(m);
    const own = this.isOwn(m);
    if (this.visible(k)) {
      this.append(m);
      if (k.startsWith('dm:') && !own && this.isOpen) this.hooks.send({ t: 'chat_read', peer: this.peers.get(k.slice(3))?.name ?? k.slice(3) });
    }
    if (own || this.hidden(m)) return;
    const tab = this.tabOf(k);
    if (!this.isOpen || !this.visible(k)) {
      this.unread.set(tab, (this.unread.get(tab) ?? 0) + 1);
      if (k.startsWith('dm:')) {
        const p = this.peers.get(k.slice(3));
        if (p) p.unread++;
      }
      this.tabs();
      this.drawBadge();
      if (this.isOpen && this.tab === 'dm' && !this.peer) this.render();
    }
    // a short line by the button while closed: private words, the group, the guild (never the world's talk)
    if (!this.isOpen && (m.ch === 'whisper' || m.ch === 'group' || m.ch === 'guild')) this.showToast(m, tab, k.startsWith('dm:') ? k.slice(3) : undefined);
  }

  /** The history: on coming aboard (the channels' last lines, the conversations), or one conversation whole. */
  history(h: { lines: ChatLine[]; dms: ChatThreadView[]; peer?: string }): void {
    for (const m of h.lines) this.take(m, false);
    for (const th of h.dms) {
      const k = low(th.peer);
      const p = this.peers.get(k) ?? { name: th.peer, unread: 0, at: 0 };
      p.name = th.peer;
      p.face = th.face ?? p.face;
      p.lv = th.lv ?? p.lv;
      if (!h.peer) p.unread = th.unread;
      p.at = Math.max(p.at, th.lines.at(-1)?.at ?? 0);
      this.peers.set(k, p);
      for (const m of th.lines) this.take(m, false);
    }
    if (!h.peer) {
      const n = [...this.peers.values()].reduce((a, p) => a + p.unread, 0);
      if (n) this.unread.set('dm', n);
      else this.unread.delete('dm');
    }
    for (const list of this.lines.values()) list.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
    this.tabs();
    this.drawBadge();
    this.render();
  }

  /** The sea's news ("WORLD: …") in the world's tab, once a minute at most for the same words; never counted. */
  system(text: string): void {
    const now = Date.now();
    if ((this.lastSys.get(text) ?? 0) > now - 60_000) return;
    this.lastSys.set(text, now);
    if (this.lastSys.size > 60) this.lastSys.delete(this.lastSys.keys().next().value!);
    const m: ChatLine = { from: '', text, ch: 'sys', at: now };
    this.store('world', m);
    if (this.visible('world')) this.append(m);
  }

  /** Into the store: false for a line already there (by its id) or one hidden. */
  private take(m: ChatLine, live: boolean): boolean {
    if (m.id) {
      if (this.ids.has(m.id)) return false;
      this.ids.add(m.id);
      if (this.ids.size > 3000) this.ids.delete(this.ids.values().next().value!);
    }
    const k = this.keyOf(m);
    if (k.startsWith('dm:')) {
      const name = m.to ?? m.from;
      const p = this.peers.get(k.slice(3)) ?? { name, unread: 0, at: 0 };
      if (!this.isOwn(m)) {
        p.face = m.face ?? p.face;
        p.lv = m.lv ?? p.lv;
      }
      p.at = Math.max(p.at, m.at ?? Date.now());
      this.peers.set(k.slice(3), p);
    }
    this.store(k, m);
    return live ? !this.hidden(m) || this.isOwn(m) : true;
  }

  private store(k: string, m: ChatLine): void {
    let list = this.lines.get(k);
    if (!list) this.lines.set(k, (list = []));
    list.push(m);
    if (list.length > KEEP) list.splice(0, list.length - KEEP);
  }

  private keyOf(m: ChatLine): string {
    switch (m.ch) {
      case 'local':
      case 'group':
      case 'guild':
        return m.ch;
      case 'whisper':
        return `dm:${low(m.to ?? m.from)}`;
      default:
        return 'world';
    }
  }

  private tabOf(k: string): ChatTab {
    return k.startsWith('dm:') ? 'dm' : (k as ChatTab);
  }

  private isOwn(m: ChatLine): boolean {
    const me = this.context().self;
    return !!me && m.from === me;
  }

  /** A line of a captain she hid here or blocked. */
  private hidden(m: ChatLine): boolean {
    if (!m.from || this.isOwn(m)) return false;
    const n = low(m.from.replace(/^\[[^\]]*\]\s*/, ''));
    return this.muted.has(n) || (this.context().ignored ?? []).some((x) => low(x) === n);
  }

  private visible(k: string): boolean {
    if (!this.isOpen) return false;
    if (k.startsWith('dm:')) return this.tab === 'dm' && this.peer === k.slice(3);
    return this.tab === k;
  }

  /** The tab or conversation shown has been seen: its unread go. */
  private seen(): void {
    if (this.tab === 'dm') {
      if (this.peer) {
        const p = this.peers.get(this.peer);
        if (p?.unread) {
          p.unread = 0;
          this.hooks.send({ t: 'chat_read', peer: p.name });
        }
        const n = [...this.peers.values()].reduce((a, x) => a + x.unread, 0);
        if (n) this.unread.set('dm', n);
        else this.unread.delete('dm');
      }
    } else this.unread.delete(this.tab);
    this.tabs();
    this.drawBadge();
  }

  // ---------------------------------------------------------------------------------------- drawing

  /** The channels as tabs with their pictures; a dot or a count on a tab with lines not yet seen. */
  tabs(): void {
    const c = this.context();
    const shown = CHAT_TABS.filter((t) => (t !== 'group' || c.group.length > 1 || this.tab === 'group' || (this.lines.get('group')?.length ?? 0) > 0) && (t !== 'guild' || c.guild.length > 0 || this.tab === 'guild' || (this.lines.get('guild')?.length ?? 0) > 0));
    this.tabsEl.innerHTML = shown.map((t) => {
      const n = this.unread.get(t) ?? 0;
      const mark = n && t !== this.tab ? (t === 'world' || t === 'local' ? '<i class="ct-dot" aria-hidden="true"></i>' : `<i class="ct-n">${n > 9 ? '9+' : n}</i>`) : '';
      return `<button type="button" role="tab" aria-selected="${t === this.tab}" class="ct${t === this.tab ? ' on' : ''}" data-ct="${t}" title="${esc(L(`ch_${t}`))}" aria-label="${esc(L(`ch_${t}`))}${n ? `, ${esc(L('unread', { n }))}` : ''}">${icon(TAB_ART[t], '', 'ico-sm')}<span class="ct-l">${esc(L(`ch_${t}`))}</span>${mark}</button>`;
    }).join('');
    this.tabsEl.querySelectorAll<HTMLElement>('[data-ct]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.preventDefault()); // the field keeps its focus (and a phone its keyboard)
      b.addEventListener('click', () => this.pick(b.dataset.ct as ChatTab));
    });
  }

  /** A tab picked. */
  pick(t: ChatTab): void {
    if (this.tab === t && t !== 'dm') return;
    this.tab = t;
    this.root.dataset.filter = t;
    if (t !== 'dm') this.peer = null;
    this.card.classList.add('hidden');
    this.seen();
    this.placeholder();
    this.render();
    this.onPick(t);
  }

  private openPeer(k: string | null): void {
    this.peer = k ? low(k) : null;
    this.card.classList.add('hidden');
    this.seen();
    this.placeholder();
    this.render();
    if (k) this.hooks.send({ t: 'chat_hist', peer: this.peers.get(low(k))?.name ?? k });
  }

  private placeholder(): void {
    const c = this.context();
    let ph: string;
    if (this.tab === 'dm') ph = this.peer ? L('ph_dm', { name: this.peers.get(this.peer)?.name ?? this.peer }) : L('ph_dmNone');
    else if (this.tab === 'group' && c.group.length < 2) ph = L('ph_noGroup');
    else if (this.tab === 'guild' && !c.guild.length) ph = L('ph_noGuild');
    else ph = L(`ph_${this.tab}` as 'ph_world');
    this.input.placeholder = ph;
  }

  /** The log of the tab shown, again (a tab, a conversation, a language). */
  private render(): void {
    this.drawPeersBar();
    if (this.tab === 'dm' && !this.peer) return this.drawThreads();
    const k = this.tab === 'dm' ? `dm:${this.peer}` : this.tab;
    const list = (this.lines.get(k) ?? []).filter((m) => !this.hidden(m));
    this.log.innerHTML = list.length ? list.map((m) => this.lineHtml(m)).join('') : `<p class="cl-empty">${esc(L('noLines'))}</p>`;
    this.log.scrollTop = this.log.scrollHeight;
  }

  private append(m: ChatLine): void {
    if (this.hidden(m)) return;
    this.log.querySelector('.cl-empty')?.remove();
    const stick = this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 48;
    this.log.insertAdjacentHTML('beforeend', this.lineHtml(m));
    while (this.log.children.length > KEEP) this.log.firstElementChild!.remove();
    if (stick || this.isOwn(m)) this.log.scrollTop = this.log.scrollHeight;
  }

  private faceUrl(face: string | undefined, name: string): string | null {
    return (face && portraitUrl(face)) || portraitUrl(faceOf(name));
  }

  private time(at: number | undefined): string {
    const d = new Date(at ?? Date.now());
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** A line: the face (a button to her card), the name in its colour, the guild's tag, the level, the time, the words. */
  private lineHtml(m: ChatLine): string {
    if (m.ch === 'sys') return `<div class="cl cl-sys"><span class="cl-sys-ico" aria-hidden="true">${icon('menu_map', '', 'emo')}</span><div class="cl-text">${esc(m.text)}</div></div>`;
    const c = this.context();
    const rel = chatRel(m, c);
    const own = rel === 'self';
    const name = m.from.replace(/^\[[^\]]*\]\s*/, '');
    const face = this.faceUrl(m.face, name);
    const nick = own ? '' : ` data-nick="${esc(name)}"`;
    const faceEl = `<${own ? 'span' : 'button type="button"'} class="cl-face"${nick}${face ? ` style="background-image:url('${esc(face)}')"` : ''} aria-label="${esc(name)}"></${own ? 'span' : 'button'}>`;
    const tag = m.g ? `<span class="cl-g">[${esc(m.g)}]</span>` : '';
    const lv = m.lv ? `<span class="cl-lv">${esc(L('lv', { n: m.lv }))}</span>` : '';
    const to = m.ch === 'whisper' && m.to ? `<span class="cl-to">${esc(L('to', { name: m.to }))}</span>` : '';
    return `<div class="cl${m.ch ? ` chat-${m.ch}` : ''}${own ? ' cl-own' : ''}">${faceEl}<div class="cl-body"><div class="cl-head"><b class="cl-name"${nick} style="color:${REL_COLOR[rel]}">${esc(name)}</b>${tag}${lv}${to}<time>${this.time(m.at)}</time></div><div class="cl-text">${m.card ? sagaCardHtml(m.card) : chatBody(m.text)}</div></div></div>`;
  }

  /** The private tab without a conversation open: the conversations, the newest first. */
  private drawThreads(): void {
    const list = [...this.peers.entries()].sort((a, b) => b[1].at - a[1].at);
    if (!list.length) {
      this.log.innerHTML = `<p class="cl-empty">${esc(L('noThreads'))}</p>`;
      return;
    }
    this.log.innerHTML = list.map(([k, p]) => {
      const last = (this.lines.get(`dm:${k}`) ?? []).at(-1);
      const face = this.faceUrl(p.face, p.name);
      const said = last ? `${this.isOwn(last) ? `${esc(L('you'))}: ` : ''}${chatBody(last.text)}` : '';
      return `<button type="button" class="ct-thread" data-peer="${esc(k)}"><span class="cl-face"${face ? ` style="background-image:url('${esc(face)}')"` : ''}></span><span class="ct-th-body"><span class="ct-th-top"><b>${esc(p.name)}</b>${p.lv ? `<span class="cl-lv">${esc(L('lv', { n: p.lv }))}</span>` : ''}</span><span class="ct-th-last">${said}</span></span>${p.unread ? `<i class="ct-n">${p.unread > 9 ? '9+' : p.unread}</i>` : ''}</button>`;
    }).join('');
  }

  /** Over the private tab's log: back to the list, and the captain written to (her card on a tap). */
  private drawPeersBar(): void {
    const on = this.tab === 'dm' && !!this.peer;
    this.peersBar.classList.toggle('hidden', !on);
    if (!on) return;
    const p = this.peers.get(this.peer!);
    const name = p?.name ?? this.peer!;
    const face = this.faceUrl(p?.face, name);
    this.peersBar.innerHTML = `<button type="button" class="chat-back" data-back aria-label="${esc(L('back'))}" title="${esc(L('back'))}">‹</button><button type="button" class="chat-peer" data-nick="${esc(name)}"><span class="cl-face"${face ? ` style="background-image:url('${esc(face)}')"` : ''}></span><b>${esc(name)}</b>${p?.lv ? `<span class="cl-lv">${esc(L('lv', { n: p.lv }))}</span>` : ''}</button>`;
  }

  private drawBadge(): void {
    const loud = this.loudUnread;
    const quiet = (this.unread.get('world') ?? 0) + (this.unread.get('local') ?? 0);
    this.badge.textContent = loud ? (loud > 99 ? '99+' : String(loud)) : '';
    this.badge.classList.toggle('hidden', !loud && !quiet);
    this.badge.classList.toggle('dot', !loud && quiet > 0);
    this.toggleBtn.classList.toggle('has-unread', loud > 0);
  }

  /** The count of unread a menu's badge adds (the private words, the group, the guild). */
  get loudUnread(): number {
    return (this.unread.get('dm') ?? 0) + (this.unread.get('group') ?? 0) + (this.unread.get('guild') ?? 0);
  }

  private drawDock(): void {
    const right = this.root.dataset.dock === 'right';
    const b = document.getElementById('chat-dock')!;
    b.textContent = right ? '⇤' : '⇥';
    b.setAttribute('aria-label', right ? L('dockLeft') : L('dockRight'));
    b.title = right ? L('dockLeft') : L('dockRight');
  }

  private flipDock(): void {
    this.root.dataset.dock = this.root.dataset.dock === 'right' ? 'left' : 'right';
    try {
      localStorage.setItem(DOCK_KEY, this.root.dataset.dock);
    } catch {
      // kept for this visit only
    }
    this.drawDock();
  }

  // ---------------------------------------------------------------------------------------- the toast-line

  private showToast(m: ChatLine, tab: ChatTab, peer?: string): void {
    const words = m.text.length > 44 ? `${m.text.slice(0, 43)}…` : m.text;
    const face = this.faceUrl(m.face, m.from);
    this.toastEl.innerHTML = `<span class="cl-face"${face ? ` style="background-image:url('${esc(face)}')"` : ''}></span><span class="chat-toast-t"><b>${esc(m.from)}</b> ${chatBody(words)}</span>`;
    this.toastEl.dataset.tab = tab;
    if (peer) this.toastEl.dataset.peer = peer;
    else delete this.toastEl.dataset.peer;
    this.toastEl.className = `chat-toast chat-${m.ch}`;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.hideToast(), 4500);
  }

  private hideToast(): void {
    this.toastEl.classList.add('hidden');
    clearTimeout(this.toastTimer);
  }

  // ---------------------------------------------------------------------------------------- the card

  private openCard(name: string): void {
    const c = this.context();
    if (!name || name === c.self) return;
    const k = low(name);
    const last = [...(this.lines.get('world') ?? []), ...(this.lines.get('local') ?? []), ...(this.lines.get('group') ?? []), ...(this.lines.get('guild') ?? []), ...(this.lines.get(`dm:${k}`) ?? [])]
      .filter((m) => low(m.from) === k).sort((a, b) => (a.at ?? 0) - (b.at ?? 0)).at(-1);
    const p = this.peers.get(k);
    const face = this.faceUrl(last?.face ?? p?.face, name);
    const lv = last?.lv ?? p?.lv;
    const blocked = (c.ignored ?? []).some((x) => low(x) === k);
    const muted = this.muted.has(k);
    const friend = c.friends.includes(name);
    const inGroup = c.group.includes(name);
    const btn = (act: string, art: string, word: string) => `<button type="button" class="chat-card-b" data-act="${act}">${icon(art, '', 'ico-sm')}<span>${esc(word)}</span></button>`;
    this.card.innerHTML = `<div class="chat-card-head"><span class="cl-face chat-card-face"${face ? ` style="background-image:url('${esc(face)}')"` : ''}></span><div class="chat-card-who"><b>${esc(name)}</b><span>${last?.g ? `[${esc(last.g)}] ` : ''}${lv ? esc(L('lv', { n: lv })) : ''}</span></div><button type="button" class="chat-x" data-act="close" aria-label="${esc(L('card_close'))}">×</button></div>`
      + `<div class="chat-card-acts">${btn('dm', 'tab_letters', L('card_dm'))}${inGroup ? '' : btn('invite', 'tab_group', L('card_invite'))}${friend ? '' : btn('friend', 'menu_company', L('card_friend'))}${btn('mute', 'weather_fog', muted ? L('card_unmute') : L('card_mute'))}${btn('block', 'bt_defend', blocked ? L('card_unblock') : L('card_block'))}${btn('report', 'tab_law', L('card_report'))}</div>`;
    this.card.classList.remove('hidden');
    this.emotes.classList.add('hidden');
    this.card.querySelectorAll<HTMLElement>('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const act = b.dataset.act;
      this.card.classList.add('hidden');
      if (act === 'dm') this.openDm(name);
      else if (act === 'invite') this.hooks.invite(name);
      else if (act === 'friend') this.hooks.befriend(name);
      else if (act === 'block') this.hooks.block(name, !blocked);
      else if (act === 'report') this.hooks.send({ t: 'chat_report', name, text: last?.text ?? '' });
      else if (act === 'mute') {
        if (muted) this.muted.delete(k);
        else this.muted.add(k);
        try {
          localStorage.setItem(MUTE_KEY, JSON.stringify([...this.muted]));
        } catch {
          // for this visit only
        }
        this.hooks.toast(L(muted ? 'unmuted' : 'muted', { name }));
        this.render();
      }
    }));
  }

  // ---------------------------------------------------------------------------------------- emotes

  private togglePicker(): void {
    const on = this.emotes.classList.contains('hidden');
    this.card.classList.add('hidden');
    if (on) this.drawPicker();
    this.emotes.classList.toggle('hidden', !on);
  }

  private drawPicker(): void {
    const tabs = EMOTE_GROUPS.map((g) => `<button type="button" class="eg${g === this.group ? ' on' : ''}" data-eg="${g}" title="${esc(L(`eg_${g}`))}" aria-label="${esc(L(`eg_${g}`))}">${icon(GROUP_ART[g], '', 'emo')}<span class="eg-l">${esc(L(`eg_${g}`))}</span></button>`).join('');
    const ru = lang() === 'ru';
    const cells = EMOTES.filter((e) => e.group === this.group).map((e) => `<button type="button" data-emo="${e.code}" title=":${e.code}:${ru ? ` — ${esc(e.ru)}` : ''}" aria-label="${esc(ru ? e.ru : e.code)}">${icon(e.art, `:${e.code}:`, 'emo')}</button>`).join('');
    this.emotes.innerHTML = `<div class="eg-tabs">${tabs}</div><div class="eg-grid">${cells}</div>`;
    this.emotes.querySelectorAll<HTMLElement>('button').forEach((b) => b.addEventListener('pointerdown', (e) => e.preventDefault()));
    this.emotes.querySelectorAll<HTMLElement>('[data-eg]').forEach((b) => b.addEventListener('click', () => {
      this.group = b.dataset.eg as EmoteGroup;
      this.drawPicker();
    }));
    this.emotes.querySelectorAll<HTMLElement>('[data-emo]').forEach((b) => b.addEventListener('click', () => this.insert(`:${b.dataset.emo}:`)));
  }

  /** The emotes whose code or Russian name begins with the word after «:» at the caret. */
  private drawSuggest(): void {
    const v = this.input.value.slice(0, this.input.selectionStart ?? this.input.value.length);
    const m = /(?:^|\s):([a-zа-яё0-9_]{1,12})$/i.exec(v);
    const list = m ? emoteSuggest(m[1], 8) : [];
    this.suggest.classList.toggle('hidden', !list.length);
    if (!m || !list.length) return;
    const typed = m[1];
    this.suggest.innerHTML = list.map((e) => `<button type="button" data-emo="${e.code}" title=":${e.code}:" aria-label=":${e.code}:">${icon(e.art, `:${e.code}:`, 'emo')}</button>`).join('');
    this.suggest.querySelectorAll<HTMLElement>('[data-emo]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', () => {
        const val = this.input.value;
        const at = this.input.selectionStart ?? val.length;
        const start = Math.max(0, at - typed.length - 1);
        const token = `:${b.dataset.emo}: `;
        this.input.value = (val.slice(0, start) + token + val.slice(at)).slice(0, CHAT_MAX);
        const caret = Math.min(this.input.value.length, start + token.length);
        this.input.setSelectionRange(caret, caret);
        this.suggest.classList.add('hidden');
        if (!document.body.classList.contains('touch')) this.input.focus();
      });
    });
  }

  /** An emote into the field where the caret stands. */
  private insert(token: string): void {
    const v = this.input.value;
    const at = this.input.selectionStart ?? v.length, end = this.input.selectionEnd ?? at;
    const before = v.slice(0, at), after = v.slice(end);
    const pad = before && !before.endsWith(' ') ? ' ' : '';
    const next = `${before}${pad}${token} ${after}`.slice(0, CHAT_MAX);
    this.input.value = next;
    const caret = Math.min(next.length, before.length + pad.length + token.length + 1);
    this.input.setSelectionRange(caret, caret);
    if (!document.body.classList.contains('touch')) this.input.focus();
  }

  // ---------------------------------------------------------------------------------------- out

  /** What is in the field goes where it is addressed: a command as typed, «/g» to the group, «/gc» to the guild, else
   *  to the tab shown (the conversation open in the private tab). */
  send(): void {
    const said = this.input.value.trim();
    if (!said) return;
    const c = this.context();
    let m: ClientMsg;
    if (/^\/gc\s/i.test(said)) m = { t: 'chat', text: said.slice(4), ch: 'guild' };
    else if (/^\/g\s/i.test(said)) m = { t: 'chat', text: said.slice(3), ch: 'group' };
    else if (said.startsWith('/')) m = { t: 'chat', text: said };
    else if (this.tab === 'dm') {
      if (!this.peer) return;
      m = { t: 'chat', text: said, ch: 'dm', to: this.peers.get(this.peer)?.name ?? this.peer };
    } else if (this.tab === 'group' && c.group.length < 2) return;
    else if (this.tab === 'guild' && !c.guild.length) return;
    else m = { t: 'chat', text: said, ch: this.tab };
    this.hooks.send(m);
    this.input.value = '';
    this.suggest.classList.add('hidden');
    this.emotes.classList.add('hidden');
  }

  // ---------------------------------------------------------------------------------------- a phone

  /** A swipe toward the sheet's own edge folds it away (right on a phone; the dock's side on a desk). */
  private swipe(): void {
    let x0 = 0, y0 = 0, on = false;
    this.root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      x0 = e.clientX;
      y0 = e.clientY;
      on = true;
    });
    this.root.addEventListener('pointerup', (e) => {
      if (!on) return;
      on = false;
      const dx = e.clientX - x0, dy = e.clientY - y0;
      const toward = this.root.dataset.dock === 'left' && !document.body.classList.contains('touch') ? -1 : 1;
      if (dx * toward > 70 && Math.abs(dx) > 2 * Math.abs(dy)) this.close();
    });
    this.root.addEventListener('pointercancel', () => (on = false));
  }

  /** The field stays above a phone's keyboard: the sheet's bottom follows the visual viewport. */
  private keyboard(): void {
    const vv = window.visualViewport;
    if (!vv) return;
    const host = document.getElementById('hud-chat')!;
    const fit = () => {
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      host.style.setProperty('--chat-kb', `${kb > 40 ? kb : 0}px`);
      host.style.setProperty('--chat-vv-top', `${Math.max(0, Math.round(vv.offsetTop))}px`);
      host.classList.toggle('chat-kb', kb > 40);
      if (kb > 40 && this.isOpen) this.log.scrollTop = this.log.scrollHeight;
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
  }
}
